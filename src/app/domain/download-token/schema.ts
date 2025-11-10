import { Schema as S } from "effect";
import {
  DownloadTokenId,
  DocumentId,
  DocumentVersionId,
  UserId,
} from "../refined/uuid";
import { Token } from "./value-object";

/**
 * Download Token Domain Schemas
 *
 * These schemas are used for validation and encoding/decoding of download token entities.
 * They define the structure for external input/output and ensure data integrity.
 *
 * Note: Entity schemas use S.Date for internal date representation.
 * API DTOs use DateTime (DateFromString with branding) for JSON serialization.
 */

// ============================================================================
// DownloadToken Schema
// ============================================================================

/**
 * DownloadToken Schema for validation and encoding/decoding
 */
export const DownloadTokenSchema = S.Struct({
  id: DownloadTokenId,
  documentId: DocumentId,
  versionId: S.optional(DocumentVersionId),
  token: Token,
  expiresAt: S.Date,
  usedAt: S.optional(S.Date),
  createdBy: UserId,
  createdAt: S.optional(S.Date),
});

/**
 * Type derived from DownloadToken Schema
 */
export type DownloadTokenSchemaType = S.Schema.Type<typeof DownloadTokenSchema>;

// Note: This schema is for API responses, not entity storage
// Import DateTime here only for API boundary
import { DateTime } from "../refined/date-time";

/**
 * DownloadTokenWithDocument Schema for API responses
 */
export const DownloadTokenWithDocumentSchema = S.Struct({
  token: Token,
  documentId: DocumentId,
  versionId: S.optional(DocumentVersionId),
  expiresAt: DateTime,
  downloadUrl: S.String,
});

/**
 * Type derived from DownloadTokenWithDocument Schema
 */
export type DownloadTokenWithDocumentSchemaType = S.Schema.Type<
  typeof DownloadTokenWithDocumentSchema
>;
