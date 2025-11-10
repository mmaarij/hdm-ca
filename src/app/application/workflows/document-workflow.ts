/**
 * Document Workflow - Functional Pattern
 *
 * Functional workflows using currying pattern similar to TODO app.
 * Each workflow is a pure function that takes dependencies and returns a function that takes input.
 * No Effect.gen usage - pure monadic composition with pipe.
 */

import { Effect, Option, pipe, Schema as S } from "effect";
import { v4 as uuidv4 } from "uuid";
import type { DocumentRepository } from "../../domain/document/repository";
import type { UserRepository } from "../../domain/user/repository";
import type { PermissionRepository } from "../../domain/permission/repository";
import {
  DocumentNotFoundError,
  DuplicateDocumentError,
} from "../../domain/document/errors";
import { NotFoundError, ForbiddenError } from "../../domain/shared/base.errors";
import { InsufficientPermissionError } from "../utils/errors";
import {
  DocumentEntity,
  DocumentVersionEntity,
} from "../../domain/document/entity";
import { DocumentDomainServiceLive } from "../../domain/document/service";
import {
  isAdmin,
  requireReadPermission,
  requireWritePermission,
  requireDeletePermission,
} from "../../domain/permission/service";
import { UuidGenerators } from "../../domain/refined/uuid";
import { DateTimeHelpers } from "../../domain/refined/date-time";
import { ValueObjectHelpers } from "../../domain/document/value-object";
import type {
  UserId,
  DocumentId,
  DocumentVersionId,
} from "../../domain/refined/uuid";
import type { StoragePort } from "../ports/storage.port";
import type {
  UploadDocumentInput,
  UploadDocumentCommand,
  GetDocumentInput,
  GetDocumentQuery,
  ListDocumentsInput,
  ListDocumentsQuery,
  ListAllDocumentsInput,
  ListAllDocumentsQuery,
  SearchDocumentsInput,
  SearchDocumentsQuery,
  DeleteDocumentInput,
  DeleteDocumentCommand,
  GetDocumentVersionInput,
  GetDocumentVersionQuery,
} from "../dtos/document/request.dto";
import * as DocumentDTOs from "../dtos/document/request.dto";
import type {
  UploadDocumentResponse,
  DocumentWithVersionResponse,
  PaginatedDocumentsResponse,
  SearchDocumentsResponse,
  DocumentVersionResponse,
} from "../dtos/document/response.dto";
import { DocumentResponseMapper } from "../mappers/document.mapper";

// Re-export WorkflowTag from bootstrap for route compatibility
export { DocumentWorkflowTag } from "../../bootstrap";

/**
 * Dependencies for document workflows
 */
export interface DocumentWorkflowDeps {
  readonly documentRepo: DocumentRepository;
  readonly userRepo: UserRepository;
  readonly permissionRepo: PermissionRepository;
  readonly storageService: StoragePort;
}

/**
 * Upload document workflow (creates new or adds version to existing)
 * Curried function: takes deps, returns function that takes command
 */
