import { Effect, Option, Layer, pipe } from "effect";
import { eq, exists, lt } from "drizzle-orm";
import {
  DownloadTokenRepository,
  DownloadTokenRepositoryTag,
} from "../../domain/download-token/repository";
import { DownloadTokenEntity as DownloadToken } from "../../domain/download-token/entity";
import { DownloadTokenId, DocumentId } from "../../domain/refined/uuid";
import {
  DownloadTokenNotFoundError,
  DownloadTokenConstraintError,
} from "../../domain/download-token/errors";
import { DrizzleService, hasAffectedRows } from "../services/drizzle-service";
import { downloadTokens } from "../models";
import { DownloadTokenMapper } from "../mappers/download-token.mapper";
import { detectDbConstraint } from "../../domain/shared/base.repository";

/**
 * Download Token Repository Implementation using Drizzle ORM
 */
export const DownloadTokenRepositoryLive = Layer.effect(
  DownloadTokenRepositoryTag,
  Effect.gen(function* () {
    const { db } = yield* DrizzleService;

    const save: DownloadTokenRepository["save"] = (token) =>
      pipe(
        // Check if token exists
        Effect.tryPromise({
          try: () =>
            db.query.downloadTokens.findFirst({
              where: eq(downloadTokens.id, token.id),
            }),
          catch: () =>
            new DownloadTokenConstraintError({ message: "Database error" }),
        }),
        Effect.flatMap((existingRow) => {
          if (existingRow) {
            // Update existing token (e.g., mark as used)
            const updateData = DownloadTokenMapper.toDbUpdate(token);

            return Effect.tryPromise({
              try: () =>
                db
                  .update(downloadTokens)
                  .set(updateData)
                  .where(eq(downloadTokens.id, token.id)),
              catch: () =>
                new DownloadTokenConstraintError({
                  message: "Database constraint violation",
                }),
            });
          } else {
            // Create new token
            const createData = DownloadTokenMapper.toDbCreate(token);

            return Effect.tryPromise({
              try: () => db.insert(downloadTokens).values(createData),
              catch: (error) => {
                const constraintType = detectDbConstraint(error);
                if (constraintType === "unique") {
                  return new DownloadTokenConstraintError({
                    message: "Token already exists",
                  });
                }
                return new DownloadTokenConstraintError({
                  message: "Database constraint violation",
                });
              },
            });
          }
        }),
        // Fetch the saved token
        Effect.flatMap(() =>
          Effect.tryPromise({
            try: () =>
              db.query.downloadTokens.findFirst({
                where: eq(downloadTokens.id, token.id),
              }),
            catch: () =>
              new DownloadTokenNotFoundError({
                tokenId: token.id,
                message: "Token not found after save",
              }),
          })
        ),
        Effect.flatMap((savedRow) =>
          savedRow
            ? Effect.succeed(DownloadTokenMapper.toDomain(savedRow))
            : Effect.fail(
                new DownloadTokenNotFoundError({
                  tokenId: token.id,
                  message: "Token not found after save",
                })
              )
        )
      );

    const findById: DownloadTokenRepository["findById"] = (id) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db.query.downloadTokens.findFirst({
              where: eq(downloadTokens.id, id),
            }),
          catch: () =>
            new DownloadTokenConstraintError({ message: "Database error" }),
        }),
        Effect.map((tokenRow) =>
          pipe(
            Option.fromNullable(tokenRow),
            Option.map(DownloadTokenMapper.toDomain)
          )
        )
      );

    const findByToken: DownloadTokenRepository["findByToken"] = (token) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db.query.downloadTokens.findFirst({
              where: eq(downloadTokens.token, token),
            }),
          catch: () =>
            new DownloadTokenConstraintError({ message: "Database error" }),
        }),
        Effect.map((tokenRow) =>
          pipe(
            Option.fromNullable(tokenRow),
            Option.map(DownloadTokenMapper.toDomain)
          )
        )
      );

    const findByDocument: DownloadTokenRepository["findByDocument"] = (
      documentId
    ) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db.query.downloadTokens.findMany({
              where: eq(downloadTokens.documentId, documentId),
            }),
          catch: () =>
            new DownloadTokenConstraintError({ message: "Database error" }),
        }),
        Effect.map(DownloadTokenMapper.toDomainMany)
      );

    const deleteToken: DownloadTokenRepository["delete"] = (id) =>
      pipe(
        Effect.tryPromise({
          try: () => db.delete(downloadTokens).where(eq(downloadTokens.id, id)),
          catch: () =>
            new DownloadTokenConstraintError({ message: "Database error" }),
        }),
        Effect.flatMap((result) => {
          if (!hasAffectedRows(result)) {
            return Effect.fail(
              new DownloadTokenNotFoundError({
                tokenId: id,
                message: "Token not found",
              })
            );
          }
          return Effect.succeed(undefined);
        })
      );

    const deleteExpired: DownloadTokenRepository["deleteExpired"] = () =>
      pipe(
        Effect.sync(() => new Date().toISOString()),
        Effect.flatMap((now) =>
          Effect.tryPromise({
            try: () =>
              db
                .delete(downloadTokens)
                .where(lt(downloadTokens.expiresAt, now)),
            catch: () =>
              new DownloadTokenConstraintError({ message: "Database error" }),
          })
        ),
        Effect.map((result) => {
          const deleteResult = result as unknown as {
            changes?: number;
            rowCount?: number;
          };
          return deleteResult.changes || deleteResult.rowCount || 0;
        })
      );

    const deleteByDocument: DownloadTokenRepository["deleteByDocument"] = (
      documentId
    ) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db
              .delete(downloadTokens)
              .where(eq(downloadTokens.documentId, documentId)),
          catch: () =>
            new DownloadTokenConstraintError({ message: "Database error" }),
        }),
        Effect.asVoid
      );

    return {
      save,
      findById,
      findByToken,
      findByDocument,
      delete: deleteToken,
      deleteExpired,
      deleteByDocument,
    } satisfies DownloadTokenRepository;
  })
);
