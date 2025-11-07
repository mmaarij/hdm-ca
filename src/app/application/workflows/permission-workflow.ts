/**
 * Permission Workflow - Functional Pattern
 *
 * Functional workflows using currying pattern.
 * No Effect.gen usage - pure monadic composition with pipe.
 */

import { Effect, Option, pipe } from "effect";
import { v4 as uuidv4 } from "uuid";
import type { PermissionRepository } from "../../domain/permission/repository";
import type { DocumentRepository } from "../../domain/document/repository";
import type { UserRepository } from "../../domain/user/repository";
import { NotFoundError, ForbiddenError } from "../../domain/shared/base.errors";
import {
  InsufficientPermissionError,
  CannotRevokeOwnerPermissionError,
} from "../utils/errors";
import {
  isAdmin,
  isDocumentOwner,
  requirePermission,
} from "../../domain/permission/service";
import { loadEntity } from "../utils/effect-helpers";
import type { UserId, DocumentId } from "../../domain/refined/uuid";
import {
  PermissionId,
  DocumentPermissionEntity as DocumentPermission,
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

// Re-export WorkflowTag from bootstrap for route compatibility
export { PermissionWorkflowTag } from "../../bootstrap";

/**
 * Dependencies for permission workflows
 */
export interface PermissionWorkflowDeps {
  readonly permissionRepo: PermissionRepository;
  readonly documentRepo: DocumentRepository;
  readonly userRepo: UserRepository;
}

/**
 * Grant permission to a user on a document
 * Uses upsert logic: if permission exists, update it; otherwise create it
 */
export const grantPermission =
  (deps: PermissionWorkflowDeps) =>
  (
    command: GrantPermissionCommand
  ): Effect.Effect<
    GrantPermissionResponse,
    NotFoundError | ForbiddenError | Error
  > =>
    pipe(
      Effect.all({
        document: loadEntity(
          deps.documentRepo.findById(command.documentId),
          "Document",
          command.documentId
        ),
        targetUser: loadEntity(
          deps.userRepo.findById(command.userId),
          "User",
          command.userId
        ),
        grantingUser: loadEntity(
          deps.userRepo.findById(command.grantedBy),
          "User",
          command.grantedBy
        ),
        existingPermissions: deps.permissionRepo.findByUserAndDocument(
          command.userId,
          command.documentId
        ),
      }),
      Effect.flatMap(({ document, grantingUser, existingPermissions }) =>
        isAdmin(grantingUser) || isDocumentOwner(document, grantingUser)
          ? Effect.succeed({ document, existingPermissions })
          : Effect.fail(
              new ForbiddenError({
                message: "Only document owner or admin can grant permissions",
                resource: `Document:${command.documentId}`,
              })
            )
      ),
      Effect.flatMap(({ existingPermissions }) => {
        if (existingPermissions.length > 0) {
          const updatedPermission = existingPermissions[0].updatePermission(
            command.permission
          );
          return pipe(
            deps.permissionRepo.save(updatedPermission),
            Effect.map((permission) => ({
              permission,
              isNew: false,
            }))
          );
        } else {
          const newPermissionId = uuidv4() as PermissionId;
          const newPermission = DocumentPermission.create({
            id: newPermissionId,
            documentId: command.documentId,
            userId: command.userId,
            permission: command.permission,
            grantedBy: command.grantedBy,
          });
          return pipe(
            newPermission,
            Effect.flatMap((permission) =>
              deps.permissionRepo.save(permission)
            ),
            Effect.map((permission) => ({
              permission,
              isNew: true,
            }))
          );
        }
      }),
      Effect.tap(({ permission }) =>
        deps.documentRepo.addAudit(
          command.documentId,
          "permission_granted",
          command.grantedBy,
          Option.some(
            `${command.permission} permission granted to user ${command.userId}`
          )
        )
      ),
      Effect.map(({ permission, isNew }) =>
        PermissionResponseMapper.toGrantPermissionResponse(permission, isNew)
      ),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e))))
    );

/**
 * Update an existing permission
 */