export const uploadDocument =
  (deps: DocumentWorkflowDeps) =>
  (input: UploadDocumentInput): Effect.Effect<UploadDocumentResponse, Error> =>
    pipe(
      S.decodeUnknown(DocumentDTOs.UploadDocumentCommand)(input),
      Effect.mapError(
        (e) => new Error(`Invalid input for uploadDocument: ${e}`)
      ),
      Effect.flatMap((command) =>
        pipe(
          // Check if updating existing document or creating new
          command.documentId
            ? pipe(
                deps.documentRepo.findById(command.documentId),
                Effect.flatMap(
                  Option.match({
                    onNone: () =>
                      Effect.fail(
                        new NotFoundError({
                          entityType: "Document",
                          id: command.documentId!,
                          message: `Document with ID ${command.documentId} not found`,
                        })
                      ),
                    onSome: (doc: DocumentEntity) =>
                      pipe(
                        Effect.all({
                          user: pipe(
                            deps.userRepo.findById(command.uploadedBy),
                            Effect.flatMap(
                              Option.match({
                                onNone: () =>
                                  Effect.fail(
                                    new NotFoundError({
                                      entityType: "User",
                                      id: command.uploadedBy,
                                    })
                                  ),
                                onSome: Effect.succeed,
                              })
                            )
                          ),
                          permissions: deps.permissionRepo.findByDocument(
                            command.documentId!
                          ),
                        }),
                        Effect.flatMap(({ user, permissions }) =>
                          pipe(
                            requireWritePermission(user, doc, permissions),
                            Effect.map(() => ({
                              document: doc,
                              isNewDocument: false,
                            }))
                          )
                        )
                      ),
                  })
                )
              )
            : pipe(
                deps.documentRepo.findByFilenameAndUser(
                  ValueObjectHelpers.filename(command.file.name),
                  command.uploadedBy
                ),
                Effect.flatMap((existingDoc) =>
                  Option.isSome(existingDoc)
                    ? Effect.fail(
                        new DuplicateDocumentError({
                          message: `A document with filename '${command.file.name}' already exists`,
                          checksum: "",
                        })
                      )
                    : pipe(
                        DocumentEntity.create({
                          id: UuidGenerators.documentId(),
                          filename: ValueObjectHelpers.filename(
                            command.file.name
                          ),
                          originalName: ValueObjectHelpers.filename(
                            command.file.name
                          ),
                          mimeType: ValueObjectHelpers.mimeType(
                            command.file.type
                          ),
                          size: ValueObjectHelpers.fileSize(command.file.size),
                          uploadedBy: command.uploadedBy,
                          createdAt: DateTimeHelpers.fromISOString(
                            new Date().toISOString()
                          ),
                          updatedAt: DateTimeHelpers.fromISOString(
                            new Date().toISOString()
                          ),
                        }),
                        Effect.map((document) => ({
                          document,
                          isNewDocument: true,
                        })),
                        Effect.mapError(
                          (e) =>
                            new DuplicateDocumentError({
                              message: `Failed to create document: ${e.message}`,
                              checksum: "",
                            })
                        )
                      )
                )
              ),
          Effect.flatMap(({ document, isNewDocument }) =>
            pipe(
              // Generate temporary version ID for storage
              Effect.succeed({
                document,
                isNewDocument,
                tempVersionId: UuidGenerators.documentVersionId(),
              })
            )
          ),
          Effect.flatMap(({ document, isNewDocument, tempVersionId }) =>
            pipe(
              deps.storageService.storeUploadedFile(
                command.file,
                document.id,
                tempVersionId
              ),
              Effect.map((storedFile) => ({
                document,
                isNewDocument,
                storedFile,
              }))
            )
          ),
          Effect.flatMap(({ document, isNewDocument, storedFile }) =>
            !isNewDocument && storedFile.checksum
              ? pipe(
                  DocumentDomainServiceLive.validateNoDuplicateContent(
                    document.versions,
                    ValueObjectHelpers.checksum(storedFile.checksum)
                  ),
                  Effect.map(() => ({ document, isNewDocument, storedFile }))
                )
              : Effect.succeed({ document, isNewDocument, storedFile })
          ),
          Effect.map(({ document, isNewDocument, storedFile }) => {
            // Use the entity's addVersion method to add a new version
            const documentWithVersion = document.addVersion({
              filename: ValueObjectHelpers.filename(storedFile.filename),
              originalName: ValueObjectHelpers.filename(
                storedFile.originalName
              ),
              mimeType: ValueObjectHelpers.mimeType(command.file.type),
              size: ValueObjectHelpers.fileSize(command.file.size),
              uploadedBy: command.uploadedBy,
              path: ValueObjectHelpers.filePath(storedFile.path),
              contentRef: ValueObjectHelpers.contentRef(storedFile.path),
              checksum: ValueObjectHelpers.checksum(storedFile.checksum),
            });
            return { documentWithVersion, isNewDocument };
          }),
          Effect.flatMap(({ documentWithVersion, isNewDocument }) =>
            pipe(
              deps.documentRepo.save(documentWithVersion),
              Effect.map((savedDocument) => ({ savedDocument, isNewDocument }))
            )
          ),
          Effect.tap(({ savedDocument, isNewDocument }) => {
            // Use the entity's getLatestVersion method
            const latestVersionOpt = savedDocument.getLatestVersion();
            const latestVersion = Option.getOrThrow(latestVersionOpt);
            return deps.documentRepo.addAudit(
              savedDocument.id,
              isNewDocument ? "created" : "new_version",
              command.uploadedBy,
              Option.some(`Version ${latestVersion.versionNumber} uploaded`)
            );
          }),
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map(({ savedDocument }) => {
            // Use the entity's getLatestVersion method
            const latestVersionOpt = savedDocument.getLatestVersion();
            const latestVersion = Option.getOrThrow(latestVersionOpt);

            return {
              documentId: savedDocument.id,
              versionId: latestVersion.id,
              document:
                DocumentResponseMapper.toDocumentResponse(savedDocument),
              version: DocumentResponseMapper.toVersionResponse(latestVersion),
            };
          })
        )
      )
    );

