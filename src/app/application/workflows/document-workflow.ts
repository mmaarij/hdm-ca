/**
 * Document Workflow
 *
 * Orchestrates document-related use cases.
 * Simplified single-step upload with automatic versioning.
 */

import { Effect, Option, Context, Layer, pipe } from "effect";
import { DocumentRepositoryTag } from "../../domain/document/repository";
import { UserRepositoryTag } from "../../domain/user/repository";
import { PermissionRepositoryTag } from "../../domain/permission/repository";
import { DocumentNotFoundError } from "../../domain/document/errors";
import { NotFoundError, ForbiddenError } from "../../domain/shared/base.errors";
import { InsufficientPermissionError } from "../utils/errors";
import { withUseCaseLogging } from "../utils/logging";
import { loadEntity, loadEntities } from "../utils/effect-helpers";
import { Document, DocumentVersion } from "../../domain/document/entity";
import {
  isAdmin,
  requireReadPermission,
  requireWritePermission,
  requireDeletePermission,
} from "../../domain/permission/service";
import {
  UserId,
  DocumentId,
  DocumentVersionId,
} from "../../domain/refined/uuid";
import { StoragePort, StoragePortTag } from "../ports/storage.port";
import type {
  UploadDocumentCommand,
  GetDocumentQuery,
  ListDocumentsQuery,
  ListAllDocumentsQuery,
  SearchDocumentsQuery,
  DeleteDocumentCommand,
  GetDocumentVersionQuery,
} from "../dtos/document/request.dto";
import type {
  UploadDocumentResponse,
  DocumentWithVersionResponse,
  PaginatedDocumentsResponse,
  SearchDocumentsResponse,
  DocumentResponse,
  DocumentVersionResponse,
} from "../dtos/document/response.dto";
import { DocumentResponseMapper } from "../mappers/document.mapper";

/**
 * Document Workflow Interface
 */
export interface DocumentWorkflow {
  /**
   * Upload a document (creates new or adds version to existing)
   */
  readonly uploadDocument: (
    command: UploadDocumentCommand
  ) => Effect.Effect<UploadDocumentResponse, Error>;

  /**
   * Get document by ID (returns latest version)
   */
  readonly getDocument: (
    query: GetDocumentQuery
  ) => Effect.Effect<
    DocumentWithVersionResponse,
    NotFoundError | InsufficientPermissionError | Error
  >;

  /**
   * Get specific document version
   */
  readonly getDocumentVersion: (
    query: GetDocumentVersionQuery
  ) => Effect.Effect<
    DocumentVersionResponse,
    NotFoundError | InsufficientPermissionError | Error
  >;

  /**
   * List all versions for a document
   */
  readonly listDocumentVersions: (
    documentId: DocumentId,
    userId: UserId
  ) => Effect.Effect<
    readonly DocumentVersionResponse[],
    NotFoundError | InsufficientPermissionError | Error
  >;

  /**
   * List documents accessible to user
   */
  readonly listDocuments: (
    query: ListDocumentsQuery
  ) => Effect.Effect<PaginatedDocumentsResponse, Error>;

  /**
   * List all documents (admin only)
   */
  readonly listAllDocuments: (
    query: ListAllDocumentsQuery,
    userId: UserId
  ) => Effect.Effect<PaginatedDocumentsResponse, ForbiddenError | Error>;

  /**
   * Search documents
   */
  readonly searchDocuments: (
    query: SearchDocumentsQuery
  ) => Effect.Effect<SearchDocumentsResponse, Error>;

  /**
   * Delete document (and all versions)
   */
  readonly deleteDocument: (
    command: DeleteDocumentCommand
  ) => Effect.Effect<void, NotFoundError | InsufficientPermissionError | Error>;
}

export const DocumentWorkflowTag = Context.GenericTag<DocumentWorkflow>(
  "@app/DocumentWorkflow"
);

/**
 * Live implementation of DocumentWorkflow
 */
