/**
 * Metadata Workflow
 *
 * Orchestrates metadata-related use cases.
 * Handles metadata CRUD with permission checks.
 */

import { Effect, Option, Context, Layer } from "effect";
import { MetadataRepositoryTag } from "../../domain/metedata/repository";
import { DocumentRepositoryTag } from "../../domain/document/repository";
import { UserRepositoryTag } from "../../domain/user/repository";
import { PermissionRepositoryTag } from "../../domain/permission/repository";
import { NotFoundError } from "../../domain/shared/base.errors";
import {
  InsufficientPermissionError,
  DuplicateMetadataKeyError,
} from "../utils/errors";
import { withUseCaseLogging } from "../utils/logging";
import { canWrite } from "../../domain/permission/access-service";
import { UserId, DocumentId } from "../../domain/refined/uuid";
import { MetadataId } from "../../domain/metedata/entity";
import type {
  AddMetadataCommand,
  UpdateMetadataCommand,
  DeleteMetadataCommand,
  ListMetadataQuery,
  GetMetadataByKeyQuery,
} from "../dtos/metedata/request.dto";
import type {
  MetadataResponse,
  ListMetadataResponse,
} from "../dtos/metedata/response.dto";

/**
 * Metadata Workflow Interface
 */
export interface MetadataWorkflow {
  /**
   * Add metadata to a document
   */
  readonly addMetadata: (
    command: AddMetadataCommand
  ) => Effect.Effect<
    MetadataResponse,
    | NotFoundError
    | InsufficientPermissionError
    | DuplicateMetadataKeyError
    | Error
  >;

  /**
   * Update metadata
   */
  readonly updateMetadata: (
    command: UpdateMetadataCommand
  ) => Effect.Effect<
    MetadataResponse,
    NotFoundError | InsufficientPermissionError | Error
  >;

  /**
   * Delete metadata
   */
  readonly deleteMetadata: (
    command: DeleteMetadataCommand
  ) => Effect.Effect<void, NotFoundError | InsufficientPermissionError | Error>;

  /**
   * List all metadata for a document
   */
  readonly listMetadata: (
    query: ListMetadataQuery
  ) => Effect.Effect<
    ListMetadataResponse,
    NotFoundError | InsufficientPermissionError | Error
  >;

  /**
   * Get metadata by key
   */
  readonly getMetadataByKey: (
    query: GetMetadataByKeyQuery
  ) => Effect.Effect<
    MetadataResponse,
    NotFoundError | InsufficientPermissionError | Error
  >;
}

export const MetadataWorkflowTag = Context.GenericTag<MetadataWorkflow>(
  "@app/MetadataWorkflow"
);

/**
 * Live implementation of MetadataWorkflow
 */
