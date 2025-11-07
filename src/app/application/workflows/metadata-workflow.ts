/**
 * Metadata Workflow - Functional Pattern
 *
 * Functional workflows using currying pattern.
 * No Effect.gen usage - pure monadic composition with pipe.
 */

import { Effect, Option, pipe } from "effect";
import { v4 as uuidv4 } from "uuid";
import type { MetadataRepository } from "../../domain/metedata/repository";
import type { DocumentRepository } from "../../domain/document/repository";
import type { UserRepository } from "../../domain/user/repository";
import type { PermissionRepository } from "../../domain/permission/repository";
import { NotFoundError } from "../../domain/shared/base.errors";
import {
  InsufficientPermissionError,
  DuplicateMetadataKeyError,
} from "../utils/errors";
import {
  requireReadPermission,
  requireWritePermission,
} from "../../domain/permission/service";
import { loadEntity } from "../utils/effect-helpers";
import {
  DocumentMetadataEntity as DocumentMetadata,
  MetadataId,
} from "../../domain/metedata/entity";
import type { UserId, DocumentId } from "../../domain/refined/uuid";
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

// Re-export WorkflowTag from bootstrap for route compatibility
export { MetadataWorkflowTag } from "../../bootstrap";

/**
 * Dependencies for metadata workflows
 */
export interface MetadataWorkflowDeps {
  readonly metadataRepo: MetadataRepository;
  readonly documentRepo: DocumentRepository;
  readonly userRepo: UserRepository;
  readonly permissionRepo: PermissionRepository;
}

/**
 * Add metadata to a document
 */
export const addMetadata =
  (deps: MetadataWorkflowDeps) =>
  (
    command: AddMetadataCommand
  ): Effect.Effect<
    MetadataResponse,
    | NotFoundError
    | InsufficientPermissionError
    | DuplicateMetadataKeyError
    | Error
  > =>
    pipe(
      Effect.all({
        document: loadEntity(
          deps.documentRepo.findById(command.documentId),
          "Document",
          command.documentId
        ),
        user: loadEntity(
          deps.userRepo.findById(command.userId),
          "User",
          command.userId
        ),
        permissions: deps.permissionRepo.findByDocument(command.documentId),
        existingMetadata: deps.metadataRepo.findByDocumentAndKey(
          command.documentId,
          command.key
        ),
      }),
      Effect.flatMap(({ document, user, permissions, existingMetadata }) =>
        Option.isSome(existingMetadata)
          ? Effect.fail(
              new DuplicateMetadataKeyError({
                message: `Metadata with key '${command.key}' already exists for this document`,
                key: command.key,
                documentId: command.documentId,
              })
            )
          : Effect.succeed({ document, user, permissions })
      ),
      Effect.flatMap(({ document, user, permissions }) =>
        pipe(
          requireWritePermission(user, document, permissions),
          Effect.map(() => ({ document, user }))
        )
      ),
      Effect.flatMap(() =>
        pipe(
          DocumentMetadata.create({
            id: uuidv4() as any,
            documentId: command.documentId,
            key: command.key as any,
            value: command.value as any,
            createdAt: new Date().toISOString() as any,
          }),
          Effect.flatMap((newMetadata) => deps.metadataRepo.save(newMetadata))
        )
      ),
      Effect.tap((metadata) =>
        deps.documentRepo.addAudit(
          command.documentId,
          "metadata_added",
          command.userId,
          Option.some(`Metadata key '${command.key}' added`)
        )
      ),
      Effect.map((metadata) =>
        MetadataResponseMapper.toMetadataResponse(metadata)
      ),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e))))
    );

/**
 * Update metadata
 */
export const updateMetadata =
  (deps: MetadataWorkflowDeps) =>
  (
    command: UpdateMetadataCommand
  ): Effect.Effect<
    MetadataResponse,
    NotFoundError | InsufficientPermissionError | Error
  > =>
    pipe(
      loadEntity(
        deps.metadataRepo.findById(command.metadataId),
        "Metadata",
        command.metadataId
      ),
      Effect.flatMap((metadata) =>
        pipe(
          Effect.all({
            document: loadEntity(
              deps.documentRepo.findById(metadata.documentId),
              "Document",
              metadata.documentId
            ),
            user: loadEntity(
              deps.userRepo.findById(command.userId),
              "User",
              command.userId
            ),
            permissions: deps.permissionRepo.findByDocument(
              metadata.documentId
            ),
          }),
          Effect.map(({ document, user, permissions }) => ({
            metadata,
            document,
            user,
            permissions,
          }))
        )
      ),
      Effect.flatMap(({ metadata, document, user, permissions }) =>
        pipe(
          requireWritePermission(user, document, permissions),
          Effect.map(() => metadata)
        )
      ),
      Effect.flatMap((metadata) => {
        const updatedMetadata = metadata.updateValue(command.value as any);
        return pipe(
          deps.metadataRepo.save(updatedMetadata),
          Effect.map((saved) => ({ saved, metadata }))
        );
      }),
      Effect.tap(({ metadata }) =>
        deps.documentRepo.addAudit(
          metadata.documentId,
          "metadata_updated",
          command.userId,
          Option.some(`Metadata key '${metadata.key}' updated`)
        )
      ),
      Effect.map(({ saved }) =>
        MetadataResponseMapper.toMetadataResponse(saved)
      ),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e))))
    );

