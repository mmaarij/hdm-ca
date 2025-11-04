/**
 * Permission Workflow
 *
 * Orchestrates permission-related use cases.
 * Handles permission CRUD with authorization checks.
 */

import { Effect, Option, Context, Layer } from "effect";
import { PermissionRepositoryTag } from "../../domain/permission/repository";
import { DocumentRepositoryTag } from "../../domain/document/repository";
import { UserRepositoryTag } from "../../domain/user/repository";
import { NotFoundError, ForbiddenError } from "../../domain/shared/base.errors";
import {
  InsufficientPermissionError,
  CannotRevokeOwnerPermissionError,
} from "../utils/errors";
import { withUseCaseLogging } from "../utils/logging";
import {
  isAdmin,
  isDocumentOwner,
} from "../../domain/permission/access-service";
import { UserId, DocumentId } from "../../domain/refined/uuid";
import { PermissionId } from "../../domain/permission/entity";
import type {
  GrantPermissionCommand,
  UpdatePermissionCommand,
  RevokePermissionCommand,
  ListDocumentPermissionsQuery,
  ListUserPermissionsQuery,
  CheckPermissionQuery,
} from "../dtos/permission/request.dto";
import type {
  GrantPermissionResponse,
  ListPermissionsResponse,
  CheckPermissionResponse,
  PermissionResponse,
} from "../dtos/permission/response.dto";

/**
 * Permission Workflow Interface
 */
export interface PermissionWorkflow {
  /**
   * Grant permission to a user on a document
   * Uses upsert logic: if permission exists, update it; otherwise create it
   */
  readonly grantPermission: (
    command: GrantPermissionCommand
  ) => Effect.Effect<
    GrantPermissionResponse,
    NotFoundError | ForbiddenError | Error
  >;

  /**
   * Update an existing permission
   */
  readonly updatePermission: (
    command: UpdatePermissionCommand
  ) => Effect.Effect<
    PermissionResponse,
    NotFoundError | ForbiddenError | Error
  >;

  /**
   * Revoke a permission
   */
  readonly revokePermission: (
    command: RevokePermissionCommand
  ) => Effect.Effect<
    void,
    NotFoundError | ForbiddenError | CannotRevokeOwnerPermissionError | Error
  >;

  /**
   * List all permissions for a document
   */
  readonly listDocumentPermissions: (
    query: ListDocumentPermissionsQuery
  ) => Effect.Effect<
    ListPermissionsResponse,
    NotFoundError | ForbiddenError | Error
  >;

  /**
   * List all permissions for a user
   */
  readonly listUserPermissions: (
    query: ListUserPermissionsQuery
  ) => Effect.Effect<ListPermissionsResponse, Error>;

  /**
   * Check if a user has a specific permission on a document
   */
  readonly checkPermission: (
    query: CheckPermissionQuery
  ) => Effect.Effect<CheckPermissionResponse, NotFoundError | Error>;
}

export const PermissionWorkflowTag = Context.GenericTag<PermissionWorkflow>(
  "@app/PermissionWorkflow"
);

/**
 * Live implementation of PermissionWorkflow
 */
