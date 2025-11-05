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
import { StoragePort, StoragePortTag } from "../ports/storage.port";
import type {
  UploadDocumentCommand,
  GetDocumentQuery,
  ListDocumentsQuery,
  ListAllDocumentsQuery,
  SearchDocumentsQuery,
  UpdateDocumentCommand,
  DeleteDocumentCommand,
  InitiateUploadCommand,
  ConfirmUploadCommand,
  CreateDocumentMetadataCommand,
  PublishDocumentCommand,
  UnpublishDocumentCommand,
} from "../dtos/document/request.dto";
import type {
  UploadDocumentResponse,
  DocumentWithVersionResponse,
  PaginatedDocumentsResponse,
  SearchDocumentsResponse,
  DocumentResponse,
  InitiateUploadResponse,
  ConfirmUploadResponse,
} from "../dtos/document/response.dto";

/**
 * Document Workflow Interface
 */
export interface DocumentWorkflow {
  /**
   * Initiate two-phase upload (Phase 1: Create document record + pre-signed URL)
   */
  readonly initiateUpload: (
    command: InitiateUploadCommand
  ) => Effect.Effect<InitiateUploadResponse, Error>;

  /**
   * Confirm upload (Phase 2: Verify checksum + persist document)
   */
  readonly confirmUpload: (
    command: ConfirmUploadCommand
  ) => Effect.Effect<
    ConfirmUploadResponse,
    NotFoundError | InsufficientPermissionError | Error
  >;

  /**
   * Create document metadata without immediate file upload
   */
  readonly createDocumentMetadata: (
    command: CreateDocumentMetadataCommand
  ) => Effect.Effect<DocumentResponse, Error>;

  /**
   * Publish document (change status from DRAFT to PUBLISHED)
   */
  readonly publishDocument: (
    command: PublishDocumentCommand
  ) => Effect.Effect<
    DocumentResponse,
    NotFoundError | InsufficientPermissionError | Error
  >;

  /**
   * Unpublish document (change status from PUBLISHED to DRAFT)
   */
  readonly unpublishDocument: (
    command: UnpublishDocumentCommand
  ) => Effect.Effect<
    DocumentResponse,
    NotFoundError | InsufficientPermissionError | Error
  >;

