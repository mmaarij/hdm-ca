/**
 * Permission Response DTOs
 */

import { Schema as S } from "effect";
import { DocumentId, UserId } from "../../../domain/refined/uuid";
import { PermissionId } from "../../../domain/permission/entity";
import { PermissionType } from "../../../domain/permission/value-object";
import { DateTime } from "../../../domain/refined/date-time";

/**
 * Permission Response
 */
export const PermissionResponse = S.Struct({
  id: PermissionId,
  documentId: DocumentId,
  userId: UserId,
  permission: PermissionType,
  grantedBy: UserId,
  grantedAt: S.optional(DateTime),
});

export type PermissionResponse = S.Schema.Type<typeof PermissionResponse>;

/**
 * Grant Permission Response
 */
export const GrantPermissionResponse = S.Struct({
  permission: PermissionResponse,
  message: S.String,
});

export type GrantPermissionResponse = S.Schema.Type<
  typeof GrantPermissionResponse
>;

/**
 * List Permissions Response
 */
export const ListPermissionsResponse = S.Struct({
  permissions: S.Array(PermissionResponse),
  total: S.Number,
});

export type ListPermissionsResponse = S.Schema.Type<
  typeof ListPermissionsResponse
>;

/**
 * Check Permission Response
 */
export const CheckPermissionResponse = S.Struct({
  hasPermission: S.Boolean,
  permission: S.optional(PermissionType),
});

export type CheckPermissionResponse = S.Schema.Type<
  typeof CheckPermissionResponse
>;
