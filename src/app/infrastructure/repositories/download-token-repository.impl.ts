import { Effect, Option, Layer } from "effect";
import { eq, lt } from "drizzle-orm";
import {
  DownloadTokenRepository,
  DownloadTokenRepositoryTag,
} from "../../domain/download-token/repository";
import {
  DownloadToken,
  CreateDownloadTokenPayload,
} from "../../domain/download-token/entity";
import { DownloadTokenId, DocumentId } from "../../domain/refined/uuid";
import {
  DownloadTokenNotFoundError,
  DownloadTokenConstraintError,
} from "../../domain/download-token/errors";
import { DrizzleService } from "../services/drizzle-service";
import { downloadTokens } from "../models";
import { v4 as uuid } from "uuid";
import { detectDbConstraint } from "../../domain/shared/base.repository";
import { generateToken } from "../../domain/download-token/value-object";

/**
 * Download Token Repository Implementation using Drizzle ORM
 */
export const DownloadTokenRepositoryLive = Layer.effect(
  DownloadTokenRepositoryTag,
  Effect.gen(function* () {
    const { db } = yield* DrizzleService;

    const create: DownloadTokenRepository["create"] = (payload) =>
      Effect.gen(function* () {
        const id = payload.id || (uuid() as DownloadTokenId);
        const token = payload.token || generateToken();
        const expiresAt =
          payload.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000); // Default 24h

        yield* Effect.tryPromise({
          try: () =>
            db.insert(downloadTokens).values({
              documentId: payload.documentId,
              versionId: payload.versionId,
              token,
              expiresAt: expiresAt.toISOString(),
              createdBy: payload.createdBy,
            }),
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

        const result = yield* Effect.tryPromise({
          try: () =>
            db.query.downloadTokens.findFirst({
              where: eq(downloadTokens.token, token),
            }),
          catch: () =>
            new DownloadTokenNotFoundError({
              tokenId: id,
              message: "Token was created but could not be retrieved",
            }),
        });

        if (!result) {
          return yield* Effect.fail(
            new DownloadTokenNotFoundError({
              tokenId: id,
              message: "Token not found after creation",
            })
          );
        }

        return result as unknown as DownloadToken;
      });

    const findById: DownloadTokenRepository["findById"] = (id) =>
      Effect.gen(function* () {
        const token = yield* Effect.tryPromise({
          try: () =>
            db.query.downloadTokens.findFirst({
              where: eq(downloadTokens.id, id),
            }),
          catch: () =>
            new DownloadTokenConstraintError({ message: "Database error" }),
        });

        return Option.fromNullable(token as unknown as DownloadToken);
      });

    const findByToken: DownloadTokenRepository["findByToken"] = (token) =>
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise({
          try: () =>
            db.query.downloadTokens.findFirst({
              where: eq(downloadTokens.token, token),
            }),
          catch: () =>
            new DownloadTokenConstraintError({ message: "Database error" }),
        });

        return Option.fromNullable(result as unknown as DownloadToken);
      });

    const findByDocument: DownloadTokenRepository["findByDocument"] = (
      documentId
    ) =>
      Effect.gen(function* () {
        const tokens = yield* Effect.tryPromise({
          try: () =>
            db.query.downloadTokens.findMany({
              where: eq(downloadTokens.documentId, documentId),
            }),
          catch: () =>
            new DownloadTokenConstraintError({ message: "Database error" }),
        });

        return tokens as unknown as readonly DownloadToken[];
      });

    const markAsUsed: DownloadTokenRepository["markAsUsed"] = (id) =>
      Effect.gen(function* () {
        const now = new Date().toISOString();

        yield* Effect.tryPromise({
          try: () =>
            db
              .update(downloadTokens)
              .set({ usedAt: now })
              .where(eq(downloadTokens.id, id)),
          catch: () =>
            new DownloadTokenConstraintError({ message: "Database error" }),
        });

        const updated = yield* Effect.tryPromise({
          try: () =>
            db.query.downloadTokens.findFirst({
              where: eq(downloadTokens.id, id),
            }),
          catch: () =>
            new DownloadTokenNotFoundError({
              tokenId: id,
              message: "Token not found",
            }),
        });

        if (!updated) {
          return yield* Effect.fail(
            new DownloadTokenNotFoundError({
              tokenId: id,
              message: "Token not found",
            })
          );
        }

        return updated as unknown as DownloadToken;
      });

    const deleteToken: DownloadTokenRepository["delete"] = (id) =>
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise({
          try: () => db.delete(downloadTokens).where(eq(downloadTokens.id, id)),
          catch: () =>
            new DownloadTokenConstraintError({ message: "Database error" }),
        });

        if (!(result as any).changes && !(result as any).rowCount) {
          return yield* Effect.fail(
            new DownloadTokenNotFoundError({
              tokenId: id,
              message: "Token not found",
            })
          );
        }
      });

    const deleteExpired: DownloadTokenRepository["deleteExpired"] = () =>
      Effect.gen(function* () {
        const now = new Date().toISOString();

        const result = yield* Effect.tryPromise({
          try: () =>
            db.delete(downloadTokens).where(lt(downloadTokens.expiresAt, now)),
          catch: () =>
            new DownloadTokenConstraintError({ message: "Database error" }),
        });

        // Return number of deleted rows
        return (result as any).changes || 0;
      });

    const deleteByDocument: DownloadTokenRepository["deleteByDocument"] = (
      documentId
    ) =>
      Effect.gen(function* () {
        yield* Effect.tryPromise({
          try: () =>
            db
              .delete(downloadTokens)
              .where(eq(downloadTokens.documentId, documentId)),
          catch: () =>
            new DownloadTokenConstraintError({ message: "Database error" }),
        });
      });

    return {
      create,
      findById,
      findByToken,
      findByDocument,
      markAsUsed,
      delete: deleteToken,
      deleteExpired,
      deleteByDocument,
    } satisfies DownloadTokenRepository;
  })
);