/**
 * Delete metadata
 */
export const deleteMetadata =
  (deps: MetadataWorkflowDeps) =>
  (
    command: DeleteMetadataCommand
  ): Effect.Effect<void, NotFoundError | InsufficientPermissionError | Error> =>
    pipe(
      loadEntity(
        deps.metadataRepo.findById(command.metadataId),
        "Metadata",
        command.metadataId
      ),
      Effect.flatMap((metadata) =>
        pipe(
          Effect.all({
            document: loadEntity(
              deps.documentRepo.findById(metadata.documentId),
              "Document",
              metadata.documentId
            ),
            user: loadEntity(
              deps.userRepo.findById(command.userId),
              "User",
              command.userId
            ),
            permissions: deps.permissionRepo.findByDocument(
              metadata.documentId
            ),
          }),
          Effect.map(({ document, user, permissions }) => ({
            metadata,
            document,
            user,
            permissions,
          }))
        )
      ),
      Effect.flatMap(({ metadata, document, user, permissions }) =>
        pipe(
          requireWritePermission(user, document, permissions),
          Effect.map(() => metadata)
        )
      ),
      Effect.flatMap((metadata) =>
        pipe(
          deps.metadataRepo.delete(command.metadataId),
          Effect.map(() => metadata)
        )
      ),
      Effect.flatMap((metadata) =>
        deps.documentRepo.addAudit(
          metadata.documentId,
          "metadata_deleted",
          command.userId,
          Option.some(`Metadata key '${metadata.key}' deleted`)
        )
      ),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e))))
    );

/**
 * List all metadata for a document
 */
export const listMetadata =
  (deps: MetadataWorkflowDeps) =>
  (
    query: ListMetadataQuery
  ): Effect.Effect<
    ListMetadataResponse,
    NotFoundError | InsufficientPermissionError | Error
  > =>
    pipe(
      Effect.all({
        document: loadEntity(
          deps.documentRepo.findById(query.documentId),
          "Document",
          query.documentId
        ),
        user: loadEntity(
          deps.userRepo.findById(query.userId),
          "User",
          query.userId
        ),
        permissions: deps.permissionRepo.findByDocument(query.documentId),
      }),
      Effect.flatMap(({ document, user, permissions }) =>
        pipe(
          requireReadPermission(user, document, permissions),
          Effect.map(() => document)
        )
      ),
      Effect.flatMap(() => deps.metadataRepo.findByDocument(query.documentId)),
      Effect.map((metadata) =>
        MetadataResponseMapper.toListMetadataResponse(metadata)
      ),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e))))
    );

/**
 * Get metadata by key
 */
export const getMetadataByKey =
  (deps: MetadataWorkflowDeps) =>
  (
    query: GetMetadataByKeyQuery
  ): Effect.Effect<
    MetadataResponse,
    NotFoundError | InsufficientPermissionError | Error
  > =>
    pipe(
      Effect.all({
        document: loadEntity(
          deps.documentRepo.findById(query.documentId),
          "Document",
          query.documentId
        ),
        user: loadEntity(
          deps.userRepo.findById(query.userId),
          "User",
          query.userId
        ),
        permissions: deps.permissionRepo.findByDocument(query.documentId),
      }),
      Effect.flatMap(({ document, user, permissions }) =>
        pipe(
          requireReadPermission(user, document, permissions),
          Effect.map(() => document)
        )
      ),
      Effect.flatMap(() =>
        deps.metadataRepo.findByDocumentAndKey(query.documentId, query.key)
      ),
      Effect.flatMap(
        Option.match({
          onNone: () =>
            Effect.fail(
              new NotFoundError({
                entityType: "Metadata",
                id: `${query.documentId}:${query.key}`,
                message: `Metadata with key '${query.key}' not found for document ${query.documentId}`,
              })
            ),
          onSome: (metadata: DocumentMetadata) => Effect.succeed(metadata),
        })
      ),
      Effect.map((metadata) =>
        MetadataResponseMapper.toMetadataResponse(metadata)
      ),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e))))
    );