export const PermissionWorkflowLive = Layer.effect(
  PermissionWorkflowTag,
  Effect.gen(function* () {
    const permissionRepo = yield* PermissionRepositoryTag;
    const documentRepo = yield* DocumentRepositoryTag;
    const userRepo = yield* UserRepositoryTag;

    const grantPermission: PermissionWorkflow["grantPermission"] = (command) =>
      withUseCaseLogging(
        "GrantPermission",
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

          // Verify user to grant permission to exists
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

          // Verify granting user exists and has authorization
          const grantingUserOpt = yield* userRepo.findById(command.grantedBy);
          if (Option.isNone(grantingUserOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "User",
                id: command.grantedBy,
                message: `Granting user with ID ${command.grantedBy} not found`,
              })
            );
          }

          const grantingUser = grantingUserOpt.value;

          // Only document owner or admin can grant permissions
          if (
            !isAdmin(grantingUser) &&
            !isDocumentOwner(document, grantingUser)
          ) {
            return yield* Effect.fail(
              new ForbiddenError({
                message: "Only document owner or admin can grant permissions",
                resource: `Document:${command.documentId}`,
              })
            );
          }

          // Check if permission already exists (upsert logic)
          const existingPermissions =
            yield* permissionRepo.findByUserAndDocument(
              command.userId,
              command.documentId
            );

          let permission;
          let message;

          if (existingPermissions.length > 0) {
            // Update existing permission
            const existingPermission = existingPermissions[0];
            permission = yield* permissionRepo.update(existingPermission.id, {
              permission: command.permission,
            });
            message = "Permission updated successfully";
          } else {
            // Create new permission
            permission = yield* permissionRepo.create({
              documentId: command.documentId,
              userId: command.userId,
              permission: command.permission,
              grantedBy: command.grantedBy,
            });
            message = "Permission granted successfully";
          }

          // Add audit log
          yield* documentRepo.addAudit({
            documentId: command.documentId,
            action: "permission_granted",
            performedBy: command.grantedBy,
            details: `${command.permission} permission granted to user ${command.userId}`,
          });

          return {
            permission: {
              id: permission.id,
              documentId: permission.documentId,
              userId: permission.userId,
              permission: permission.permission,
              grantedBy: permission.grantedBy,
              grantedAt: permission.grantedAt,
            },
            message,
          };
        }),
        {
          documentId: command.documentId,
          userId: command.userId,
          grantedBy: command.grantedBy,
        }
      );

    const updatePermission: PermissionWorkflow["updatePermission"] = (
      command
    ) =>
      withUseCaseLogging(
        "UpdatePermission",
        Effect.gen(function* () {
          // Get permission
          const permissionOpt = yield* permissionRepo.findById(
            command.permissionId
          );
          if (Option.isNone(permissionOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "Permission",
                id: command.permissionId,
                message: `Permission with ID ${command.permissionId} not found`,
              })
            );
          }

          const permission = permissionOpt.value;

          // Get document
          const documentOpt = yield* documentRepo.findDocument(
            permission.documentId
          );
          if (Option.isNone(documentOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "Document",
                id: permission.documentId,
                message: `Document with ID ${permission.documentId} not found`,
              })
            );
          }

          const document = documentOpt.value;

          // Verify updating user has authorization
          const updatingUserOpt = yield* userRepo.findById(command.updatedBy);
          if (Option.isNone(updatingUserOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "User",
                id: command.updatedBy,
                message: `Updating user with ID ${command.updatedBy} not found`,
              })
            );
          }

          const updatingUser = updatingUserOpt.value;

          // Only document owner or admin can update permissions
          if (
            !isAdmin(updatingUser) &&
            !isDocumentOwner(document, updatingUser)
          ) {
            return yield* Effect.fail(
              new ForbiddenError({
                message: "Only document owner or admin can update permissions",
                resource: `Permission:${command.permissionId}`,
              })
            );
          }

          // Update permission
          const updatedPermission = yield* permissionRepo.update(
            command.permissionId,
            {
              permission: command.permission,
            }
          );

          // Add audit log
          yield* documentRepo.addAudit({
            documentId: permission.documentId,
            action: "permission_updated",
            performedBy: command.updatedBy,
            details: `Permission ${command.permissionId} updated to ${command.permission}`,
          });

          return {
            id: updatedPermission.id,
            documentId: updatedPermission.documentId,
            userId: updatedPermission.userId,
            permission: updatedPermission.permission,
            grantedBy: updatedPermission.grantedBy,
            grantedAt: updatedPermission.grantedAt,
          };
        }),
        { permissionId: command.permissionId, updatedBy: command.updatedBy }
      );

    const revokePermission: PermissionWorkflow["revokePermission"] = (
      command
    ) =>
      withUseCaseLogging(
        "RevokePermission",
        Effect.gen(function* () {
          // Get permission
          const permissionOpt = yield* permissionRepo.findById(
            command.permissionId
          );
          if (Option.isNone(permissionOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "Permission",
                id: command.permissionId,
                message: `Permission with ID ${command.permissionId} not found`,
              })
            );
          }

          const permission = permissionOpt.value;

          // Get document
          const documentOpt = yield* documentRepo.findDocument(
            permission.documentId
          );
          if (Option.isNone(documentOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "Document",
                id: permission.documentId,
                message: `Document with ID ${permission.documentId} not found`,
              })
            );
          }

          const document = documentOpt.value;

          // Cannot revoke owner's implicit permission
          if (permission.userId === document.uploadedBy) {
            return yield* Effect.fail(
              new CannotRevokeOwnerPermissionError({
                message: "Cannot revoke document owner's permission",
                documentId: permission.documentId,
              })
            );
          }

          // Verify revoking user has authorization
          const revokingUserOpt = yield* userRepo.findById(command.revokedBy);
          if (Option.isNone(revokingUserOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "User",
                id: command.revokedBy,
                message: `Revoking user with ID ${command.revokedBy} not found`,
              })
            );
          }

          const revokingUser = revokingUserOpt.value;

          // Only document owner or admin can revoke permissions
          if (
            !isAdmin(revokingUser) &&
            !isDocumentOwner(document, revokingUser)
          ) {
            return yield* Effect.fail(
              new ForbiddenError({
                message: "Only document owner or admin can revoke permissions",
                resource: `Permission:${command.permissionId}`,
              })
            );
          }

          // Delete permission
          yield* permissionRepo.delete(command.permissionId);

          // Add audit log
          yield* documentRepo.addAudit({
            documentId: permission.documentId,
            action: "permission_revoked",
            performedBy: command.revokedBy,
            details: `Permission ${command.permissionId} revoked from user ${permission.userId}`,
          });
        }),
        { permissionId: command.permissionId, revokedBy: command.revokedBy }
      );

    const listDocumentPermissions: PermissionWorkflow["listDocumentPermissions"] =
      (query) =>
        withUseCaseLogging(
          "ListDocumentPermissions",
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

            // Verify user has authorization
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

            // Only document owner or admin can list permissions
            if (!isAdmin(user) && !isDocumentOwner(document, user)) {
              return yield* Effect.fail(
                new ForbiddenError({
                  message: "Only document owner or admin can list permissions",
                  resource: `Document:${query.documentId}`,
                })
              );
            }

            // Get permissions
            const permissions = yield* permissionRepo.findByDocument(
              query.documentId
            );

            return {
              permissions: permissions.map((p) => ({
                id: p.id,
                documentId: p.documentId,
                userId: p.userId,
                permission: p.permission,
                grantedBy: p.grantedBy,
                grantedAt: p.grantedAt,
              })),
              total: permissions.length,
            };
          }),
          { documentId: query.documentId, userId: query.userId }
        );

    const listUserPermissions: PermissionWorkflow["listUserPermissions"] = (
      query
    ) =>
      withUseCaseLogging(
        "ListUserPermissions",
        Effect.gen(function* () {
          const permissions = yield* permissionRepo.findByUser(query.userId);

          return {
            permissions: permissions.map((p) => ({
              id: p.id,
              documentId: p.documentId,
              userId: p.userId,
              permission: p.permission,
              grantedBy: p.grantedBy,
              grantedAt: p.grantedAt,
            })),
            total: permissions.length,
          };
        }),
        { userId: query.userId }
      );

    const checkPermission: PermissionWorkflow["checkPermission"] = (query) =>
      withUseCaseLogging(
        "CheckPermission",
        Effect.gen(function* () {
          // Check if document exists
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

          // Check if user exists
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

          // Get permissions
          const permissions = yield* permissionRepo.findByDocument(
            query.documentId
          );

          // Import access check logic
          const { evaluateDocumentAccess, getHighestPermission } =
            yield* Effect.promise(
              () => import("../../domain/permission/access-service")
            );

          const hasPermission = evaluateDocumentAccess(
            user,
            document,
            permissions,
            query.requiredPermission
          );

          const highestPermission = getHighestPermission(
            user,
            document,
            permissions
          );

          return {
            hasPermission,
            permission: highestPermission ?? undefined,
          };
        }),
        {
          documentId: query.documentId,
          userId: query.userId,
          requiredPermission: query.requiredPermission,
        }
      );

    return {
      grantPermission,
      updatePermission,
      revokePermission,
      listDocumentPermissions,
      listUserPermissions,
      checkPermission,
    } satisfies PermissionWorkflow;
  })
);