/**
 * Get document by ID (returns latest version)
 */
export const getDocument =
  (deps: DocumentWorkflowDeps) =>
  (
    input: GetDocumentInput
  ): Effect.Effect<
    DocumentWithVersionResponse,
    NotFoundError | InsufficientPermissionError | Error
  > =>
    pipe(
      S.decodeUnknown(DocumentDTOs.GetDocumentQuery)(input),
      Effect.mapError((e) => new Error(`Invalid input for getDocument: ${e}`)),
      Effect.flatMap((query) =>
        pipe(
          Effect.all({
            document: pipe(
              deps.documentRepo.findById(query.documentId),
              Effect.flatMap(
                Option.match({
                  onNone: () =>
                    Effect.fail(
                      new NotFoundError({
                        entityType: "Document",
                        id: query.documentId,
                      })
                    ),
                  onSome: Effect.succeed,
                })
              )
            ),
            user: pipe(
              deps.userRepo.findById(query.userId),
              Effect.flatMap(
                Option.match({
                  onNone: () =>
                    Effect.fail(
                      new NotFoundError({
                        entityType: "User",
                        id: query.userId,
                      })
                    ),
                  onSome: Effect.succeed,
                })
              )
            ),
            permissions: deps.permissionRepo.findByDocument(query.documentId),
          }),
          Effect.flatMap(({ document, user, permissions }) =>
            pipe(
              requireReadPermission(user, document, permissions),
              Effect.map(() => document)
            )
          ),
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map((document) => {
            // Use the entity's getLatestVersion method
            const latestVersionOpt = document.getLatestVersion();
            const latestVersion = Option.getOrThrow(latestVersionOpt);

            return {
              document: DocumentResponseMapper.toDocumentResponse(document),
              latestVersion:
                DocumentResponseMapper.toVersionResponse(latestVersion),
            };
          })
        )
      )
    );

/**
 * Get specific document version
 */
export const getDocumentVersion =
  (deps: DocumentWorkflowDeps) =>
  (
    input: GetDocumentVersionInput
  ): Effect.Effect<
    DocumentVersionResponse,
    NotFoundError | InsufficientPermissionError | Error
  > =>
    pipe(
      S.decodeUnknown(DocumentDTOs.GetDocumentVersionQuery)(input),
      Effect.mapError(
        (e) => new Error(`Invalid input for getDocumentVersion: ${e}`)
      ),
      Effect.flatMap((query) =>
        pipe(
          Effect.all({
            document: pipe(
              deps.documentRepo.findById(query.documentId),
              Effect.flatMap(
                Option.match({
                  onNone: () =>
                    Effect.fail(
                      new NotFoundError({
                        entityType: "Document",
                        id: query.documentId,
                      })
                    ),
                  onSome: Effect.succeed,
                })
              )
            ),
            user: pipe(
              deps.userRepo.findById(query.userId),
              Effect.flatMap(
                Option.match({
                  onNone: () =>
                    Effect.fail(
                      new NotFoundError({
                        entityType: "User",
                        id: query.userId,
                      })
                    ),
                  onSome: Effect.succeed,
                })
              )
            ),
            permissions: deps.permissionRepo.findByDocument(query.documentId),
          }),
          Effect.flatMap(({ document, user, permissions }) =>
            pipe(
              requireReadPermission(user, document, permissions),
              Effect.flatMap(() => {
                const version = document.versions.find(
                  (v) => v.id === query.versionId
                );
                return version
                  ? Effect.succeed(version)
                  : Effect.fail(
                      new NotFoundError({
                        entityType: "DocumentVersion",
                        id: query.versionId,
                      })
                    );
              })
            )
          ),
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map((version) =>
            DocumentResponseMapper.toVersionResponse(version)
          )
        )
      )
    );

