/**
 * Document Version Workflow
 *
 * Orchestrates document version-related use cases.
 */

import { Effect, Option, Context, Layer } from "effect";
import { DocumentRepositoryTag } from "../../domain/document/repository";
import { DocumentServiceTag } from "../../domain/document/service";
import { UserRepositoryTag } from "../../domain/user/repository";
import { PermissionRepositoryTag } from "../../domain/permission/repository";
import { NotFoundError } from "../../domain/shared/base.errors";
import { InsufficientPermissionError } from "../utils/errors";
import { StoragePort, StoragePortTag } from "../ports/storage.port";
import { withUseCaseLogging } from "../utils/logging";
import { canWrite, canRead } from "../../domain/permission/access-service";
import { UserId, DocumentId } from "../../domain/refined/uuid";
import type {
  UploadNewVersionCommand,
  ListVersionsQuery,
  GetVersionQuery,
  GetLatestVersionQuery,
} from "../dtos/document-version/request.dto";
import type {
  UploadNewVersionResponse,
  ListVersionsResponse,
  VersionResponse,
} from "../dtos/document-version/response.dto";

/**
 * Document Version Workflow Interface
 */
export interface DocumentVersionWorkflow {
  /**
   * Upload a new version of a document
   */
  readonly uploadNewVersion: (
    command: UploadNewVersionCommand
  ) => Effect.Effect<
    UploadNewVersionResponse,
    NotFoundError | InsufficientPermissionError | Error
  >;

  /**
   * List all versions of a document
   */
  readonly listVersions: (
    query: ListVersionsQuery
  ) => Effect.Effect<
    ListVersionsResponse,
    NotFoundError | InsufficientPermissionError | Error
  >;

  /**
   * Get a specific version
   */
  readonly getVersion: (
    query: GetVersionQuery
  ) => Effect.Effect<
    VersionResponse,
    NotFoundError | InsufficientPermissionError | Error
  >;

  /**
   * Get the latest version of a document
   */
  readonly getLatestVersion: (
    query: GetLatestVersionQuery
  ) => Effect.Effect<
    VersionResponse,
    NotFoundError | InsufficientPermissionError | Error
  >;
}

export const DocumentVersionWorkflowTag =
  Context.GenericTag<DocumentVersionWorkflow>("@app/DocumentVersionWorkflow");

/**
 * Live implementation of DocumentVersionWorkflow
 */
export const DocumentVersionWorkflowLive = Layer.effect(
  DocumentVersionWorkflowTag,
  Effect.gen(function* () {
    const documentRepo = yield* DocumentRepositoryTag;
    const documentService = yield* DocumentServiceTag;
    const userRepo = yield* UserRepositoryTag;
    const permissionRepo = yield* PermissionRepositoryTag;
    const storageService = yield* StoragePortTag;

    const uploadNewVersion: DocumentVersionWorkflow["uploadNewVersion"] = (
      command
    ) =>
      withUseCaseLogging(
        "UploadNewVersion",
        Effect.gen(function* () {
          // Verify document exists
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

          // Verify user has write permission
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
                message: "Insufficient permission to upload new version",
                requiredPermission: "WRITE",
                resource: `Document:${command.documentId}`,
              })
            );
          }

          // Get next version number
          const latestVersionOpt = yield* documentRepo.getLatestVersion(
            command.documentId
          );
          const versionNumber = Option.isSome(latestVersionOpt)
            ? latestVersionOpt.value.versionNumber + 1
            : 1;

          // Create version record to get version ID (with temp values)
          const tempVersion = yield* documentRepo.createVersion({
            documentId: command.documentId,
            filename: (command.file.name || "untitled") as any,
            originalName: (command.file.name || "untitled") as any,
            mimeType: (command.file.type || "application/octet-stream") as any,
            size: command.file.size as any,
            versionNumber: versionNumber as any,
            uploadedBy: command.uploadedBy,
          });

          // Store file using storage adapter (auto-extracts metadata)
          const storedFile = yield* storageService.storeUploadedFile(
            command.file,
            command.documentId,
            tempVersion.id
          );

          // Update version with accurate storage path
          const version = yield* documentRepo.updateVersion(tempVersion.id, {
            path: storedFile.path as any,
          });

          // Update document's main metadata to reflect latest version
          yield* documentRepo.updateDocument(command.documentId, {
            filename: storedFile.filename as any,
            originalName: storedFile.originalName as any,
          });

          return {
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
            message: `Version ${version.versionNumber} uploaded successfully`,
          };
        }),
        { documentId: command.documentId, uploadedBy: command.uploadedBy }
      ) as Effect.Effect<
        UploadNewVersionResponse,
        NotFoundError | InsufficientPermissionError | Error,
        never
      >;

    const listVersions: DocumentVersionWorkflow["listVersions"] = (query) =>
      withUseCaseLogging(
        "ListVersions",
        Effect.gen(function* () {
          // Verify document exists
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

          // Verify user has read permission
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
          const permissions = yield* permissionRepo.findByDocument(
            query.documentId
          );

          if (!canRead(user, document, permissions)) {
            return yield* Effect.fail(
              new InsufficientPermissionError({
                message: "Insufficient permission to view versions",
                requiredPermission: "READ",
                resource: `Document:${query.documentId}`,
              })
            );
          }

          // Get all versions
          const versions = yield* documentRepo.listVersions(query.documentId);

          return {
            versions: versions.map((v) => ({
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
            total: versions.length,
            documentId: query.documentId,
          };
        }),
        { documentId: query.documentId, userId: query.userId }
      );

    const getVersion: DocumentVersionWorkflow["getVersion"] = (query) =>
      withUseCaseLogging(
        "GetVersion",
        Effect.gen(function* () {
          // Get version
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

          // Verify document exists
          const documentOpt = yield* documentRepo.findDocument(
            version.documentId
          );
          if (Option.isNone(documentOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "Document",
                id: version.documentId,
                message: `Document with ID ${version.documentId} not found`,
              })
            );
          }

          const document = documentOpt.value;

          // Verify user has read permission
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
          const permissions = yield* permissionRepo.findByDocument(
            version.documentId
          );

          if (!canRead(user, document, permissions)) {
            return yield* Effect.fail(
              new InsufficientPermissionError({
                message: "Insufficient permission to view version",
                requiredPermission: "READ",
                resource: `Document:${version.documentId}`,
              })
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
        { versionId: query.versionId, userId: query.userId }
      );

    const getLatestVersion: DocumentVersionWorkflow["getLatestVersion"] = (
      query
    ) =>
      withUseCaseLogging(
        "GetLatestVersion",
        Effect.gen(function* () {
          // Verify document exists
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

          // Verify user has read permission
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
          const permissions = yield* permissionRepo.findByDocument(
            query.documentId
          );

          if (!canRead(user, document, permissions)) {
            return yield* Effect.fail(
              new InsufficientPermissionError({
                message: "Insufficient permission to view latest version",
                requiredPermission: "READ",
                resource: `Document:${query.documentId}`,
              })
            );
          }

          // Get latest version
          const versionOpt = yield* documentRepo.getLatestVersion(
            query.documentId
          );
          if (Option.isNone(versionOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "DocumentVersion",
                id: query.documentId,
                message: `No versions found for document ${query.documentId}`,
              })
            );
          }

          const version = versionOpt.value;

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
        { documentId: query.documentId, userId: query.userId }
      );

    return {
      uploadNewVersion,
      listVersions,
      getVersion,
      getLatestVersion,
    } satisfies DocumentVersionWorkflow;
  })
);
