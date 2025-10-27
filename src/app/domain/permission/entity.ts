import { Schema as S } from "effect";
import { DocumentId, UserId } from "../refined/uuid";
import { DateTime } from "../refined/date-time";
import { PermissionType } from "./value-object";

/**
 * Permission ID Schema (using generic Uuid)
 */
import { Uuid } from "../refined/uuid";

export const PermissionId = Uuid.pipe(S.brand("PermissionId"));
export type PermissionId = S.Schema.Type<typeof PermissionId>;

/**
 * Document Permission Entity
 *
 * Represents an access control rule for a document.
 */
export const DocumentPermission = S.Struct({
  id: PermissionId,
  documentId: DocumentId,
  userId: UserId,
  permission: PermissionType,
  grantedBy: UserId,
  grantedAt: S.optional(DateTime),
});

export type DocumentPermission = S.Schema.Type<typeof DocumentPermission>;

/**
 * Create Permission payload
 */
export const CreatePermissionPayload = S.Struct({
  id: S.optional(PermissionId),
  documentId: DocumentId,
  userId: UserId,
  permission: PermissionType,
  grantedBy: UserId,
});

export type CreatePermissionPayload = S.Schema.Type<
  typeof CreatePermissionPayload
>;

/**
 * Update Permission payload
 */
export const UpdatePermissionPayload = S.Struct({
  permission: PermissionType,
});

export type UpdatePermissionPayload = S.Schema.Type<
  typeof UpdatePermissionPayload
>;
