/**
 * Permission Request DTOs
 *
 * Each operation has two schemas:
 * - *Input: Raw input from API (strings) - used by presentation layer
 * - *Command/*Query: Branded domain types - used by workflows after transformation
 */

import { Schema as S } from "effect";
import {
  DocumentId,
  UserId,
  StringToDocumentId,
  StringToUserId,
} from "../../../domain/refined/uuid";
import { PermissionId } from "../../../domain/permission/entity";
import { PermissionType } from "../../../domain/permission/value-object";

// ============================================================================
// Grant Permission
// ============================================================================

/**
 * Raw input from API
 */
export const GrantPermissionInput = S.Struct({
  documentId: S.String,
  userId: S.String,
  permission: S.String,
  grantedBy: S.String,
});
export type GrantPermissionInput = S.Schema.Type<typeof GrantPermissionInput>;

/**
 * Branded command for workflows
 */
export const GrantPermissionCommand = S.Struct({
  documentId: StringToDocumentId,
  userId: StringToUserId,
  permission: PermissionType,
  grantedBy: StringToUserId,
});
export type GrantPermissionCommand = S.Schema.Type<
  typeof GrantPermissionCommand
>;

// ============================================================================
// Update Permission
// ============================================================================

/**
 * Raw input from API
 */
export const UpdatePermissionInput = S.Struct({
  permissionId: S.String,
  permission: S.String,
  updatedBy: S.String,
});
export type UpdatePermissionInput = S.Schema.Type<typeof UpdatePermissionInput>;

/**
 * Branded command for workflows
 */
export const UpdatePermissionCommand = S.Struct({
  permissionId: PermissionId,
  permission: PermissionType,
  updatedBy: StringToUserId,
});
export type UpdatePermissionCommand = S.Schema.Type<
  typeof UpdatePermissionCommand
>;

// ============================================================================
// Revoke Permission
// ============================================================================

/**
 * Raw input from API
 */
export const RevokePermissionInput = S.Struct({
  permissionId: S.String,
  revokedBy: S.String,
});
export type RevokePermissionInput = S.Schema.Type<typeof RevokePermissionInput>;

/**
 * Branded command for workflows
 */
export const RevokePermissionCommand = S.Struct({
  permissionId: PermissionId,
  revokedBy: StringToUserId,
});
export type RevokePermissionCommand = S.Schema.Type<
  typeof RevokePermissionCommand
>;

// ============================================================================
// List Document Permissions
// ============================================================================

/**
 * Raw input from API
 */
export const ListDocumentPermissionsInput = S.Struct({
  documentId: S.String,
  userId: S.String,
});
export type ListDocumentPermissionsInput = S.Schema.Type<
  typeof ListDocumentPermissionsInput
>;

/**
 * Branded query for workflows
 */
export const ListDocumentPermissionsQuery = S.Struct({
  documentId: StringToDocumentId,
  userId: StringToUserId,
});
export type ListDocumentPermissionsQuery = S.Schema.Type<
  typeof ListDocumentPermissionsQuery
>;

// ============================================================================
// List User Permissions
// ============================================================================

/**
 * Raw input from API
 */
export const ListUserPermissionsInput = S.Struct({
  userId: S.String,
});
export type ListUserPermissionsInput = S.Schema.Type<
  typeof ListUserPermissionsInput
>;

/**
 * Branded query for workflows
 */
export const ListUserPermissionsQuery = S.Struct({
  userId: StringToUserId,
});
export type ListUserPermissionsQuery = S.Schema.Type<
  typeof ListUserPermissionsQuery
>;

// ============================================================================
// Check Permission
// ============================================================================

/**
 * Raw input from API
 */
export const CheckPermissionInput = S.Struct({
  documentId: S.String,
  userId: S.String,
  requiredPermission: S.String,
});
export type CheckPermissionInput = S.Schema.Type<typeof CheckPermissionInput>;

/**
 * Branded query for workflows
 */
export const CheckPermissionQuery = S.Struct({
  documentId: StringToDocumentId,
  userId: StringToUserId,
  requiredPermission: PermissionType,
});
export type CheckPermissionQuery = S.Schema.Type<typeof CheckPermissionQuery>;
