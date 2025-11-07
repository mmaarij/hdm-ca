import { Schema as S } from "effect";
import {
  DownloadTokenId,
  DocumentId,
  DocumentVersionId,
  UserId,
} from "../refined/uuid";
import { DateTime } from "../refined/date-time";
import { Token } from "./value-object";

/**
 * Download Token Domain Schemas
 *
 * These schemas are used for validation and encoding/decoding of download token entities.
 * They define the structure for external input/output and ensure data integrity.
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
  expiresAt: DateTime,
  usedAt: S.optional(DateTime),
  createdBy: UserId,
  createdAt: S.optional(DateTime),
});

/**
 * Type derived from DownloadToken Schema
 */
export type DownloadTokenSchemaType = S.Schema.Type<typeof DownloadTokenSchema>;

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
