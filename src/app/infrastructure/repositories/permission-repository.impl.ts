import { Effect, Option, Layer, pipe } from "effect";
import { eq, and } from "drizzle-orm";
import {
  PermissionRepository,
  PermissionRepositoryTag,
} from "../../domain/permission/repository";
import {
  DocumentPermissionEntity as DocumentPermission,
  PermissionId,
} from "../../domain/permission/entity";
import {
  PermissionNotFoundError,
  PermissionAlreadyExistsError,
  PermissionConstraintError,
} from "../../domain/permission/errors";
import { DrizzleService, hasAffectedRows } from "../services/drizzle-service";
import { documentPermissions } from "../models";
import { PermissionMapper } from "../mappers/permission.mapper";
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

    const save: PermissionRepository["save"] = (permission) =>
      pipe(
        // Check if permission exists
        Effect.tryPromise({
          try: () =>
            db.query.documentPermissions.findFirst({
              where: eq(documentPermissions.id, permission.id),
            }),
          catch: () =>
            new PermissionConstraintError({ message: "Database error" }),
        }),
        Effect.flatMap((existingRow) => {
          if (existingRow) {
            // Update existing permission
            return Effect.tryPromise({
              try: () =>
                db
                  .update(documentPermissions)
                  .set({ permission: permission.permission })
                  .where(eq(documentPermissions.id, permission.id)),
              catch: () =>
                new PermissionConstraintError({
                  message: "Database constraint violation",
                }),
            });
          } else {
            // Create new permission
            const createData = PermissionMapper.toDbCreate(permission);

            return Effect.tryPromise({
              try: () => db.insert(documentPermissions).values(createData),
              catch: (error) => {
                const constraintType = detectDbConstraint(error);
                if (constraintType === "unique") {
                  return new PermissionAlreadyExistsError({
                    documentId: permission.documentId,
                    userId: permission.userId,
                    message:
                      "Permission already exists for this user on this document",
                  });
                }
                return new PermissionConstraintError({
                  message: "Database constraint violation",
                });
              },
            });
          }
        }),
        // Fetch the saved permission
        Effect.flatMap(() =>
          Effect.tryPromise({
            try: () =>
              db.query.documentPermissions.findFirst({
                where: eq(documentPermissions.id, permission.id),
              }),
            catch: () =>
              new PermissionNotFoundError({
                permissionId: permission.id,
                message: "Permission not found after save",
              }),
          })
        ),
        Effect.flatMap((savedRow) =>
          savedRow
            ? Effect.succeed(PermissionMapper.toDomain(savedRow))
            : Effect.fail(
                new PermissionNotFoundError({
                  permissionId: permission.id,
                  message: "Permission not found after save",
                })
              )
        )
      );

    const findById: PermissionRepository["findById"] = (id) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db.query.documentPermissions.findFirst({
              where: eq(documentPermissions.id, id),
            }),
          catch: () =>
            new PermissionConstraintError({ message: "Database error" }),
        }),
        Effect.map((permissionRow) =>
          pipe(
            Option.fromNullable(permissionRow),
            Option.map(PermissionMapper.toDomain)
          )
        )
      );

    const findByDocument: PermissionRepository["findByDocument"] = (
      documentId
    ) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db.query.documentPermissions.findMany({
              where: eq(documentPermissions.documentId, documentId),
            }),
          catch: () =>
            new PermissionConstraintError({ message: "Database error" }),
        }),
        Effect.map(PermissionMapper.toDomainMany)
      );

    const findByUserAndDocument: PermissionRepository["findByUserAndDocument"] =
      (userId, documentId) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              db.query.documentPermissions.findMany({
                where: and(
                  eq(documentPermissions.userId, userId),
                  eq(documentPermissions.documentId, documentId)
                ),
              }),
            catch: () =>
              new PermissionConstraintError({ message: "Database error" }),
          }),
          Effect.map(PermissionMapper.toDomainMany)
        );

    const findByUser: PermissionRepository["findByUser"] = (userId) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db.query.documentPermissions.findMany({
              where: eq(documentPermissions.userId, userId),
            }),
          catch: () =>
            new PermissionConstraintError({ message: "Database error" }),
        }),
        Effect.map(PermissionMapper.toDomainMany)
      );

    const deletePermission: PermissionRepository["delete"] = (id) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db
              .delete(documentPermissions)
              .where(eq(documentPermissions.id, id)),
          catch: () =>
            new PermissionConstraintError({ message: "Database error" }),
        }),
        Effect.flatMap((result) => {
          if (!hasAffectedRows(result)) {
            return Effect.fail(
              new PermissionNotFoundError({
                permissionId: id,
                message: "Permission not found",
              })
            );
          }
          return Effect.succeed(undefined);
        })
      );

    const hasPermission: PermissionRepository["hasPermission"] = (
      userId,
      documentId,
      permission
    ) =>
      pipe(
        Effect.tryPromise({
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
        }),
        Effect.map((permissionRows) => permissionRows.length > 0)
      );

    const deleteByDocument: PermissionRepository["deleteByDocument"] = (
      documentId
    ) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db
              .delete(documentPermissions)
              .where(eq(documentPermissions.documentId, documentId)),
          catch: () =>
            new PermissionConstraintError({ message: "Database error" }),
        }),
        Effect.asVoid
      );

    return {
      save,
      findById,
      findByDocument,
      findByUserAndDocument,
      findByUser,
      delete: deletePermission,
      hasPermission,
      deleteByDocument,
    } satisfies PermissionRepository;
  })
);
