import { Effect, Option, Layer, pipe } from "effect";
import { eq, and } from "drizzle-orm";
import {
  MetadataRepository,
  MetadataRepositoryTag,
} from "../../domain/metedata/repository";
import { DocumentMetadataEntity as DocumentMetadata, MetadataId } from "../../domain/metedata/entity";
import {
  MetadataNotFoundError,
  MetadataAlreadyExistsError,
  MetadataConstraintError,
} from "../../domain/metedata/errors";
import { DrizzleService } from "../services/drizzle-service";
import { documentMetadata } from "../models";
import { MetadataMapper } from "../mappers/metadata.mapper";
import { detectDbConstraint } from "../../domain/shared/base.repository";
import { DocumentId } from "../../domain/refined/uuid";

/**
 * Metadata Repository Implementation using Drizzle ORM
 */
export const MetadataRepositoryLive = Layer.effect(
  MetadataRepositoryTag,
  Effect.gen(function* () {
    const { db } = yield* DrizzleService;

    const save: MetadataRepository["save"] = (metadata) =>
      pipe(
        // Check if metadata exists
        Effect.tryPromise({
          try: () =>
            db.query.documentMetadata.findFirst({
              where: eq(documentMetadata.id, metadata.id),
            }),
          catch: () =>
            new MetadataConstraintError({ message: "Database error" }),
        }),
        Effect.flatMap((existingRow) => {
          if (existingRow) {
            // Update existing metadata
            return Effect.tryPromise({
              try: () =>
                db
                  .update(documentMetadata)
                  .set({ value: metadata.value })
                  .where(eq(documentMetadata.id, metadata.id)),
              catch: () =>
                new MetadataConstraintError({
                  message: "Database constraint violation",
                }),
            });
          } else {
            // Create new metadata
            const createData = MetadataMapper.toDbCreate(metadata);

            return Effect.tryPromise({
              try: () => db.insert(documentMetadata).values(createData),
              catch: (error) => {
                const constraintType = detectDbConstraint(error);
                if (constraintType === "unique") {
                  return new MetadataAlreadyExistsError({
                    documentId: metadata.documentId,
                    key: metadata.key,
                    message: "Metadata key already exists for this document",
                  });
                }
                return new MetadataConstraintError({
                  message: "Database constraint violation",
                });
              },
            });
          }
        }),
        // Fetch the saved metadata
        Effect.flatMap(() =>
          Effect.tryPromise({
            try: () =>
              db.query.documentMetadata.findFirst({
                where: eq(documentMetadata.id, metadata.id),
              }),
            catch: () =>
              new MetadataNotFoundError({
                metadataId: metadata.id,
                message: "Metadata not found after save",
              }),
          })
        ),
        Effect.flatMap((savedRow) =>
          savedRow
            ? Effect.succeed(MetadataMapper.toDomain(savedRow))
            : Effect.fail(
                new MetadataNotFoundError({
                  metadataId: metadata.id,
                  message: "Metadata not found after save",
                })
              )
        )
      );

    const findById: MetadataRepository["findById"] = (id) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db.query.documentMetadata.findFirst({
              where: eq(documentMetadata.id, id),
            }),
          catch: () =>
            new MetadataConstraintError({ message: "Database error" }),
        }),
        Effect.map((metadataRow) =>
          pipe(
            Option.fromNullable(metadataRow),
            Option.map(MetadataMapper.toDomain)
          )
        )
      );

    const findByDocumentAndKey: MetadataRepository["findByDocumentAndKey"] = (
      documentId,
      key
    ) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db.query.documentMetadata.findFirst({
              where: and(
                eq(documentMetadata.documentId, documentId),
                eq(documentMetadata.key, key)
              ),
            }),
          catch: () =>
            new MetadataConstraintError({ message: "Database error" }),
        }),
        Effect.map((metadataRow) =>
          pipe(
            Option.fromNullable(metadataRow),
            Option.map(MetadataMapper.toDomain)
          )
        )
      );

    const findByDocument: MetadataRepository["findByDocument"] = (documentId) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db.query.documentMetadata.findMany({
              where: eq(documentMetadata.documentId, documentId),
            }),
          catch: () =>
            new MetadataConstraintError({ message: "Database error" }),
        }),
        Effect.map(MetadataMapper.toDomainMany)
      );

    const deleteMetadata: MetadataRepository["delete"] = (id) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db.delete(documentMetadata).where(eq(documentMetadata.id, id)),
          catch: () =>
            new MetadataConstraintError({ message: "Database error" }),
        }),
        Effect.flatMap((result) => {
          if (!(result as any).changes && !(result as any).rowCount) {
            return Effect.fail(
              new MetadataNotFoundError({
                metadataId: id,
                message: "Metadata not found",
              })
            );
          }
          return Effect.succeed(undefined);
        })
      );

    const deleteByDocument: MetadataRepository["deleteByDocument"] = (
      documentId
    ) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db
              .delete(documentMetadata)
              .where(eq(documentMetadata.documentId, documentId)),
          catch: () =>
            new MetadataConstraintError({ message: "Database error" }),
        }),
        Effect.asVoid
      );

    const deleteByDocumentAndKey: MetadataRepository["deleteByDocumentAndKey"] =
      (documentId, key) =>
        pipe(
          Effect.tryPromise({
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
          }),
          Effect.asVoid
        );

    return {
      save,
      findById,
      findByDocumentAndKey,
      findByDocument,
      delete: deleteMetadata,
      deleteByDocument,
      deleteByDocumentAndKey,
    } satisfies MetadataRepository;
  })
);