  /**
   * Upload a new document (DEPRECATED - Use two-phase upload instead)
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
    const storageService = yield* StoragePortTag;

    const initiateUpload: DocumentWorkflow["initiateUpload"] = (command) =>
      withUseCaseLogging(
        "InitiateUpload",
        Effect.gen(function* () {
          // Check for duplicate checksum (idempotency)
          const existingVersionOpt = yield* documentRepo.findVersionByChecksum(
            command.checksum
          );

          if (Option.isSome(existingVersionOpt)) {
            // Document with this checksum already exists, return existing record
            const existingVersion = existingVersionOpt.value;
            const documentOpt = yield* documentRepo.findDocument(
              existingVersion.documentId
            );

            if (Option.isSome(documentOpt)) {
              // Return existing upload URL (or indicate upload already complete)
              return {
                documentId: documentOpt.value.id,
                versionId: existingVersion.id,
                uploadUrl: "", // Empty since already uploaded
                checksum: command.checksum,
                expiresAt: new Date() as any, // Already expired
              };
            }
          }

          // Create document in DRAFT status (without file path yet)
          const document = yield* documentRepo.createDocument({
            filename: command.filename,
            originalName: command.originalName,
            mimeType: command.mimeType,
            size: command.size,
            status: "DRAFT" as any,
            uploadedBy: command.uploadedBy,
          });

          // Create initial version (without path/content yet)
          const version = yield* documentRepo.createVersion({
            documentId: document.id,
            filename: command.filename,
            originalName: command.originalName,
            mimeType: command.mimeType,
            size: command.size,
            checksum: command.checksum,
            versionNumber: 1 as any,
            uploadedBy: command.uploadedBy,
          });

          // Generate pre-signed upload URL with document and version IDs
          const { url, contentRef, expiresAt } =
            yield* storageService.generatePresignedUploadUrl(
              command.filename,
              command.mimeType,
              document.id,
              version.id
            );

          // Update version with contentRef
          yield* documentRepo.updateVersion(version.id, {
            contentRef: contentRef as any,
          });

          // Add audit log
          yield* documentRepo.addAudit({
            documentId: document.id,
            action: "upload_initiated",
            performedBy: command.uploadedBy,
            details: `Upload initiated with checksum ${command.checksum}`,
          });

          return {
            documentId: document.id,
            versionId: version.id,
            uploadUrl: url,
            checksum: command.checksum,
            expiresAt: expiresAt as any,
          };
        }),
        { uploadedBy: command.uploadedBy }
      );

    const confirmUpload: DocumentWorkflow["confirmUpload"] = (command) =>
      withUseCaseLogging(
        "ConfirmUpload",
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

          // Check permissions (only uploader can confirm)
          if (document.uploadedBy !== command.userId) {
            return yield* Effect.fail(
              new InsufficientPermissionError({
                message: "Only the uploader can confirm upload",
                requiredPermission: "WRITE",
                resource: `Document:${command.documentId}`,
              })
            );
          }

          // Get latest version and verify checksum
          const latestVersionOpt = yield* documentRepo.getLatestVersion(
            command.documentId
          );

          if (Option.isNone(latestVersionOpt)) {
            return yield* Effect.fail(
              new Error("No version found for document")
            );
          }

          const latestVersion = latestVersionOpt.value;

          if (latestVersion.checksum !== command.checksum) {
            return yield* Effect.fail(
              new Error(
                `Checksum mismatch: expected ${latestVersion.checksum}, got ${command.checksum}`
              )
            );
          }

          // Update document with storage path
          const updatedDocument = yield* documentRepo.updateDocument(
            command.documentId,
            {
              path: command.storagePath,
            }
          );

          // Update version with storage path
          const updatedVersion = yield* documentRepo.updateVersion(
            latestVersion.id,
            {
              path: command.storagePath,
            }
          );

          // Add audit log
          yield* documentRepo.addAudit({
            documentId: command.documentId,
            action: "upload_confirmed",
            performedBy: command.userId,
            details: "Upload confirmed and file persisted",
          });

          return {
            documentId: updatedDocument.id,
            versionId: updatedVersion.id,
            status: updatedDocument.status,
            document: {
              id: updatedDocument.id,
              filename: updatedDocument.filename,
              originalName: updatedDocument.originalName,
              mimeType: updatedDocument.mimeType,
              size: updatedDocument.size,
              status: updatedDocument.status,
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
        { userId: command.userId, documentId: command.documentId }
      );

    const createDocumentMetadata: DocumentWorkflow["createDocumentMetadata"] = (
      command
    ) =>
      withUseCaseLogging(
        "CreateDocumentMetadata",
        Effect.gen(function* () {
          // Create document in DRAFT status without file path
          const document = yield* documentRepo.createDocument({
            filename: command.filename,
            originalName: command.originalName,
            mimeType: command.mimeType,
            size: command.size,
            status: "DRAFT" as any,
            uploadedBy: command.uploadedBy,
          });

          // Add audit log
          yield* documentRepo.addAudit({
            documentId: document.id,
            action: "metadata_created",
            performedBy: command.uploadedBy,
            details: "Document metadata created without file upload",
          });

          return {
            id: document.id,
            filename: document.filename,
            originalName: document.originalName,
            mimeType: document.mimeType,
            size: document.size,
            status: document.status,
            uploadedBy: document.uploadedBy,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
          };
        }),
        { uploadedBy: command.uploadedBy }
      );

    const publishDocument: DocumentWorkflow["publishDocument"] = (command) =>
      withUseCaseLogging(
        "PublishDocument",
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
                message: "Insufficient permission to publish document",
                requiredPermission: "WRITE",
                resource: `Document:${command.documentId}`,
              })
            );
          }

          // Update document status to PUBLISHED
          const updatedDocument = yield* documentRepo.updateDocument(
            command.documentId,
            {
              status: "PUBLISHED" as any,
            }
          );

          // Add audit log
          yield* documentRepo.addAudit({
            documentId: command.documentId,
            action: "published",
            performedBy: command.userId,
            details: "Document published",
          });

          return {
            id: updatedDocument.id,
            filename: updatedDocument.filename,
            originalName: updatedDocument.originalName,
            mimeType: updatedDocument.mimeType,
            size: updatedDocument.size,
            status: updatedDocument.status,
            uploadedBy: updatedDocument.uploadedBy,
            createdAt: updatedDocument.createdAt,
            updatedAt: updatedDocument.updatedAt,
          };
        }),
        { userId: command.userId, documentId: command.documentId }
      );

    const unpublishDocument: DocumentWorkflow["unpublishDocument"] = (
      command
    ) =>
      withUseCaseLogging(
        "UnpublishDocument",
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
                message: "Insufficient permission to unpublish document",
                requiredPermission: "WRITE",
                resource: `Document:${command.documentId}`,
              })
            );
          }

          // Update document status to DRAFT
          const updatedDocument = yield* documentRepo.updateDocument(
            command.documentId,
            {
              status: "DRAFT" as any,
            }
          );

          // Add audit log
          yield* documentRepo.addAudit({
            documentId: command.documentId,
            action: "unpublished",
            performedBy: command.userId,
            details: "Document unpublished",
          });

          return {
            id: updatedDocument.id,
            filename: updatedDocument.filename,
            originalName: updatedDocument.originalName,
            mimeType: updatedDocument.mimeType,
            size: updatedDocument.size,
            status: updatedDocument.status,
            uploadedBy: updatedDocument.uploadedBy,
            createdAt: updatedDocument.createdAt,
            updatedAt: updatedDocument.updatedAt,
          };
        }),
        { userId: command.userId, documentId: command.documentId }
      );

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
            status: "DRAFT" as any,
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
              status: document.status,
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
              status: document.status,
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
                status: dwv.document.status,
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
                status: dwv.document.status,
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
            status: updatedDocument.status,
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

          // Delete file from storage (if exists)
          if (document.path) {
            yield* storageService.deleteFile(document.path);
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
      initiateUpload,
      confirmUpload,
      createDocumentMetadata,
      publishDocument,
      unpublishDocument,
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