export const MetadataWorkflowLive = Layer.effect(
  MetadataWorkflowTag,
  Effect.gen(function* () {
    const metadataRepo = yield* MetadataRepositoryTag;
    const documentRepo = yield* DocumentRepositoryTag;
    const userRepo = yield* UserRepositoryTag;
    const permissionRepo = yield* PermissionRepositoryTag;

    const addMetadata: MetadataWorkflow["addMetadata"] = (command) =>
      withUseCaseLogging(
        "AddMetadata",
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
          const permissions = yield* permissionRepo.findByDocument(
            command.documentId
          );

          if (!canWrite(user, document, permissions)) {
            return yield* Effect.fail(
              new InsufficientPermissionError({
                message: "Insufficient permission to add metadata",
                requiredPermission: "WRITE",
                resource: `Document:${command.documentId}`,
              })
            );
          }

          // Check for duplicate key
          const existingMetadata = yield* metadataRepo.findByDocumentAndKey(
            command.documentId,
            command.key
          );

          if (Option.isSome(existingMetadata)) {
            return yield* Effect.fail(
              new DuplicateMetadataKeyError({
                message: `Metadata with key "${command.key}" already exists for this document`,
                key: command.key,
                documentId: command.documentId,
              })
            );
          }

          // Create metadata
          const metadata = yield* metadataRepo.create({
            documentId: command.documentId,
            key: command.key,
            value: command.value,
          });

          // Add audit log
          yield* documentRepo.addAudit({
            documentId: command.documentId,
            action: "metadata_added",
            performedBy: command.userId,
            details: `Metadata key "${command.key}" added`,
          });

          return {
            id: metadata.id,
            documentId: metadata.documentId,
            key: metadata.key,
            value: metadata.value,
            createdAt: metadata.createdAt,
          };
        }),
        { documentId: command.documentId, userId: command.userId }
      );

    const updateMetadata: MetadataWorkflow["updateMetadata"] = (command) =>
      withUseCaseLogging(
        "UpdateMetadata",
        Effect.gen(function* () {
          // Get metadata
          const metadataOpt = yield* metadataRepo.findById(command.metadataId);
          if (Option.isNone(metadataOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "Metadata",
                id: command.metadataId,
                message: `Metadata with ID ${command.metadataId} not found`,
              })
            );
          }

          const metadata = metadataOpt.value;

          // Verify document exists
          const documentOpt = yield* documentRepo.findDocument(
            metadata.documentId
          );
          if (Option.isNone(documentOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "Document",
                id: metadata.documentId,
                message: `Document with ID ${metadata.documentId} not found`,
              })
            );
          }

          const document = documentOpt.value;

          // Verify user has write permission
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
          const permissions = yield* permissionRepo.findByDocument(
            metadata.documentId
          );

          if (!canWrite(user, document, permissions)) {
            return yield* Effect.fail(
              new InsufficientPermissionError({
                message: "Insufficient permission to update metadata",
                requiredPermission: "WRITE",
                resource: `Document:${metadata.documentId}`,
              })
            );
          }

          // Update metadata
          const updatedMetadata = yield* metadataRepo.update(
            command.metadataId,
            {
              value: command.value,
            }
          );

          // Add audit log
          yield* documentRepo.addAudit({
            documentId: metadata.documentId,
            action: "metadata_updated",
            performedBy: command.userId,
            details: `Metadata key "${metadata.key}" updated`,
          });

          return {
            id: updatedMetadata.id,
            documentId: updatedMetadata.documentId,
            key: updatedMetadata.key,
            value: updatedMetadata.value,
            createdAt: updatedMetadata.createdAt,
          };
        }),
        { metadataId: command.metadataId, userId: command.userId }
      );

    const deleteMetadata: MetadataWorkflow["deleteMetadata"] = (command) =>
      withUseCaseLogging(
        "DeleteMetadata",
        Effect.gen(function* () {
          // Get metadata
          const metadataOpt = yield* metadataRepo.findById(command.metadataId);
          if (Option.isNone(metadataOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "Metadata",
                id: command.metadataId,
                message: `Metadata with ID ${command.metadataId} not found`,
              })
            );
          }

          const metadata = metadataOpt.value;

          // Verify document exists
          const documentOpt = yield* documentRepo.findDocument(
            metadata.documentId
          );
          if (Option.isNone(documentOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "Document",
                id: metadata.documentId,
                message: `Document with ID ${metadata.documentId} not found`,
              })
            );
          }

          const document = documentOpt.value;

          // Verify user has write permission
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
          const permissions = yield* permissionRepo.findByDocument(
            metadata.documentId
          );

          if (!canWrite(user, document, permissions)) {
            return yield* Effect.fail(
              new InsufficientPermissionError({
                message: "Insufficient permission to delete metadata",
                requiredPermission: "WRITE",
                resource: `Document:${metadata.documentId}`,
              })
            );
          }

          // Delete metadata
          yield* metadataRepo.delete(command.metadataId);

          // Add audit log
          yield* documentRepo.addAudit({
            documentId: metadata.documentId,
            action: "metadata_deleted",
            performedBy: command.userId,
            details: `Metadata key "${metadata.key}" deleted`,
          });
        }),
        { metadataId: command.metadataId, userId: command.userId }
      );

    const listMetadata: MetadataWorkflow["listMetadata"] = (query) =>
      withUseCaseLogging(
        "ListMetadata",
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

          // Verify user has at least read permission
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

          // Import canRead from access service
          const { canRead } = yield* Effect.promise(
            () => import("../../domain/permission/access-service")
          );

          if (!canRead(user, document, permissions)) {
            return yield* Effect.fail(
              new InsufficientPermissionError({
                message: "Insufficient permission to view metadata",
                requiredPermission: "READ",
                resource: `Document:${query.documentId}`,
              })
            );
          }

          // Get metadata
          const metadata = yield* metadataRepo.findByDocument(query.documentId);

          return {
            metadata: metadata.map((m) => ({
              id: m.id,
              documentId: m.documentId,
              key: m.key,
              value: m.value,
              createdAt: m.createdAt,
            })),
            total: metadata.length,
          };
        }),
        { documentId: query.documentId, userId: query.userId }
      );

    const getMetadataByKey: MetadataWorkflow["getMetadataByKey"] = (query) =>
      withUseCaseLogging(
        "GetMetadataByKey",
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

          // Verify user has at least read permission
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

          // Import canRead from access service
          const { canRead } = yield* Effect.promise(
            () => import("../../domain/permission/access-service")
          );

          if (!canRead(user, document, permissions)) {
            return yield* Effect.fail(
              new InsufficientPermissionError({
                message: "Insufficient permission to view metadata",
                requiredPermission: "READ",
                resource: `Document:${query.documentId}`,
              })
            );
          }

          // Get metadata by key
          const metadataOpt = yield* metadataRepo.findByDocumentAndKey(
            query.documentId,
            query.key
          );

          if (Option.isNone(metadataOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "Metadata",
                id: `${query.documentId}:${query.key}`,
                message: `Metadata with key "${query.key}" not found for document ${query.documentId}`,
              })
            );
          }

          const metadata = metadataOpt.value;

          return {
            id: metadata.id,
            documentId: metadata.documentId,
            key: metadata.key,
            value: metadata.value,
            createdAt: metadata.createdAt,
          };
        }),
        { documentId: query.documentId, key: query.key, userId: query.userId }
      );

    return {
      addMetadata,
      updateMetadata,
      deleteMetadata,
      listMetadata,
      getMetadataByKey,
    } satisfies MetadataWorkflow;
  })
);
