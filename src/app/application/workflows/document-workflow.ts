/**
 * Document Workflow
 *
 * Orchestrates document-related use cases.
 * Simplified single-step upload with automatic versioning.
 */

import { Effect, Option, Context, Layer } from "effect";
import { DocumentRepositoryTag } from "../../domain/document/repository";
import { UserRepositoryTag } from "../../domain/user/repository";
import { PermissionRepositoryTag } from "../../domain/permission/repository";
import { DocumentNotFoundError } from "../../domain/document/errors";
import { NotFoundError, ForbiddenError } from "../../domain/shared/base.errors";
import { InsufficientPermissionError } from "../utils/errors";
import { withUseCaseLogging } from "../utils/logging";
import {
  canRead,
  canWrite,
  canDelete,
  isAdmin,
} from "../../domain/permission/access-service";
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
        Effect.gen(function* () {
          let document;
          let versionNumber = 1;

          // Check if this is an update to existing document
          if (command.documentId) {
            const documentOpt = yield* documentRepo.findDocument(
              command.documentId
            );

            if (Option.isSome(documentOpt)) {
              document = documentOpt.value;

              // Check write permission for updates
              const userOpt = yield* userRepo.findById(command.uploadedBy);
              if (Option.isNone(userOpt)) {
                return yield* Effect.fail(
                  new NotFoundError({
                    entityType: "User",
                    id: command.uploadedBy,
                    message: `User with ID ${command.uploadedBy} not found`,
                  })
                );
              }

              const user = userOpt.value;
              const permissions = yield* permissionRepo.findByDocument(
                command.documentId
              );

              if (!canWrite(user, document, permissions)) {
                return yield* Effect.fail(
                  new InsufficientPermissionError({
                    message: "Insufficient permission to update document",
                    requiredPermission: "WRITE",
                    resource: `Document:${command.documentId}`,
                  })
                );
              }

              // Get next version number
              const latestVersionOpt = yield* documentRepo.getLatestVersion(
                command.documentId
              );
              versionNumber = Option.isSome(latestVersionOpt)
                ? latestVersionOpt.value.versionNumber + 1
                : 1;
            } else {
              // Document ID provided but doesn't exist
              return yield* Effect.fail(
                new NotFoundError({
                  entityType: "Document",
                  id: command.documentId,
                  message: `Document with ID ${command.documentId} not found`,
                })
              );
            }
          }

          // Create document first to get ID (if new document)
          if (!document) {
            // We'll create with temp values and update after storage
            document = yield* documentRepo.createDocument({
              filename: (command.file.name || "untitled") as any,
              originalName: (command.file.name || "untitled") as any,
              mimeType: (command.file.type ||
                "application/octet-stream") as any,
              size: command.file.size as any,
              uploadedBy: command.uploadedBy,
            });
          }

          // Create version record to get version ID
          const version = yield* documentRepo.createVersion({
            documentId: document.id,
            filename: (command.file.name || "untitled") as any,
            originalName: (command.file.name || "untitled") as any,
            mimeType: (command.file.type || "application/octet-stream") as any,
            size: command.file.size as any,
            versionNumber: versionNumber as any,
            uploadedBy: command.uploadedBy,
          });

          // Store file and get accurate metadata (storage layer handles temp files, extraction, cleanup)
          const storedFile = yield* storageService.storeUploadedFile(
            command.file,
            document.id,
            version.id
          );

          // Update version with storage path
          const updatedVersion = yield* documentRepo.updateVersion(version.id, {
            path: storedFile.path as any,
          });

          // Update document with accurate storage info
          const updatedDocument = yield* documentRepo.updateDocument(
            document.id,
            {
              filename: storedFile.filename as any,
              originalName: storedFile.originalName as any,
              path: storedFile.path as any,
            }
          );

          // Add audit log
          yield* documentRepo.addAudit({
            documentId: document.id,
            action: versionNumber === 1 ? "created" : "new_version",
            performedBy: command.uploadedBy,
            details: `Version ${versionNumber} uploaded`,
          });

          return {
            documentId: updatedDocument.id,
            versionId: updatedVersion.id,
            document: {
              id: updatedDocument.id,
              filename: updatedDocument.filename,
              originalName: updatedDocument.originalName,
              mimeType: updatedDocument.mimeType,
              size: updatedDocument.size,
              uploadedBy: updatedDocument.uploadedBy,
              createdAt: updatedDocument.createdAt,
              updatedAt: updatedDocument.updatedAt,
            },
            version: {
              id: updatedVersion.id,
              documentId: updatedVersion.documentId,
              filename: updatedVersion.filename,
              originalName: updatedVersion.originalName,
              mimeType: updatedVersion.mimeType,
              size: updatedVersion.size,
              versionNumber: updatedVersion.versionNumber,
              uploadedBy: updatedVersion.uploadedBy,
              createdAt: updatedVersion.createdAt,
            },
          };
        }),
        { uploadedBy: command.uploadedBy }
      );

    const getDocument: DocumentWorkflow["getDocument"] = (query) =>
      withUseCaseLogging(
        "GetDocument",
        Effect.gen(function* () {
          // Get document
          const documentOpt = yield* documentRepo.findDocument(
            query.documentId
          );
          if (Option.isNone(documentOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "Document",
                id: query.documentId,
                message: `Document with ID ${query.documentId} not found`,
              })
            );
          }

          const document = documentOpt.value;

          // Get user
          const userOpt = yield* userRepo.findById(query.userId);
          if (Option.isNone(userOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "User",
                id: query.userId,
                message: `User with ID ${query.userId} not found`,
              })
            );
          }

          const user = userOpt.value;

          // Check permissions
          const permissions = yield* permissionRepo.findByDocument(
            query.documentId
          );

          if (!canRead(user, document, permissions)) {
            return yield* Effect.fail(
              new InsufficientPermissionError({
                message: "Insufficient permission to access document",
                requiredPermission: "READ",
                resource: `Document:${query.documentId}`,
              })
            );
          }

          // Get latest version
          const latestVersionOpt = yield* documentRepo.getLatestVersion(
            query.documentId
          );

          return {
            document: {
              id: document.id,
              filename: document.filename,
              originalName: document.originalName,
              mimeType: document.mimeType,
              size: document.size,
              uploadedBy: document.uploadedBy,
              createdAt: document.createdAt,
              updatedAt: document.updatedAt,
            },
            latestVersion: Option.isSome(latestVersionOpt)
              ? {
                  id: latestVersionOpt.value.id,
                  documentId: latestVersionOpt.value.documentId,
                  filename: latestVersionOpt.value.filename,
                  originalName: latestVersionOpt.value.originalName,
                  mimeType: latestVersionOpt.value.mimeType,
                  size: latestVersionOpt.value.size,
                  versionNumber: latestVersionOpt.value.versionNumber,
                  uploadedBy: latestVersionOpt.value.uploadedBy,
                  createdAt: latestVersionOpt.value.createdAt,
                }
              : undefined,
          };
        }),
        { userId: query.userId, documentId: query.documentId }
      );

    const getDocumentVersion: DocumentWorkflow["getDocumentVersion"] = (
      query
    ) =>
      withUseCaseLogging(
        "GetDocumentVersion",
        Effect.gen(function* () {
          // Get document
          const documentOpt = yield* documentRepo.findDocument(
            query.documentId
          );
          if (Option.isNone(documentOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "Document",
                id: query.documentId,
                message: `Document with ID ${query.documentId} not found`,
              })
            );
          }

          const document = documentOpt.value;

          // Get user
          const userOpt = yield* userRepo.findById(query.userId);
          if (Option.isNone(userOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "User",
                id: query.userId,
                message: `User with ID ${query.userId} not found`,
              })
            );
          }

          const user = userOpt.value;

          // Check permissions
          const permissions = yield* permissionRepo.findByDocument(
            query.documentId
          );

          if (!canRead(user, document, permissions)) {
            return yield* Effect.fail(
              new InsufficientPermissionError({
                message: "Insufficient permission to access document",
                requiredPermission: "READ",
                resource: `Document:${query.documentId}`,
              })
            );
          }

          // Get specific version
          const versionOpt = yield* documentRepo.findVersionById(
            query.versionId
          );

          if (Option.isNone(versionOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "DocumentVersion",
                id: query.versionId,
                message: `Version with ID ${query.versionId} not found`,
              })
            );
          }

          const version = versionOpt.value;

          // Ensure version belongs to the document
          if (version.documentId !== query.documentId) {
            return yield* Effect.fail(
              new Error("Version does not belong to the specified document")
            );
          }

          return {
            id: version.id,
            documentId: version.documentId,
            filename: version.filename,
            originalName: version.originalName,
            mimeType: version.mimeType,
            size: version.size,
            versionNumber: version.versionNumber,
            uploadedBy: version.uploadedBy,
            createdAt: version.createdAt,
          };
        }),
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
        Effect.gen(function* () {
          // Get document
          const documentOpt = yield* documentRepo.findDocument(documentId);
          if (Option.isNone(documentOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "Document",
                id: documentId,
                message: `Document with ID ${documentId} not found`,
              })
            );
          }

          const document = documentOpt.value;

          // Get user
          const userOpt = yield* userRepo.findById(userId);
          if (Option.isNone(userOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "User",
                id: userId,
                message: `User with ID ${userId} not found`,
              })
            );
          }

          const user = userOpt.value;

          // Check permissions
          const permissions = yield* permissionRepo.findByDocument(documentId);

          if (!canRead(user, document, permissions)) {
            return yield* Effect.fail(
              new InsufficientPermissionError({
                message: "Insufficient permission to access document",
                requiredPermission: "READ",
                resource: `Document:${documentId}`,
              })
            );
          }

          // Get all versions
          const versions = yield* documentRepo.listVersions(documentId);

          return versions.map((v) => ({
            id: v.id,
            documentId: v.documentId,
            filename: v.filename,
            originalName: v.originalName,
            mimeType: v.mimeType,
            size: v.size,
            versionNumber: v.versionNumber,
            uploadedBy: v.uploadedBy,
            createdAt: v.createdAt,
          }));
        }),
        { userId, documentId }
      );

    const listDocuments: DocumentWorkflow["listDocuments"] = (query) =>
      withUseCaseLogging(
        "ListDocuments",
        Effect.gen(function* () {
          const page = query.page ?? 1;
          const limit = query.limit ?? 10;

          const result = yield* documentRepo.listByUser(query.userId, {
            page,
            limit,
          });

          return {
            documents: result.data.map((dwv) => ({
              document: {
                id: dwv.document.id,
                filename: dwv.document.filename,
                originalName: dwv.document.originalName,
                mimeType: dwv.document.mimeType,
                size: dwv.document.size,
                uploadedBy: dwv.document.uploadedBy,
                createdAt: dwv.document.createdAt,
                updatedAt: dwv.document.updatedAt,
              },
              latestVersion: dwv.latestVersion
                ? {
                    id: dwv.latestVersion.id,
                    documentId: dwv.latestVersion.documentId,
                    filename: dwv.latestVersion.filename,
                    originalName: dwv.latestVersion.originalName,
                    mimeType: dwv.latestVersion.mimeType,
                    size: dwv.latestVersion.size,
                    versionNumber: dwv.latestVersion.versionNumber,
                    uploadedBy: dwv.latestVersion.uploadedBy,
                    createdAt: dwv.latestVersion.createdAt,
                  }
                : undefined,
            })),
            total: result.meta.totalItems,
            page: result.meta.page,
            limit: result.meta.limit,
            totalPages: result.meta.totalPages,
            hasNextPage: result.meta.hasNextPage,
            hasPreviousPage: result.meta.hasPreviousPage,
          };
        }),
        { userId: query.userId }
      );

    const listAllDocuments: DocumentWorkflow["listAllDocuments"] = (
      query,
      userId
    ) =>
      withUseCaseLogging(
        "ListAllDocuments",
        Effect.gen(function* () {
          // Check if user is admin
          const userOpt = yield* userRepo.findById(userId);
          if (Option.isNone(userOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "User",
                id: userId,
                message: `User with ID ${userId} not found`,
              })
            );
          }

          const user = userOpt.value;

          if (!isAdmin(user)) {
            return yield* Effect.fail(
              new ForbiddenError({
                message: "Only admins can list all documents",
                resource: "Documents",
              })
            );
          }

          const page = query.page ?? 1;
          const limit = query.limit ?? 10;

          const result = yield* documentRepo.listAll({ page, limit });

          return {
            documents: result.data.map((dwv) => ({
              document: {
                id: dwv.document.id,
                filename: dwv.document.filename,
                originalName: dwv.document.originalName,
                mimeType: dwv.document.mimeType,
                size: dwv.document.size,
                uploadedBy: dwv.document.uploadedBy,
                createdAt: dwv.document.createdAt,
                updatedAt: dwv.document.updatedAt,
              },
              latestVersion: dwv.latestVersion
                ? {
                    id: dwv.latestVersion.id,
                    documentId: dwv.latestVersion.documentId,
                    filename: dwv.latestVersion.filename,
                    originalName: dwv.latestVersion.originalName,
                    mimeType: dwv.latestVersion.mimeType,
                    size: dwv.latestVersion.size,
                    versionNumber: dwv.latestVersion.versionNumber,
                    uploadedBy: dwv.latestVersion.uploadedBy,
                    createdAt: dwv.latestVersion.createdAt,
                  }
                : undefined,
            })),
            total: result.meta.totalItems,
            page: result.meta.page,
            limit: result.meta.limit,
            totalPages: result.meta.totalPages,
            hasNextPage: result.meta.hasNextPage,
            hasPreviousPage: result.meta.hasPreviousPage,
          };
        }),
        { userId }
      );

    const searchDocuments: DocumentWorkflow["searchDocuments"] = (query) =>
      withUseCaseLogging(
        "SearchDocuments",
        Effect.gen(function* () {
          const page = query.page ?? 1;
          const limit = query.limit ?? 10;

          const result = yield* documentRepo.search(query.query, {
            page,
            limit,
          });

          // Filter results by permission
          const userOpt = yield* userRepo.findById(query.userId);
          if (Option.isNone(userOpt)) {
            return {
              results: [],
              total: 0,
              page,
              limit,
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage: false,
            };
          }

          const user = userOpt.value;

          // Filter documents by read permission
          const accessibleResults = [];
          for (const document of result.data) {
            const permissions = yield* permissionRepo.findByDocument(
              document.id
            );

            if (canRead(user, document, permissions)) {
              accessibleResults.push(document);
            }
          }

          return {
            results: accessibleResults.map((doc) => ({
              id: doc.id,
              filename: doc.filename,
              originalName: doc.originalName,
              mimeType: doc.mimeType,
              size: doc.size,
              uploadedBy: doc.uploadedBy,
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt,
            })),
            total: accessibleResults.length,
            page,
            limit,
            totalPages: Math.ceil(accessibleResults.length / limit),
            hasNextPage: page * limit < accessibleResults.length,
            hasPreviousPage: page > 1,
          };
        }),
        { userId: query.userId, query: query.query }
      );

    const deleteDocument: DocumentWorkflow["deleteDocument"] = (command) =>
      withUseCaseLogging(
        "DeleteDocument",
        Effect.gen(function* () {
          // Get document
          const documentOpt = yield* documentRepo.findDocument(
            command.documentId
          );
          if (Option.isNone(documentOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "Document",
                id: command.documentId,
                message: `Document with ID ${command.documentId} not found`,
              })
            );
          }

          const document = documentOpt.value;

          // Get user
          const userOpt = yield* userRepo.findById(command.userId);
          if (Option.isNone(userOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "User",
                id: command.userId,
                message: `User with ID ${command.userId} not found`,
              })
            );
          }

          const user = userOpt.value;

          // Check permissions
          const permissions = yield* permissionRepo.findByDocument(
            command.documentId
          );

          if (!canDelete(user, document, permissions)) {
            return yield* Effect.fail(
              new InsufficientPermissionError({
                message: "Insufficient permission to delete document",
                requiredPermission: "DELETE",
                resource: `Document:${command.documentId}`,
              })
            );
          }

          // Delete all versions' files
          const versions = yield* documentRepo.listVersions(command.documentId);
          for (const version of versions) {
            if (version.path) {
              yield* storageService.deleteFile(version.path);
            }
          }

          // Add audit log before deletion
          yield* documentRepo.addAudit({
            documentId: command.documentId,
            action: "deleted",
            performedBy: command.userId,
            details: "Document and all versions deleted",
          });

          // Delete document (cascade will delete versions and permissions)
          yield* documentRepo.deleteDocument(command.documentId);
        }),
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
