/**
 * Metadata Workflow
 *
 * Orchestrates metadata-related use cases.
 * Handles metadata CRUD with permission checks.
 */

import { Effect, Option, Context, Layer, pipe } from "effect";
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
import { loadEntity, loadEntities } from "../utils/effect-helpers";
import {
  requireReadPermission,
  requireWritePermission,
} from "../../domain/permission/service";
import { DocumentMetadata, MetadataId } from "../../domain/metedata/entity";
import { UserId, DocumentId } from "../../domain/refined/uuid";
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
import { MetadataResponseMapper } from "../mappers/metadata.mapper";

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
        pipe(
          // Load document, user, and existing metadata in parallel
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
            existingMetadata: metadataRepo.findByDocumentAndKey(
              command.documentId,
              command.key
            ),
          }),
          Effect.mapError((e) =>
            "_tag" in e && e._tag === "NotFoundError" ? new NotFoundError(e) : e
          ),
          // Check for duplicate key
          Effect.flatMap(({ document, user, permissions, existingMetadata }) =>
            Option.isSome(existingMetadata)
              ? Effect.fail(
                  new DuplicateMetadataKeyError({
                    message: `Metadata with key "${command.key}" already exists for this document`,
                    key: command.key,
                    documentId: command.documentId,
                  })
                )
              : Effect.succeed({ document, user, permissions })
          ),
          // Check write permission
          Effect.flatMap(({ document, user, permissions }) =>
            pipe(
              requireWritePermission(user, document, permissions),
              Effect.map(() => ({ document, user }))
            )
          ),
          // Create and save metadata
          Effect.flatMap(() => {
            const newMetadata = DocumentMetadata.create({
              documentId: command.documentId,
              key: command.key as any,
              value: command.value as any,
            });
            return metadataRepo.save(newMetadata);
          }),
          // Add audit log
          Effect.tap((metadata) =>
            documentRepo.addAudit(
              command.documentId,
              "metadata_added",
              command.userId,
              Option.some(`Metadata key "${command.key}" added`)
            )
          ),
          // Map to response
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map((metadata) =>
            MetadataResponseMapper.toMetadataResponse(metadata)
          )
        ),
        { documentId: command.documentId, userId: command.userId }
      );

    const updateMetadata: MetadataWorkflow["updateMetadata"] = (command) =>
      withUseCaseLogging(
        "UpdateMetadata",
        pipe(
          // Load metadata first
          loadEntity(
            metadataRepo.findById(command.metadataId),
            "Metadata",
            command.metadataId
          ),
          Effect.mapError((e) =>
            "_tag" in e && e._tag === "NotFoundError" ? new NotFoundError(e) : e
          ),
          // Load document, user, and permissions in parallel
          Effect.flatMap((metadata) =>
            pipe(
              Effect.all({
                document: loadEntity(
                  documentRepo.findById(metadata.documentId),
                  "Document",
                  metadata.documentId
                ),
                user: loadEntity(
                  userRepo.findById(command.userId),
                  "User",
                  command.userId
                ),
                permissions: permissionRepo.findByDocument(metadata.documentId),
              }),
              Effect.mapError((e) =>
                "_tag" in e && e._tag === "NotFoundError"
                  ? new NotFoundError(e)
                  : e
              ),
              Effect.map(({ document, user, permissions }) => ({
                metadata,
                document,
                user,
                permissions,
              }))
            )
          ),
          // Check write permission
          Effect.flatMap(({ metadata, document, user, permissions }) =>
            pipe(
              requireWritePermission(user, document, permissions),
              Effect.map(() => metadata)
            )
          ),
          // Update and save metadata
          Effect.flatMap((metadata) => {
            const updatedMetadata = DocumentMetadata.updateValue(
              metadata,
              command.value as any
            );
            return pipe(
              metadataRepo.save(updatedMetadata),
              Effect.map((saved) => ({ saved, metadata }))
            );
          }),
          // Add audit log
          Effect.tap(({ metadata }) =>
            documentRepo.addAudit(
              metadata.documentId,
              "metadata_updated",
              command.userId,
              Option.some(`Metadata key "${metadata.key}" updated`)
            )
          ),
          // Map to response
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map(({ saved }) =>
            MetadataResponseMapper.toMetadataResponse(saved)
          )
        ),
        { metadataId: command.metadataId, userId: command.userId }
      );

    const deleteMetadata: MetadataWorkflow["deleteMetadata"] = (command) =>
      withUseCaseLogging(
        "DeleteMetadata",
        pipe(
          // Load metadata first
          loadEntity(
            metadataRepo.findById(command.metadataId),
            "Metadata",
            command.metadataId
          ),
          Effect.mapError((e) =>
            "_tag" in e && e._tag === "NotFoundError" ? new NotFoundError(e) : e
          ),
          // Load document, user, and permissions in parallel
          Effect.flatMap((metadata) =>
            pipe(
              Effect.all({
                document: loadEntity(
                  documentRepo.findById(metadata.documentId),
                  "Document",
                  metadata.documentId
                ),
                user: loadEntity(
                  userRepo.findById(command.userId),
                  "User",
                  command.userId
                ),
                permissions: permissionRepo.findByDocument(metadata.documentId),
              }),
              Effect.mapError((e) =>
                "_tag" in e && e._tag === "NotFoundError"
                  ? new NotFoundError(e)
                  : e
              ),
              Effect.map(({ document, user, permissions }) => ({
                metadata,
                document,
                user,
                permissions,
              }))
            )
          ),
          // Check write permission
          Effect.flatMap(({ metadata, document, user, permissions }) =>
            pipe(
              requireWritePermission(user, document, permissions),
              Effect.map(() => metadata)
            )
          ),
          // Delete metadata
          Effect.flatMap((metadata) =>
            pipe(
              metadataRepo.delete(command.metadataId),
              Effect.map(() => metadata)
            )
          ),
          // Add audit log
          Effect.flatMap((metadata) =>
            documentRepo.addAudit(
              metadata.documentId,
              "metadata_deleted",
              command.userId,
              Option.some(`Metadata key "${metadata.key}" deleted`)
            )
          ),
          // Map errors
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          )
        ),
        { metadataId: command.metadataId, userId: command.userId }
      );

    const listMetadata: MetadataWorkflow["listMetadata"] = (query) =>
      withUseCaseLogging(
        "ListMetadata",
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
          // Get metadata
          Effect.flatMap(() => metadataRepo.findByDocument(query.documentId)),
          // Map to response
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map((metadata) =>
            MetadataResponseMapper.toListMetadataResponse(metadata)
          )
        ),
        { documentId: query.documentId, userId: query.userId }
      );

    const getMetadataByKey: MetadataWorkflow["getMetadataByKey"] = (query) =>
      withUseCaseLogging(
        "GetMetadataByKey",
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
          // Get metadata by key
          Effect.flatMap(() =>
            metadataRepo.findByDocumentAndKey(query.documentId, query.key)
          ),
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.fail(
                  new NotFoundError({
                    entityType: "Metadata",
                    id: `${query.documentId}:${query.key}`,
                    message: `Metadata with key "${query.key}" not found for document ${query.documentId}`,
                  })
                ),
              onSome: (metadata: DocumentMetadata) => Effect.succeed(metadata),
            })
          ),
          // Map to response
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map((metadata) =>
            MetadataResponseMapper.toMetadataResponse(metadata)
          )
        ),
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
