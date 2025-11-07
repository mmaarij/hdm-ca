import { Schema as S, Option } from "effect";
import { DocumentId, UserId } from "../refined/uuid";
import { DateTime } from "../refined/date-time";
import { PermissionType } from "./value-object";
import { v4 as uuidv4 } from "uuid";

/**
 * Permission ID Schema (using generic Uuid)
 */
import { Uuid } from "../refined/uuid";

export const PermissionId = Uuid.pipe(S.brand("PermissionId"));
export type PermissionId = S.Schema.Type<typeof PermissionId>;

/**
 * Document Permission Entity - Pure Domain Model
 *
 * Represents an access control rule for a document.
 */
export interface DocumentPermission {
  readonly id: PermissionId;
  readonly documentId: DocumentId;
  readonly userId: UserId;
  readonly permission: PermissionType;
  readonly grantedBy: UserId;
  readonly grantedAt: Date;
}

/**
 * Factory functions for DocumentPermission entity
 */
export const DocumentPermission = {
  /**
   * Create a new permission
   */
  create: (props: {
    documentId: DocumentId;
    userId: UserId;
    permission: PermissionType;
    grantedBy: UserId;
  }): DocumentPermission => ({
    id: uuidv4() as PermissionId,
    documentId: props.documentId,
    userId: props.userId,
    permission: props.permission,
    grantedBy: props.grantedBy,
    grantedAt: new Date(),
  }),

  /**
   * Update permission level
   */
  updatePermission: (
    permission: DocumentPermission,
    newPermissionType: PermissionType
  ): DocumentPermission => ({
    ...permission,
    permission: newPermissionType,
  }),
};

// ============================================================================
// Schema Definitions for Validation (kept for backward compatibility)
// ============================================================================

/**
 * DocumentPermission Schema for validation
 */
export const DocumentPermissionSchema = S.Struct({
  id: PermissionId,
  documentId: DocumentId,
  userId: UserId,
  permission: PermissionType,
  grantedBy: UserId,
  grantedAt: S.optional(DateTime),
});