export const updatePermission =
  (deps: PermissionWorkflowDeps) =>
  (
    command: UpdatePermissionCommand
  ): Effect.Effect<
    PermissionResponse,
    NotFoundError | ForbiddenError | Error
  > =>
    pipe(
      loadEntity(
        deps.permissionRepo.findById(command.permissionId),
        "Permission",
        command.permissionId
      ),
      Effect.flatMap((permission) =>
        pipe(
          Effect.all({
            document: loadEntity(
              deps.documentRepo.findById(permission.documentId),
              "Document",
              permission.documentId
            ),
            updatingUser: loadEntity(
              deps.userRepo.findById(command.updatedBy),
              "User",
              command.updatedBy
            ),
          }),
          Effect.map(({ document, updatingUser }) => ({
            permission,
            document,
            updatingUser,
          }))
        )
      ),
      Effect.flatMap(({ permission, document, updatingUser }) =>
        isAdmin(updatingUser) || isDocumentOwner(document, updatingUser)
          ? Effect.succeed(permission)
          : Effect.fail(
              new ForbiddenError({
                message: "Only document owner or admin can update permissions",
                resource: `Permission:${command.permissionId}`,
              })
            )
      ),
      Effect.flatMap((permission) => {
        const updatedPermission = permission.updatePermission(
          command.permission
        );
        return pipe(
          deps.permissionRepo.save(updatedPermission),
          Effect.map((saved) => ({ saved, permission }))
        );
      }),
      Effect.tap(({ permission }) =>
        deps.documentRepo.addAudit(
          permission.documentId,
          "permission_updated",
          command.updatedBy,
          Option.some(
            `Permission ${command.permissionId} updated to ${command.permission}`
          )
        )
      ),
      Effect.map(({ saved }) =>
        PermissionResponseMapper.toPermissionResponse(saved)
      ),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e))))
    );

/**
 * Revoke a permission
 */
export const revokePermission =
  (deps: PermissionWorkflowDeps) =>
  (
    command: RevokePermissionCommand
  ): Effect.Effect<
    void,
    NotFoundError | ForbiddenError | CannotRevokeOwnerPermissionError | Error
  > =>
    pipe(
      loadEntity(
        deps.permissionRepo.findById(command.permissionId),
        "Permission",
        command.permissionId
      ),
      Effect.flatMap((permission) =>
        pipe(
          Effect.all({
            document: loadEntity(
              deps.documentRepo.findById(permission.documentId),
              "Document",
              permission.documentId
            ),
            revokingUser: loadEntity(
              deps.userRepo.findById(command.revokedBy),
              "User",
              command.revokedBy
            ),
          }),
          Effect.map(({ document, revokingUser }) => ({
            permission,
            document,
            revokingUser,
          }))
        )
      ),
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
      Effect.flatMap(({ permission, document, revokingUser }) =>
        isAdmin(revokingUser) || isDocumentOwner(document, revokingUser)
          ? Effect.succeed(permission)
          : Effect.fail(
              new ForbiddenError({
                message: "Only document owner or admin can revoke permissions",
                resource: `Permission:${command.permissionId}`,
              })
            )
      ),
      Effect.flatMap((permission) =>
        pipe(
          deps.permissionRepo.delete(command.permissionId),
          Effect.map(() => permission)
        )
      ),
      Effect.flatMap((permission) =>
        deps.documentRepo.addAudit(
          permission.documentId,
          "permission_revoked",
          command.revokedBy,
          Option.some(
            `Permission ${command.permissionId} revoked from user ${permission.userId}`
          )
        )
      ),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e))))
    );

/**
 * List all permissions for a document
 */
export const listDocumentPermissions =
  (deps: PermissionWorkflowDeps) =>
  (
    query: ListDocumentPermissionsQuery
  ): Effect.Effect<
    ListPermissionsResponse,
    NotFoundError | ForbiddenError | Error
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
      }),
      Effect.flatMap(({ document, user }) =>
        isAdmin(user) || isDocumentOwner(document, user)
          ? Effect.succeed(document)
          : Effect.fail(
              new ForbiddenError({
                message: "Only document owner or admin can list permissions",
                resource: `Document:${query.documentId}`,
              })
            )
      ),
      Effect.flatMap(() =>
        deps.permissionRepo.findByDocument(query.documentId)
      ),
      Effect.map((permissions) =>
        PermissionResponseMapper.toListPermissionsResponse(permissions)
      ),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e))))
    );

/**
 * List all permissions for a user
 */
export const listUserPermissions =
  (deps: PermissionWorkflowDeps) =>
  (
    query: ListUserPermissionsQuery
  ): Effect.Effect<ListPermissionsResponse, Error> =>
    pipe(
      deps.permissionRepo.findByUser(query.userId),
      Effect.map((permissions) =>
        PermissionResponseMapper.toListPermissionsResponse(permissions)
      ),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e))))
    );

/**
 * Check if a user has a specific permission on a document
 */
export const checkPermission =
  (deps: PermissionWorkflowDeps) =>
  (
    query: CheckPermissionQuery
  ): Effect.Effect<CheckPermissionResponse, NotFoundError | Error> =>
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
      Effect.map(({ permissions, hasPermission }) => {
        const userPermission = permissions.find(
          (p) => p.userId === query.userId
        );
        return PermissionResponseMapper.toCheckPermissionResponse(
          hasPermission,
          userPermission?.permission
        );
      }),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e))))
    );