/**
 * List all versions for a document
 */
export const listDocumentVersions =
  (deps: DocumentWorkflowDeps) =>
  (
    documentId: DocumentId,
    userId: UserId
  ): Effect.Effect<
    readonly DocumentVersionResponse[],
    NotFoundError | InsufficientPermissionError | Error
  > =>
    pipe(
      Effect.all({
        document: pipe(
          deps.documentRepo.findById(documentId),
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.fail(
                  new NotFoundError({
                    entityType: "Document",
                    id: documentId,
                  })
                ),
              onSome: Effect.succeed,
            })
          )
        ),
        user: pipe(
          deps.userRepo.findById(userId),
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.fail(
                  new NotFoundError({
                    entityType: "User",
                    id: userId,
                  })
                ),
              onSome: Effect.succeed,
            })
          )
        ),
        permissions: deps.permissionRepo.findByDocument(documentId),
      }),
      Effect.flatMap(({ document, user, permissions }) =>
        pipe(
          requireReadPermission(user, document, permissions),
          Effect.map(() => document.versions)
        )
      ),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e)))),
      Effect.map((versions) =>
        versions.map(DocumentResponseMapper.toVersionResponse)
      )
    );

/**
 * List documents accessible to user
 */
export const listDocuments =
  (deps: DocumentWorkflowDeps) =>
  (
    input: ListDocumentsInput
  ): Effect.Effect<PaginatedDocumentsResponse, Error> =>
    pipe(
      S.decodeUnknown(DocumentDTOs.ListDocumentsQuery)(input),
      Effect.mapError(
        (e) => new Error(`Invalid input for listDocuments: ${e}`)
      ),
      Effect.flatMap((query) =>
        pipe(
          deps.userRepo.findById(query.userId),
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.succeed({
                  documents: [],
                  total: 0,
                  page: query.page ?? 1,
                  limit: query.limit ?? 20,
                  totalPages: 0,
                  hasNextPage: false,
                  hasPreviousPage: false,
                }),
              onSome: (user) =>
                pipe(
                  deps.documentRepo.listByUser(user.id, {
                    page: query.page ?? 1,
                    limit: query.limit ?? 20,
                  }),
                  Effect.map((result) => ({
                    documents: result.data.map(
                      DocumentResponseMapper.toDocumentWithVersionResponse
                    ),
                    total: result.meta.totalItems,
                    page: result.meta.page,
                    limit: result.meta.limit,
                    totalPages: result.meta.totalPages,
                    hasNextPage: result.meta.hasNextPage,
                    hasPreviousPage: result.meta.hasPreviousPage,
                  }))
                ),
            })
          ),
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          )
        )
      )
    );

/**
 * List all documents (admin only)
 */