export const DocumentWorkflowLive = Layer.effect(
  DocumentWorkflowTag,
  Effect.gen(function* () {
    const documentRepo = yield* DocumentRepositoryTag;
    const userRepo = yield* UserRepositoryTag;
    const permissionRepo = yield* PermissionRepositoryTag;
    const storageService = yield* StoragePortTag;

    const uploadDocument: DocumentWorkflow["uploadDocument"] = (command) =>
      withUseCaseLogging(
        "UploadDocument",
        pipe(
          // Check if updating existing document
          command.documentId
            ? pipe(
                documentRepo.findById(command.documentId),
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
                    onSome: (doc: Document) =>
                      pipe(
                        // Load user and permissions for write check
                        Effect.all({
                          user: loadEntity(
                            userRepo.findById(command.uploadedBy),
                            "User",
                            command.uploadedBy
                          ),
                          permissions: permissionRepo.findByDocument(
                            command.documentId!
                          ),
                        }),
                        Effect.mapError((e) =>
                          "_tag" in e && e._tag === "NotFoundError"
                            ? new NotFoundError(e)
                            : e
                        ),
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
            : Effect.succeed({
                document: Document.create({
                  filename: (command.file.name || "untitled") as any,
                  originalName: (command.file.name || "untitled") as any,
                  mimeType: (command.file.type ||
                    "application/octet-stream") as any,
                  size: command.file.size as any,
                  uploadedBy: command.uploadedBy,
                }),
                isNewDocument: true,
              }),
          // Create temporary version for storage
          Effect.map(({ document, isNewDocument }) => {
            const tempVersion = DocumentVersion.create({
              documentId: document.id,
              filename: (command.file.name || "untitled") as any,
              originalName: (command.file.name || "untitled") as any,
              mimeType: (command.file.type ||
                "application/octet-stream") as any,
              size: command.file.size as any,
              versionNumber: (document.versions.length + 1) as any,
              uploadedBy: command.uploadedBy,
            });
            return { document, isNewDocument, tempVersion };
          }),
          // Store file
          Effect.flatMap(({ document, isNewDocument, tempVersion }) =>
            pipe(
              storageService.storeUploadedFile(
                command.file,
                document.id,
                tempVersion.id
              ),
              Effect.map((storedFile) => ({
                document,
                isNewDocument,
                storedFile,
              }))
            )
          ),
          // Add version to document
          Effect.map(({ document, isNewDocument, storedFile }) => {
            const documentWithVersion = Document.addVersion(document, {
              filename: storedFile.filename as any,
              originalName: storedFile.originalName as any,
              mimeType: (command.file.type ||
                "application/octet-stream") as any,
              size: command.file.size as any,
              uploadedBy: command.uploadedBy,
              path: storedFile.path as any,
              contentRef: storedFile.path as any,
              checksum: undefined,
            });
            return { documentWithVersion, isNewDocument };
          }),
          // Save document
          Effect.flatMap(({ documentWithVersion, isNewDocument }) =>
            pipe(
              documentRepo.save(documentWithVersion),
              Effect.map((savedDocument) => ({ savedDocument, isNewDocument }))
            )
          ),
          // Add audit log
          Effect.tap(({ savedDocument, isNewDocument }) => {
            const latestVersionOpt = Document.getLatestVersion(savedDocument);
            const latestVersion = Option.getOrThrow(latestVersionOpt);
            return documentRepo.addAudit(
              savedDocument.id,
              isNewDocument ? "created" : "new_version",
              command.uploadedBy,
              Option.some(`Version ${latestVersion.versionNumber} uploaded`)
            );
          }),
          // Map to response
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map(({ savedDocument }) => {
            const latestVersionOpt = Document.getLatestVersion(savedDocument);
            const latestVersion = Option.getOrThrow(latestVersionOpt);

            return DocumentResponseMapper.toUploadDocumentResponse(
              savedDocument,
              latestVersion
            );
          })
        ),
        { uploadedBy: command.uploadedBy }
      );

    const getDocument: DocumentWorkflow["getDocument"] = (query) =>
      withUseCaseLogging(
        "GetDocument",
        pipe(
          // Load document, user, and permissions in parallel
          Effect.all({
            document: loadEntity(
              documentRepo.findById(query.documentId),
              "Document",
              query.documentId
            ),
            user: loadEntity(
              userRepo.findById(query.userId),
              "User",
              query.userId
            ),
            permissions: permissionRepo.findByDocument(query.documentId),
          }),
          Effect.mapError((e) =>
            "_tag" in e && e._tag === "NotFoundError" ? new NotFoundError(e) : e
          ),
          // Check read permission
          Effect.flatMap(({ document, user, permissions }) =>
            pipe(
              requireReadPermission(user, document, permissions),
              Effect.map(() => document)
            )
          ),
          // Map to response
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map((document) =>
            DocumentResponseMapper.toDocumentWithVersionResponse(document)
          )
        ),
        { userId: query.userId, documentId: query.documentId }
      );

    const getDocumentVersion: DocumentWorkflow["getDocumentVersion"] = (
      query
    ) =>
      withUseCaseLogging(
        "GetDocumentVersion",
        pipe(
          // Load document, user, and permissions in parallel
          Effect.all({
            document: loadEntity(
              documentRepo.findById(query.documentId),
              "Document",
              query.documentId
            ),
            user: loadEntity(
              userRepo.findById(query.userId),
              "User",
              query.userId
            ),
            permissions: permissionRepo.findByDocument(query.documentId),
          }),
          Effect.mapError((e) =>
            "_tag" in e && e._tag === "NotFoundError" ? new NotFoundError(e) : e
          ),
          // Check read permission
          Effect.flatMap(({ document, user, permissions }) =>
            pipe(
              requireReadPermission(user, document, permissions),
              Effect.map(() => document)
            )
          ),
          // Find version
          Effect.flatMap((document) => {
            const versionOpt = Option.fromNullable(
              document.versions.find((v) => v.id === query.versionId)
            );
            return pipe(
              versionOpt,
              Option.match({
                onNone: () =>
                  Effect.fail(
                    new NotFoundError({
                      entityType: "DocumentVersion",
                      id: query.versionId,
                      message: `Version with ID ${query.versionId} not found`,
                    })
                  ),
                onSome: (version: DocumentVersion) => Effect.succeed(version),
              })
            );
          }),
          // Map to response
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map((version) =>
            DocumentResponseMapper.toVersionResponse(version)
          )
        ),
        {
          userId: query.userId,
          documentId: query.documentId,
          versionId: query.versionId,
        }
      );

    const listDocumentVersions: DocumentWorkflow["listDocumentVersions"] = (
      documentId,
      userId
    ) =>
      withUseCaseLogging(
        "ListDocumentVersions",
        pipe(
          // Load document, user, and permissions in parallel
          Effect.all({
            document: loadEntity(
              documentRepo.findById(documentId),
              "Document",
              documentId
            ),
            user: loadEntity(userRepo.findById(userId), "User", userId),
            permissions: permissionRepo.findByDocument(documentId),
          }),
          Effect.mapError((e) =>
            "_tag" in e && e._tag === "NotFoundError" ? new NotFoundError(e) : e
          ),
          // Check read permission
          Effect.flatMap(({ document, user, permissions }) =>
            pipe(
              requireReadPermission(user, document, permissions),
              Effect.map(() => document)
            )
          ),
          // Map to response
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map((document) => {
            const versions = Document.getAllVersions(document);
            return versions.map(DocumentResponseMapper.toVersionResponse);
          })
        ),
        { documentId, userId }
      );

    const listDocuments: DocumentWorkflow["listDocuments"] = (query) =>
      withUseCaseLogging(
        "ListDocuments",
        pipe(
          // List documents for user
          documentRepo.listByUser(query.userId, {
            page: query.page ?? 1,
            limit: query.limit ?? 10,
          }),
          // Map to response
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map((result) => ({
            documents: result.data.map((dwv) =>
              DocumentResponseMapper.toDocumentWithVersionResponse(dwv)
            ),
            total: result.meta.totalItems,
            page: result.meta.page,
            limit: result.meta.limit,
            totalPages: result.meta.totalPages,
            hasNextPage: result.meta.hasNextPage,
            hasPreviousPage: result.meta.hasPreviousPage,
          }))
        ),
        { userId: query.userId }
      );

    const listAllDocuments: DocumentWorkflow["listAllDocuments"] = (
      query,
      userId
    ) =>
      withUseCaseLogging(
        "ListAllDocuments",
        pipe(
          // Check if user is admin
          loadEntity(userRepo.findById(userId), "User", userId),
          Effect.mapError((e) =>
            "_tag" in e && e._tag === "NotFoundError" ? new NotFoundError(e) : e
          ),
          Effect.flatMap((user) =>
            isAdmin(user)
              ? Effect.succeed(user)
              : Effect.fail(
                  new ForbiddenError({
                    message: "Only admins can list all documents",
                    resource: "Documents",
                  })
                )
          ),
          // List all documents
          Effect.flatMap(() =>
            documentRepo.listAll({
              page: query.page ?? 1,
              limit: query.limit ?? 10,
            })
          ),
          // Map to response
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map((result) => ({
            documents: result.data.map((dwv) =>
              DocumentResponseMapper.toDocumentWithVersionResponse(dwv)
            ),
            total: result.meta.totalItems,
            page: result.meta.page,
            limit: result.meta.limit,
            totalPages: result.meta.totalPages,
            hasNextPage: result.meta.hasNextPage,
            hasPreviousPage: result.meta.hasPreviousPage,
          }))
        ),
        { userId }
      );

    const searchDocuments: DocumentWorkflow["searchDocuments"] = (query) =>
      withUseCaseLogging(
        "SearchDocuments",
        pipe(
          // Load user first
          userRepo.findById(query.userId),
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.succeed({
                  results: [],
                  total: 0,
                  page: query.page ?? 1,
                  limit: query.limit ?? 10,
                  totalPages: 0,
                  hasNextPage: false,
                  hasPreviousPage: false,
                }),
              onSome: (user) =>
                pipe(
                  // Search documents
                  documentRepo.search(query.query, {
                    page: query.page ?? 1,
                    limit: query.limit ?? 10,
                  }),
                  // Filter by permissions
                  Effect.flatMap((result) =>
                    pipe(
                      result.data,
                      Effect.forEach((document) =>
                        pipe(
                          permissionRepo.findByDocument(document.id),
                          Effect.flatMap((permissions) =>
                            pipe(
                              requireReadPermission(
                                user,
                                document,
                                permissions
                              ),
                              Effect.map(() => Option.some(document)),
                              Effect.catchAll(() =>
                                Effect.succeed(Option.none())
                              )
                            )
                          )
                        )
                      ),
                      Effect.map((optionalDocs) => {
                        const accessibleDocs = optionalDocs
                          .filter(Option.isSome)
                          .map((opt) => opt.value);
                        const page = query.page ?? 1;
                        const limit = query.limit ?? 10;
                        return DocumentResponseMapper.toSearchDocumentsResponse(
                          accessibleDocs,
                          accessibleDocs.length,
                          page,
                          limit
                        );
                      })
                    )
                  )
                ),
            })
          ),
          // Map errors
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          )
        ),
        { userId: query.userId, query: query.query }
      );

    const deleteDocument: DocumentWorkflow["deleteDocument"] = (command) =>
      withUseCaseLogging(
        "DeleteDocument",
        pipe(
          // Load document, user, and permissions in parallel
          Effect.all({
            document: loadEntity(
              documentRepo.findById(command.documentId),
              "Document",
              command.documentId
            ),
            user: loadEntity(
              userRepo.findById(command.userId),
              "User",
              command.userId
            ),
            permissions: permissionRepo.findByDocument(command.documentId),
          }),
          Effect.mapError((e) =>
            "_tag" in e && e._tag === "NotFoundError" ? new NotFoundError(e) : e
          ),
          // Check delete permission
          Effect.flatMap(({ document, user, permissions }) =>
            pipe(
              requireDeletePermission(user, document, permissions),
              Effect.map(() => document)
            )
          ),
          // Delete all version files from storage
          Effect.flatMap((document) => {
            const versions = Document.getAllVersions(document);
            return pipe(
              versions,
              Effect.forEach((version) =>
                Option.isSome(version.path)
                  ? storageService.deleteFile(version.path.value)
                  : Effect.succeed(undefined)
              ),
              Effect.map(() => document)
            );
          }),
          // Add audit log
          Effect.tap((document) =>
            documentRepo.addAudit(
              command.documentId,
              "deleted",
              command.userId,
              Option.some("Document and all versions deleted")
            )
          ),
          // Delete document
          Effect.flatMap(() => documentRepo.delete(command.documentId)),
          // Map errors
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          )
        ),
        { userId: command.userId, documentId: command.documentId }
      );

    return {
      uploadDocument,
      getDocument,
      getDocumentVersion,
      listDocumentVersions,
      listDocuments,
      listAllDocuments,
      searchDocuments,
      deleteDocument,
    } satisfies DocumentWorkflow;
  })
);
