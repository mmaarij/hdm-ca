/**
 * Permission Request DTOs
 */

import { Schema as S } from "effect";
import { DocumentId, UserId } from "../../../domain/refined/uuid";
import { PermissionId } from "../../../domain/permission/entity";
import { PermissionType } from "../../../domain/permission/value-object";

/**
 * Grant Permission Command
 */
export const GrantPermissionCommand = S.Struct({
  documentId: DocumentId,
  userId: UserId, // User to grant permission to
  permission: PermissionType,
  grantedBy: UserId, // User granting the permission
});

export type GrantPermissionCommand = S.Schema.Type<
  typeof GrantPermissionCommand
>;

/**
 * Update Permission Command
 */
export const UpdatePermissionCommand = S.Struct({
  permissionId: PermissionId,
  permission: PermissionType,
  updatedBy: UserId, // For authorization check
});

export type UpdatePermissionCommand = S.Schema.Type<
  typeof UpdatePermissionCommand
>;

/**
 * Revoke Permission Command
 */
export const RevokePermissionCommand = S.Struct({
  permissionId: PermissionId,
  revokedBy: UserId, // For authorization check
});

export type RevokePermissionCommand = S.Schema.Type<
  typeof RevokePermissionCommand
>;

/**
 * List Document Permissions Query
 */
export const ListDocumentPermissionsQuery = S.Struct({
  documentId: DocumentId,
  userId: UserId, // For authorization check
});

export type ListDocumentPermissionsQuery = S.Schema.Type<
  typeof ListDocumentPermissionsQuery
>;

/**
 * List User Permissions Query
 */
export const ListUserPermissionsQuery = S.Struct({
  userId: UserId,
});

export type ListUserPermissionsQuery = S.Schema.Type<
  typeof ListUserPermissionsQuery
>;

/**
 * Check Permission Query
 */
export const CheckPermissionQuery = S.Struct({
  documentId: DocumentId,
  userId: UserId,
  requiredPermission: PermissionType,
});

export type CheckPermissionQuery = S.Schema.Type<typeof CheckPermissionQuery>;