export const listAllDocuments =
  (deps: DocumentWorkflowDeps) =>
  (
    input: ListAllDocumentsInput
  ): Effect.Effect<PaginatedDocumentsResponse, ForbiddenError | Error> =>
    pipe(
      S.decodeUnknown(DocumentDTOs.ListAllDocumentsQuery)(input),
      Effect.mapError(
        (e) => new Error(`Invalid input for listAllDocuments: ${e}`)
      ),
      Effect.flatMap((query) =>
        pipe(
          deps.userRepo.findById(query.userId),
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.fail(
                  new ForbiddenError({
                    message: "User not found",
                    resource: "documents",
                  })
                ),
              onSome: (user) =>
                isAdmin(user)
                  ? pipe(
                      deps.documentRepo.listAll({
                        page: query.page ?? 1,
                        limit: query.limit ?? 20,
                      }),
                      Effect.map((result) => ({
                        documents: result.data.map(
                          DocumentResponseMapper.toDocumentWithVersionResponse
                        ),
                        total: result.meta.totalItems,
                        page: result.meta.page,
                        limit: result.meta.limit,
                        totalPages: result.meta.totalPages,
                        hasNextPage: result.meta.hasNextPage,
                        hasPreviousPage: result.meta.hasPreviousPage,
                      })),
                      Effect.mapError((e) =>
                        e instanceof Error ? e : new Error(String(e))
                      )
                    )
                  : Effect.fail(
                      new ForbiddenError({
                        message: "Admin access required",
                        resource: "documents",
                      })
                    ),
            })
          )
        )
      )
    );

/**
 * Search documents
 */
export const searchDocuments =
  (deps: DocumentWorkflowDeps) =>
  (
    input: SearchDocumentsInput
  ): Effect.Effect<SearchDocumentsResponse, Error> =>
    pipe(
      S.decodeUnknown(DocumentDTOs.SearchDocumentsQuery)(input),
      Effect.mapError(
        (e) => new Error(`Invalid input for searchDocuments: ${e}`)
      ),
      Effect.flatMap((query) =>
        pipe(
          deps.documentRepo.search(query.query, {
            page: query.page ?? 1,
            limit: query.limit ?? 20,
          }),
          Effect.map((result) => ({
            results: result.data.map(DocumentResponseMapper.toDocumentResponse),
            total: result.meta.totalItems,
            page: result.meta.page,
            limit: result.meta.limit,
            totalPages: result.meta.totalPages,
            hasNextPage: result.meta.hasNextPage,
            hasPreviousPage: result.meta.hasPreviousPage,
          })),
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          )
        )
      )
    );

/**
 * Delete document (and all versions)
 */
export const deleteDocument =
  (deps: DocumentWorkflowDeps) =>
  (
    input: DeleteDocumentInput
  ): Effect.Effect<void, NotFoundError | InsufficientPermissionError | Error> =>
    pipe(
      S.decodeUnknown(DocumentDTOs.DeleteDocumentCommand)(input),
      Effect.mapError(
        (e) => new Error(`Invalid input for deleteDocument: ${e}`)
      ),
      Effect.flatMap((command) =>
        pipe(
          Effect.all({
            document: pipe(
              deps.documentRepo.findById(command.documentId),
              Effect.flatMap(
                Option.match({
                  onNone: () =>
                    Effect.fail(
                      new NotFoundError({
                        entityType: "Document",
                        id: command.documentId,
                      })
                    ),
                  onSome: Effect.succeed,
                })
              )
            ),
            user: pipe(
              deps.userRepo.findById(command.userId),
              Effect.flatMap(
                Option.match({
                  onNone: () =>
                    Effect.fail(
                      new NotFoundError({
                        entityType: "User",
                        id: command.userId,
                      })
                    ),
                  onSome: Effect.succeed,
                })
              )
            ),
            permissions: deps.permissionRepo.findByDocument(command.documentId),
          }),
          Effect.flatMap(({ document, user, permissions }) =>
            pipe(
              requireDeletePermission(user, document, permissions),
              Effect.flatMap(() =>
                pipe(
                  // Add audit log before deletion
                  deps.documentRepo.addAudit(
                    document.id,
                    "deleted",
                    command.userId,
                    Option.none()
                  ),
                  Effect.flatMap(() =>
                    Effect.all(
                      document.versions.map((version) =>
                        pipe(
                          version.path,
                          Option.match({
                            onNone: () => Effect.void,
                            onSome: (path) =>
                              deps.storageService.deleteFile(path),
                          })
                        )
                      )
                    )
                  ),
                  Effect.flatMap(() => deps.documentRepo.delete(document.id))
                )
              )
            )
          ),
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          )
        )
      )
    );
