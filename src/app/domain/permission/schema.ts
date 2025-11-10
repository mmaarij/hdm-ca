import { Schema as S } from "effect";
import { DocumentId, UserId, Uuid } from "../refined/uuid";
import { PermissionType } from "./value-object";

/**
 * Permission Domain Schemas
 *
 * These schemas are used for validation and encoding/decoding of permission entities.
 * They define the structure for external input/output and ensure data integrity.
 *
 * Note: Entity schemas use S.Date for internal date representation.
 * API DTOs use DateTime (DateFromString with branding) for JSON serialization.
 */

// ============================================================================
// Permission ID Schema
// ============================================================================

/**
 * Permission ID Schema (using generic Uuid)
 */
export const PermissionId = Uuid.pipe(S.brand("PermissionId"));
export type PermissionId = S.Schema.Type<typeof PermissionId>;

// ============================================================================
// DocumentPermission Schema
// ============================================================================

/**
 * DocumentPermission Schema for validation and encoding/decoding
 */
export const DocumentPermissionSchema = S.Struct({
  id: PermissionId,
  documentId: DocumentId,
  userId: UserId,
  permission: PermissionType,
  grantedBy: UserId,
  grantedAt: S.optional(S.Date),
});

/**
 * Type derived from DocumentPermission Schema
 */
export type DocumentPermissionSchemaType = S.Schema.Type<
  typeof DocumentPermissionSchema
>;
