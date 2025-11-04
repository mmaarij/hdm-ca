/**
 * Document Workflow
 *
 * Orchestrates document-related use cases.
 * Handles document CRUD operations with permission checking.
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
import { UserId, DocumentId } from "../../domain/refined/uuid";
import type {
  UploadDocumentCommand,
  GetDocumentQuery,
  ListDocumentsQuery,
  ListAllDocumentsQuery,
  SearchDocumentsQuery,
  UpdateDocumentCommand,
  DeleteDocumentCommand,
} from "../dtos/document/request.dto";
import type {
  UploadDocumentResponse,
  DocumentWithVersionResponse,
  PaginatedDocumentsResponse,
  SearchDocumentsResponse,
  DocumentResponse,
} from "../dtos/document/response.dto";

/**
 * Storage Service Interface
 *
 * Abstraction for file storage operations (implementation in infrastructure)
 */
export interface StorageService {
  readonly moveToStorage: (
    tempPath: string,
    filename: string
  ) => Effect.Effect<string, Error>; // Returns final storage path
  readonly deleteFile: (path: string) => Effect.Effect<void, Error>;
}

export const StorageServiceTag = Context.GenericTag<StorageService>(
  "@app/StorageService"
);

/**
 * Document Workflow Interface
 */
export interface DocumentWorkflow {
  /**
   * Upload a new document
   */
  readonly uploadDocument: (
    command: UploadDocumentCommand
  ) => Effect.Effect<UploadDocumentResponse, Error>;

  /**
   * Get document by ID (with permission check)
   */
  readonly getDocument: (
    query: GetDocumentQuery
  ) => Effect.Effect<
    DocumentWithVersionResponse,
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
   * Update document
   */
  readonly updateDocument: (
    command: UpdateDocumentCommand
  ) => Effect.Effect<
    DocumentResponse,
    NotFoundError | InsufficientPermissionError | Error
  >;

  /**
   * Delete document (with permission check)
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
    const storageService = yield* StorageServiceTag;

    const uploadDocument: DocumentWorkflow["uploadDocument"] = (command) =>
      withUseCaseLogging(
        "UploadDocument",
        Effect.gen(function* () {
          // Move file from temp to permanent storage
          const storagePath = yield* storageService.moveToStorage(
            command.path,
            command.filename
          );

          // Create document
          const document = yield* documentRepo.createDocument({
            filename: command.filename,
            originalName: command.originalName,
            mimeType: command.mimeType,
            size: command.size,
            path: storagePath as any,
            uploadedBy: command.uploadedBy,
          });

          // Create initial version (version 1)
          const version = yield* documentRepo.createVersion({
            documentId: document.id,
            filename: command.filename,
            originalName: command.originalName,
            mimeType: command.mimeType,
            size: command.size,
            path: storagePath as any,
            versionNumber: 1 as any,
            uploadedBy: command.uploadedBy,
          });

          // Add audit log
          yield* documentRepo.addAudit({
            documentId: document.id,
            action: "created",
            performedBy: command.uploadedBy,
            details: "Initial upload",
          });

          return {
            documentId: document.id,
            versionId: version.id,
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
            version: {
              id: version.id,
              documentId: version.documentId,
              filename: version.filename,
              originalName: version.originalName,
              mimeType: version.mimeType,
              size: version.size,
              versionNumber: version.versionNumber,
              uploadedBy: version.uploadedBy,
              createdAt: version.createdAt,
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

          // Filter results by permission (user can only see documents they have access to)
          // This is a simplified approach - in production, you'd filter at the DB level
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

          // Filter versions by document access
          const accessibleResults = [];
          for (const version of result.data) {
            const documentOpt = yield* documentRepo.findDocument(
              version.documentId
            );
            if (Option.isNone(documentOpt)) continue;

            const document = documentOpt.value;
            const permissions = yield* permissionRepo.findByDocument(
              version.documentId
            );

            if (canRead(user, document, permissions)) {
              accessibleResults.push(version);
            }
          }

          return {
            results: accessibleResults.map((v) => ({
              id: v.id,
              documentId: v.documentId,
              filename: v.filename,
              originalName: v.originalName,
              mimeType: v.mimeType,
              size: v.size,
              versionNumber: v.versionNumber,
              uploadedBy: v.uploadedBy,
              createdAt: v.createdAt,
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

    const updateDocument: DocumentWorkflow["updateDocument"] = (command) =>
      withUseCaseLogging(
        "UpdateDocument",
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

          if (!canWrite(user, document, permissions)) {
            return yield* Effect.fail(
              new InsufficientPermissionError({
                message: "Insufficient permission to update document",
                requiredPermission: "WRITE",
                resource: `Document:${command.documentId}`,
              })
            );
          }

          // Update document
          const updatePayload: any = {};
          if (command.filename) updatePayload.filename = command.filename;
          if (command.originalName)
            updatePayload.originalName = command.originalName;

          const updatedDocument = yield* documentRepo.updateDocument(
            command.documentId,
            updatePayload
          );

          // Add audit log
          yield* documentRepo.addAudit({
            documentId: command.documentId,
            action: "updated",
            performedBy: command.userId,
            details: "Document metadata updated",
          });

          return {
            id: updatedDocument.id,
            filename: updatedDocument.filename,
            originalName: updatedDocument.originalName,
            mimeType: updatedDocument.mimeType,
            size: updatedDocument.size,
            uploadedBy: updatedDocument.uploadedBy,
            createdAt: updatedDocument.createdAt,
            updatedAt: updatedDocument.updatedAt,
          };
        }),
        { userId: command.userId, documentId: command.documentId }
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

          // Delete file from storage
          yield* storageService.deleteFile(document.path);

          // Delete all versions' files
          const versions = yield* documentRepo.listVersions(command.documentId);
          for (const version of versions) {
            yield* storageService.deleteFile(version.path);
          }

          // Delete document (cascade will delete versions and permissions)
          yield* documentRepo.deleteDocument(command.documentId);

          // Add audit log before deletion
          yield* documentRepo.addAudit({
            documentId: command.documentId,
            action: "deleted",
            performedBy: command.userId,
            details: "Document and all versions deleted",
          });
        }),
        { userId: command.userId, documentId: command.documentId }
      );

    return {
      uploadDocument,
      getDocument,
      listDocuments,
      listAllDocuments,
      searchDocuments,
      updateDocument,
      deleteDocument,
    } satisfies DocumentWorkflow;
  })
);
