import { Effect, Option, Layer } from "effect";
import { eq, and } from "drizzle-orm";
import {
  PermissionRepository,
  PermissionRepositoryTag,
} from "../../domain/permission/repository";
import {
  DocumentPermission,
  CreatePermissionPayload,
  UpdatePermissionPayload,
  PermissionId,
} from "../../domain/permission/entity";
import {
  PermissionNotFoundError,
  PermissionAlreadyExistsError,
  PermissionConstraintError,
  PermissionDomainError,
} from "../../domain/permission/errors";
import { DrizzleService } from "../services/drizzle-service";
import { documentPermissions } from "../models";
import { v4 as uuid } from "uuid";
import { detectDbConstraint } from "../../domain/shared/base.repository";
import { DocumentId, UserId } from "../../domain/refined/uuid";
import { PermissionType } from "../../domain/permission/value-object";

/**
 * Permission Repository Implementation using Drizzle ORM
 */
export const PermissionRepositoryLive = Layer.effect(
  PermissionRepositoryTag,
  Effect.gen(function* () {
    const { db } = yield* DrizzleService;

    const create: PermissionRepository["create"] = (payload) =>
      Effect.gen(function* () {
        const id = payload.id || (uuid() as PermissionId);

        yield* Effect.tryPromise({
          try: () =>
            db.insert(documentPermissions).values({
              id,
              documentId: payload.documentId,
              userId: payload.userId,
              permission: payload.permission,
              grantedBy: payload.grantedBy,
            }),
          catch: (error) => {
            const constraintType = detectDbConstraint(error);
            if (constraintType === "unique") {
              return new PermissionAlreadyExistsError({
                documentId: payload.documentId,
                userId: payload.userId,
                message:
                  "Permission already exists for this user on this document",
              });
            }
            return new PermissionConstraintError({
              message: "Database constraint violation",
            });
          },
        });

        const permission = yield* Effect.tryPromise({
          try: () =>
            db.query.documentPermissions.findFirst({
              where: eq(documentPermissions.id, id),
            }),
          catch: () =>
            new PermissionNotFoundError({
              permissionId: id,
              message: "Permission was created but could not be retrieved",
            }),
        });

        if (!permission) {
          return yield* Effect.fail(
            new PermissionNotFoundError({
              permissionId: id,
              message: "Permission not found after creation",
            })
          );
        }

        return permission as unknown as DocumentPermission;
      });

    const findById: PermissionRepository["findById"] = (id) =>
      Effect.gen(function* () {
        const permission = yield* Effect.tryPromise({
          try: () =>
            db.query.documentPermissions.findFirst({
              where: eq(documentPermissions.id, id),
            }),
          catch: () =>
            new PermissionConstraintError({ message: "Database error" }),
        });

        return Option.fromNullable(permission as unknown as DocumentPermission);
      });

    const findByDocument: PermissionRepository["findByDocument"] = (
      documentId
    ) =>
      Effect.gen(function* () {
        const permissions = yield* Effect.tryPromise({
          try: () =>
            db.query.documentPermissions.findMany({
              where: eq(documentPermissions.documentId, documentId),
            }),
          catch: () =>
            new PermissionConstraintError({ message: "Database error" }),
        });

        return permissions as unknown as readonly DocumentPermission[];
      });

    const findByUserAndDocument: PermissionRepository["findByUserAndDocument"] =
      (userId, documentId) =>
        Effect.gen(function* () {
          const permissions = yield* Effect.tryPromise({
            try: () =>
              db.query.documentPermissions.findMany({
                where: and(
                  eq(documentPermissions.userId, userId),
                  eq(documentPermissions.documentId, documentId)
                ),
              }),
            catch: () =>
              new PermissionConstraintError({ message: "Database error" }),
          });

          return permissions as unknown as readonly DocumentPermission[];
        });

    const findByUser: PermissionRepository["findByUser"] = (userId) =>
      Effect.gen(function* () {
        const permissions = yield* Effect.tryPromise({
          try: () =>
            db.query.documentPermissions.findMany({
              where: eq(documentPermissions.userId, userId),
            }),
          catch: () =>
            new PermissionConstraintError({ message: "Database error" }),
        });

        return permissions as unknown as readonly DocumentPermission[];
      });

    const update: PermissionRepository["update"] = (id, payload) =>
      Effect.gen(function* () {
        yield* Effect.tryPromise({
          try: () =>
            db
              .update(documentPermissions)
              .set({ permission: payload.permission })
              .where(eq(documentPermissions.id, id)),
          catch: (error) => {
            return new PermissionConstraintError({
              message: "Database constraint violation",
            });
          },
        });

        const updated = yield* Effect.tryPromise({
          try: () =>
            db.query.documentPermissions.findFirst({
              where: eq(documentPermissions.id, id),
            }),
          catch: () =>
            new PermissionNotFoundError({
              permissionId: id,
              message: "Permission not found",
            }),
        });

        if (!updated) {
          return yield* Effect.fail(
            new PermissionNotFoundError({
              permissionId: id,
              message: "Permission not found",
            })
          );
        }

        return updated as unknown as DocumentPermission;
      });

    const deletePermission: PermissionRepository["delete"] = (id) =>
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise({
          try: () =>
            db
              .delete(documentPermissions)
              .where(eq(documentPermissions.id, id)),
          catch: () =>
            new PermissionConstraintError({ message: "Database error" }),
        });

        if (!(result as any).changes && !(result as any).rowCount) {
          return yield* Effect.fail(
            new PermissionNotFoundError({
              permissionId: id,
              message: "Permission not found",
            })
          );
        }
      });

    const hasPermission: PermissionRepository["hasPermission"] = (
      userId,
      documentId,
      permission
    ) =>
      Effect.gen(function* () {
        const permissions = yield* Effect.tryPromise({
          try: () =>
            db.query.documentPermissions.findMany({
              where: and(
                eq(documentPermissions.userId, userId),
                eq(documentPermissions.documentId, documentId),
                eq(documentPermissions.permission, permission)
              ),
            }),
          catch: () =>
            new PermissionConstraintError({ message: "Database error" }),
        });

        return permissions.length > 0;
      });

    const deleteByDocument: PermissionRepository["deleteByDocument"] = (
      documentId
    ) =>
      Effect.gen(function* () {
        yield* Effect.tryPromise({
          try: () =>
            db
              .delete(documentPermissions)
              .where(eq(documentPermissions.documentId, documentId)),
          catch: () =>
            new PermissionConstraintError({ message: "Database error" }),
        });
      });

    return {
      create,
      findById,
      findByDocument,
      findByUserAndDocument,
      findByUser,
      update,
      delete: deletePermission,
      hasPermission,
      deleteByDocument,
    } satisfies PermissionRepository;
  })
);
