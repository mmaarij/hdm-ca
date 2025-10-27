import { Effect, Option, Layer } from "effect";
import { eq, and } from "drizzle-orm";
import {
  MetadataRepository,
  MetadataRepositoryTag,
} from "../../domain/metedata/repository";
import {
  DocumentMetadata,
  CreateMetadataPayload,
  UpdateMetadataPayload,
  MetadataId,
} from "../../domain/metedata/entity";
import {
  MetadataNotFoundError,
  MetadataAlreadyExistsError,
  MetadataConstraintError,
  MetadataDomainError,
} from "../../domain/metedata/errors";
import { DrizzleService } from "../services/drizzle-service";
import { documentMetadata } from "../models";
import { v4 as uuid } from "uuid";
import { detectDbConstraint } from "../../domain/shared/base.repository";
import { DocumentId } from "../../domain/refined/uuid";

/**
 * Metadata Repository Implementation using Drizzle ORM
 */
export const MetadataRepositoryLive = Layer.effect(
  MetadataRepositoryTag,
  Effect.gen(function* () {
    const { db } = yield* DrizzleService;

    const create: MetadataRepository["create"] = (payload) =>
      Effect.gen(function* () {
        const id = payload.id || (uuid() as MetadataId);

        yield* Effect.tryPromise({
          try: () =>
            db.insert(documentMetadata).values({
              id,
              documentId: payload.documentId,
              key: payload.key,
              value: payload.value,
            }),
          catch: (error) => {
            const constraintType = detectDbConstraint(error);
            if (constraintType === "unique") {
              return new MetadataAlreadyExistsError({
                documentId: payload.documentId,
                key: payload.key,
                message: "Metadata key already exists for this document",
              });
            }
            return new MetadataConstraintError({
              message: "Database constraint violation",
            });
          },
        });

        const metadata = yield* Effect.tryPromise({
          try: () =>
            db.query.documentMetadata.findFirst({
              where: eq(documentMetadata.id, id),
            }),
          catch: () =>
            new MetadataNotFoundError({
              metadataId: id,
              message: "Metadata was created but could not be retrieved",
            }),
        });

        if (!metadata) {
          return yield* Effect.fail(
            new MetadataNotFoundError({
              metadataId: id,
              message: "Metadata not found after creation",
            })
          );
        }

        return metadata as unknown as DocumentMetadata;
      });

    const findById: MetadataRepository["findById"] = (id) =>
      Effect.gen(function* () {
        const metadata = yield* Effect.tryPromise({
          try: () =>
            db.query.documentMetadata.findFirst({
              where: eq(documentMetadata.id, id),
            }),
          catch: () =>
            new MetadataConstraintError({ message: "Database error" }),
        });

        return Option.fromNullable(metadata as unknown as DocumentMetadata);
      });

    const findByDocumentAndKey: MetadataRepository["findByDocumentAndKey"] = (
      documentId,
      key
    ) =>
      Effect.gen(function* () {
        const metadata = yield* Effect.tryPromise({
          try: () =>
            db.query.documentMetadata.findFirst({
              where: and(
                eq(documentMetadata.documentId, documentId),
                eq(documentMetadata.key, key)
              ),
            }),
          catch: () =>
            new MetadataConstraintError({ message: "Database error" }),
        });

        return Option.fromNullable(metadata as unknown as DocumentMetadata);
      });

    const findByDocument: MetadataRepository["findByDocument"] = (documentId) =>
      Effect.gen(function* () {
        const metadata = yield* Effect.tryPromise({
          try: () =>
            db.query.documentMetadata.findMany({
              where: eq(documentMetadata.documentId, documentId),
            }),
          catch: () =>
            new MetadataConstraintError({ message: "Database error" }),
        });

        return metadata as unknown as readonly DocumentMetadata[];
      });

    const update: MetadataRepository["update"] = (id, payload) =>
      Effect.gen(function* () {
        yield* Effect.tryPromise({
          try: () =>
            db
              .update(documentMetadata)
              .set({ value: payload.value })
              .where(eq(documentMetadata.id, id)),
          catch: (error) => {
            return new MetadataConstraintError({
              message: "Database constraint violation",
            });
          },
        });

        const updated = yield* Effect.tryPromise({
          try: () =>
            db.query.documentMetadata.findFirst({
              where: eq(documentMetadata.id, id),
            }),
          catch: () =>
            new MetadataNotFoundError({
              metadataId: id,
              message: "Metadata not found",
            }),
        });

        if (!updated) {
          return yield* Effect.fail(
            new MetadataNotFoundError({
              metadataId: id,
              message: "Metadata not found",
            })
          );
        }

        return updated as unknown as DocumentMetadata;
      });

    const deleteMetadata: MetadataRepository["delete"] = (id) =>
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise({
          try: () =>
            db.delete(documentMetadata).where(eq(documentMetadata.id, id)),
          catch: () =>
            new MetadataConstraintError({ message: "Database error" }),
        });

        if (!(result as any).changes && !(result as any).rowCount) {
          return yield* Effect.fail(
            new MetadataNotFoundError({
              metadataId: id,
              message: "Metadata not found",
            })
          );
        }
      });

    const deleteByDocument: MetadataRepository["deleteByDocument"] = (
      documentId
    ) =>
      Effect.gen(function* () {
        yield* Effect.tryPromise({
          try: () =>
            db
              .delete(documentMetadata)
              .where(eq(documentMetadata.documentId, documentId)),
          catch: () =>
            new MetadataConstraintError({ message: "Database error" }),
        });
      });

    const deleteByDocumentAndKey: MetadataRepository["deleteByDocumentAndKey"] =
      (documentId, key) =>
        Effect.gen(function* () {
          yield* Effect.tryPromise({
            try: () =>
              db
                .delete(documentMetadata)
                .where(
                  and(
                    eq(documentMetadata.documentId, documentId),
                    eq(documentMetadata.key, key)
                  )
                ),
            catch: () =>
              new MetadataConstraintError({ message: "Database error" }),
          });
        });

    return {
      create,
      findById,
      findByDocumentAndKey,
      findByDocument,
      update,
      delete: deleteMetadata,
      deleteByDocument,
      deleteByDocumentAndKey,
    } satisfies MetadataRepository;
  })
);
