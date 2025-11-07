import { Schema as S, Option } from "effect";
import { DocumentId } from "../refined/uuid";
import { Uuid } from "../refined/uuid";
import { DateTime } from "../refined/date-time";
import { MetadataKey, MetadataValue } from "./value-object";
import { v4 as uuidv4 } from "uuid";

/**
 * Metadata ID Schema
 */
export const MetadataId = Uuid.pipe(S.brand("MetadataId"));
export type MetadataId = S.Schema.Type<typeof MetadataId>;

/**
 * Document Metadata Entity - Pure Domain Model
 *
 * Represents a key-value metadata entry for a document.
 */
export interface DocumentMetadata {
  readonly id: MetadataId;
  readonly documentId: DocumentId;
  readonly key: MetadataKey;
  readonly value: MetadataValue;
  readonly createdAt: Date;
}

/**
 * Metadata map (for convenience)
 */
export type MetadataMap = Record<string, string>;

/**
 * Factory functions for DocumentMetadata entity
 */
export const DocumentMetadata = {
  /**
   * Create a new metadata entry
   */
  create: (props: {
    documentId: DocumentId;
    key: MetadataKey;
    value: MetadataValue;
  }): DocumentMetadata => ({
    id: uuidv4() as MetadataId,
    documentId: props.documentId,
    key: props.key,
    value: props.value,
    createdAt: new Date(),
  }),

  /**
   * Update metadata value
   */
  updateValue: (
    metadata: DocumentMetadata,
    newValue: MetadataValue
  ): DocumentMetadata => ({
    ...metadata,
    value: newValue,
  }),

  /**
   * Convert metadata array to map
   */
  toMap: (metadata: readonly DocumentMetadata[]): MetadataMap => {
    return Object.fromEntries(metadata.map((m) => [m.key, m.value]));
  },

  /**
   * Create metadata entries from map
   */
  fromMap: (documentId: DocumentId, map: MetadataMap): DocumentMetadata[] => {
    return Object.entries(map).map(([key, value]) =>
      DocumentMetadata.create({
        documentId,
        key: key as MetadataKey,
        value: value as MetadataValue,
      })
    );
  },
};

// ============================================================================
// Schema Definitions for Validation (kept for backward compatibility)
// ============================================================================

/**
 * DocumentMetadata Schema for validation
 */
export const DocumentMetadataSchema = S.Struct({
  id: MetadataId,
  documentId: DocumentId,
  key: MetadataKey,
  value: MetadataValue,
  createdAt: S.optional(DateTime),
});
