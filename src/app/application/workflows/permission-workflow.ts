/**
 * Permission Workflow
 *
 * Orchestrates permission-related use cases.
 * Handles permission CRUD with authorization checks.
 */

import { Effect, Option, Context, Layer, pipe } from "effect";
import { PermissionRepositoryTag } from "../../domain/permission/repository";
import { DocumentRepositoryTag } from "../../domain/document/repository";
import { UserRepositoryTag } from "../../domain/user/repository";
import { NotFoundError, ForbiddenError } from "../../domain/shared/base.errors";
import {
  InsufficientPermissionError,
  CannotRevokeOwnerPermissionError,
} from "../utils/errors";
import { withUseCaseLogging } from "../utils/logging";
import { loadEntity } from "../utils/effect-helpers";
import {
  isAdmin,
  isDocumentOwner,
  requirePermission,
} from "../../domain/permission/service";
import { UserId, DocumentId } from "../../domain/refined/uuid";
import {
  PermissionId,
  DocumentPermission,
} from "../../domain/permission/entity";
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
import { PermissionResponseMapper } from "../mappers/permission.mapper";

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
        pipe(
          // Load document, target user, granting user, and existing permissions in parallel
          Effect.all({
            document: loadEntity(
              documentRepo.findById(command.documentId),
              "Document",
              command.documentId
            ),
            targetUser: loadEntity(
              userRepo.findById(command.userId),
              "User",
              command.userId
            ),
            grantingUser: loadEntity(
              userRepo.findById(command.grantedBy),
              "User",
              command.grantedBy
            ),
            existingPermissions: permissionRepo.findByUserAndDocument(
              command.userId,
              command.documentId
            ),
          }),
          Effect.mapError((e) =>
            "_tag" in e && e._tag === "NotFoundError" ? new NotFoundError(e) : e
          ),
          // Check authorization
          Effect.flatMap(
            ({ document, grantingUser, existingPermissions, targetUser }) =>
              isAdmin(grantingUser) || isDocumentOwner(document, grantingUser)
                ? Effect.succeed({ document, existingPermissions })
                : Effect.fail(
                    new ForbiddenError({
                      message:
                        "Only document owner or admin can grant permissions",
                      resource: `Document:${command.documentId}`,
                    })
                  )
          ),
          // Create or update permission (upsert logic)
          Effect.flatMap(({ existingPermissions }) => {
            if (existingPermissions.length > 0) {
              const updatedPermission = DocumentPermission.updatePermission(
                existingPermissions[0],
                command.permission
              );
              return pipe(
                permissionRepo.save(updatedPermission),
                Effect.map((permission) => ({
                  permission,
                  isNew: false,
                }))
              );
            } else {
              const newPermission = DocumentPermission.create({
                documentId: command.documentId,
                userId: command.userId,
                permission: command.permission,
                grantedBy: command.grantedBy,
              });
              return pipe(
                permissionRepo.save(newPermission),
                Effect.map((permission) => ({
                  permission,
                  isNew: true,
                }))
              );
            }
          }),
          // Add audit log
          Effect.tap(({ permission }) =>
            documentRepo.addAudit(
              command.documentId,
              "permission_granted",
              command.grantedBy,
              Option.some(
                `${command.permission} permission granted to user ${command.userId}`
              )
            )
          ),
          // Map to response
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map(({ permission, isNew }) =>
            PermissionResponseMapper.toGrantPermissionResponse(
              permission,
              isNew
            )
          )
        ),
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
        pipe(
          // Load permission first
          loadEntity(
            permissionRepo.findById(command.permissionId),
            "Permission",
            command.permissionId
          ),
          Effect.mapError((e) =>
            "_tag" in e && e._tag === "NotFoundError" ? new NotFoundError(e) : e
          ),
          // Load document and updating user in parallel
          Effect.flatMap((permission) =>
            pipe(
              Effect.all({
                document: loadEntity(
                  documentRepo.findById(permission.documentId),
                  "Document",
                  permission.documentId
                ),
                updatingUser: loadEntity(
                  userRepo.findById(command.updatedBy),
                  "User",
                  command.updatedBy
                ),
              }),
              Effect.mapError((e) =>
                "_tag" in e && e._tag === "NotFoundError"
                  ? new NotFoundError(e)
                  : e
              ),
              Effect.map(({ document, updatingUser }) => ({
                permission,
                document,
                updatingUser,
              }))
            )
          ),
          // Check authorization
          Effect.flatMap(({ permission, document, updatingUser }) =>
            isAdmin(updatingUser) || isDocumentOwner(document, updatingUser)
              ? Effect.succeed(permission)
              : Effect.fail(
                  new ForbiddenError({
                    message:
                      "Only document owner or admin can update permissions",
                    resource: `Permission:${command.permissionId}`,
                  })
                )
          ),
          // Update and save permission
          Effect.flatMap((permission) => {
            const updatedPermission = DocumentPermission.updatePermission(
              permission,
              command.permission
            );
            return pipe(
              permissionRepo.save(updatedPermission),
              Effect.map((saved) => ({ saved, permission }))
            );
          }),
          // Add audit log
          Effect.tap(({ permission }) =>
            documentRepo.addAudit(
              permission.documentId,
              "permission_updated",
              command.updatedBy,
              Option.some(
                `Permission ${command.permissionId} updated to ${command.permission}`
              )
            )
          ),
          // Map to response
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map(({ saved }) =>
            PermissionResponseMapper.toPermissionResponse(saved)
          )
        ),
        { permissionId: command.permissionId, updatedBy: command.updatedBy }
      );

    const revokePermission: PermissionWorkflow["revokePermission"] = (
      command
    ) =>
      withUseCaseLogging(
        "RevokePermission",
        pipe(
          // Load permission first
          loadEntity(
            permissionRepo.findById(command.permissionId),
            "Permission",
            command.permissionId
          ),
          Effect.mapError((e) =>
            "_tag" in e && e._tag === "NotFoundError" ? new NotFoundError(e) : e
          ),
          // Load document and revoking user in parallel
          Effect.flatMap((permission) =>
            pipe(
              Effect.all({
                document: loadEntity(
                  documentRepo.findById(permission.documentId),
                  "Document",
                  permission.documentId
                ),
                revokingUser: loadEntity(
                  userRepo.findById(command.revokedBy),
                  "User",
                  command.revokedBy
                ),
              }),
              Effect.mapError((e) =>
                "_tag" in e && e._tag === "NotFoundError"
                  ? new NotFoundError(e)
                  : e
              ),
              Effect.map(({ document, revokingUser }) => ({
                permission,
                document,
                revokingUser,
              }))
            )
          ),
          // Check if trying to revoke owner's permission
          Effect.flatMap(({ permission, document, revokingUser }) =>
            permission.userId === document.uploadedBy
              ? Effect.fail(
                  new CannotRevokeOwnerPermissionError({
                    message: "Cannot revoke document owner's permission",
                    documentId: permission.documentId,
                  })
                )
              : Effect.succeed({ permission, document, revokingUser })
          ),
          // Check authorization
          Effect.flatMap(({ permission, document, revokingUser }) =>
            isAdmin(revokingUser) || isDocumentOwner(document, revokingUser)
              ? Effect.succeed(permission)
              : Effect.fail(
                  new ForbiddenError({
                    message:
                      "Only document owner or admin can revoke permissions",
                    resource: `Permission:${command.permissionId}`,
                  })
                )
          ),
          // Delete permission
          Effect.flatMap((permission) =>
            pipe(
              permissionRepo.delete(command.permissionId),
              Effect.map(() => permission)
            )
          ),
          // Add audit log
          Effect.flatMap((permission) =>
            documentRepo.addAudit(
              permission.documentId,
              "permission_revoked",
              command.revokedBy,
              Option.some(
                `Permission ${command.permissionId} revoked from user ${permission.userId}`
              )
            )
          ),
          // Map errors
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          )
        ),
        { permissionId: command.permissionId, revokedBy: command.revokedBy }
      );

    const listDocumentPermissions: PermissionWorkflow["listDocumentPermissions"] =
      (query) =>
        withUseCaseLogging(
          "ListDocumentPermissions",
          pipe(
            // Load document and user in parallel
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
            }),
            Effect.mapError((e) =>
              "_tag" in e && e._tag === "NotFoundError"
                ? new NotFoundError(e)
                : e
            ),
            // Check authorization
            Effect.flatMap(({ document, user }) =>
              isAdmin(user) || isDocumentOwner(document, user)
                ? Effect.succeed(document)
                : Effect.fail(
                    new ForbiddenError({
                      message:
                        "Only document owner or admin can list permissions",
                      resource: `Document:${query.documentId}`,
                    })
                  )
            ),
            // Get permissions
            Effect.flatMap(() =>
              permissionRepo.findByDocument(query.documentId)
            ),
            // Map to response
            Effect.mapError((e) =>
              e instanceof Error ? e : new Error(String(e))
            ),
            Effect.map((permissions) =>
              PermissionResponseMapper.toListPermissionsResponse(permissions)
            )
          ),
          { documentId: query.documentId, userId: query.userId }
        );

    const listUserPermissions: PermissionWorkflow["listUserPermissions"] = (
      query
    ) =>
      withUseCaseLogging(
        "ListUserPermissions",
        pipe(
          // Get permissions for user
          permissionRepo.findByUser(query.userId),
          // Map to response
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map((permissions) =>
            PermissionResponseMapper.toListPermissionsResponse(permissions)
          )
        ),
        { userId: query.userId }
      );

    const checkPermission: PermissionWorkflow["checkPermission"] = (query) =>
      withUseCaseLogging(
        "CheckPermission",
        pipe(
          // Load document and user in parallel
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
          // Check permission using domain service
          Effect.flatMap(({ document, user, permissions }) =>
            pipe(
              requirePermission(
                user,
                document,
                permissions,
                query.requiredPermission
              ),
              Effect.map(() => ({ permissions, hasPermission: true })),
              Effect.catchAll(() =>
                Effect.succeed({ permissions, hasPermission: false })
              )
            )
          ),
          // Map to response
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map(({ permissions, hasPermission }) => {
            const userPermission = permissions.find(
              (p) => p.userId === query.userId
            );
            return PermissionResponseMapper.toCheckPermissionResponse(
              hasPermission,
              userPermission?.permission
            );
          })
        ),
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
