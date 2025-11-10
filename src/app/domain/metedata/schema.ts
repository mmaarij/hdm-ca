import { Schema as S } from "effect";
import { DocumentId, Uuid } from "../refined/uuid";
import { MetadataKey, MetadataValue } from "./value-object";

/**
 * Metadata Domain Schemas
 *
 * These schemas are used for validation and encoding/decoding of metadata entities.
 * They define the structure for external input/output and ensure data integrity.
 *
 * Note: Entity schemas use S.Date for internal date representation.
 * API DTOs use DateTime (DateFromString with branding) for JSON serialization.
 */

// ============================================================================
// Metadata ID Schema
// ============================================================================

/**
 * Metadata ID Schema
 */
export const MetadataId = Uuid.pipe(S.brand("MetadataId"));
export type MetadataId = S.Schema.Type<typeof MetadataId>;

// ============================================================================
// DocumentMetadata Schema
// ============================================================================

/**
 * DocumentMetadata Schema for validation and encoding/decoding
 */
export const DocumentMetadataSchema = S.Struct({
  id: MetadataId,
  documentId: DocumentId,
  key: MetadataKey,
  value: MetadataValue,
  createdAt: S.optional(S.Date),
});

/**
 * Type derived from DocumentMetadata Schema
 */
export type DocumentMetadataSchemaType = S.Schema.Type<
  typeof DocumentMetadataSchema
>;
