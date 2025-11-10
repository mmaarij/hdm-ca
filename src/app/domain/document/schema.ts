import { Schema as S } from "effect";
import { DocumentId, DocumentVersionId, UserId } from "../refined/uuid";
import {
  Filename,
  FilePath,
  MimeType,
  FileSize,
  VersionNumber,
  ContentRef,
  Checksum,
} from "./value-object";

/**
 * Document Domain Schemas
 *
 * These schemas are used for validation and encoding/decoding of domain entities.
 * They define the structure for external input/output and ensure data integrity.
 *
 * Note: Entity schemas use S.Date for internal date representation.
 * API DTOs use DateTime (DateFromString with branding) for JSON serialization.
 */

// ============================================================================
// Document Version Schema
// ============================================================================

/**
 * DocumentVersion Schema for validation and encoding/decoding
 */
export const DocumentVersionSchema = S.Struct({
  id: DocumentVersionId,
  documentId: DocumentId,
  filename: Filename,
  originalName: Filename,
  mimeType: MimeType,
  size: FileSize,
  path: S.optional(FilePath),
  contentRef: S.optional(ContentRef),
  checksum: S.optional(Checksum),
  versionNumber: VersionNumber,
  uploadedBy: UserId,
  createdAt: S.optional(S.Date),
});

/**
 * Type derived from DocumentVersion Schema
 */
export type DocumentVersionSchemaType = S.Schema.Type<
  typeof DocumentVersionSchema
>;

// ============================================================================
// Document Schema
// ============================================================================

/**
 * Document Schema for validation and encoding/decoding
 */
export const DocumentSchema = S.Struct({
  id: DocumentId,
  filename: Filename,
  originalName: Filename,
  mimeType: MimeType,
  size: FileSize,
  path: S.optional(FilePath),
  uploadedBy: UserId,
  createdAt: S.optional(S.Date),
  updatedAt: S.optional(S.Date),
});

/**
 * Type derived from Document Schema
 */
export type DocumentSchemaType = S.Schema.Type<typeof DocumentSchema>;
