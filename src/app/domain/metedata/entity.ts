import { Schema as S } from "effect";
import { DocumentId } from "../refined/uuid";
import { Uuid } from "../refined/uuid";
import { DateTime } from "../refined/date-time";
import { MetadataKey, MetadataValue } from "./value-object";

/**
 * Metadata ID Schema
 */
export const MetadataId = Uuid.pipe(S.brand("MetadataId"));
export type MetadataId = S.Schema.Type<typeof MetadataId>;

/**
 * Document Metadata Entity
 *
 * Represents a key-value metadata entry for a document.
 */
export const DocumentMetadata = S.Struct({
  id: MetadataId,
  documentId: DocumentId,
  key: MetadataKey,
  value: MetadataValue,
  createdAt: S.optional(DateTime),
});

export type DocumentMetadata = S.Schema.Type<typeof DocumentMetadata>;

/**
 * Create Metadata payload
 */
export const CreateMetadataPayload = S.Struct({
  id: S.optional(MetadataId),
  documentId: DocumentId,
  key: MetadataKey,
  value: MetadataValue,
});

export type CreateMetadataPayload = S.Schema.Type<typeof CreateMetadataPayload>;

/**
 * Update Metadata payload
 */
export const UpdateMetadataPayload = S.Struct({
  value: MetadataValue,
});

export type UpdateMetadataPayload = S.Schema.Type<typeof UpdateMetadataPayload>;

/**
 * Metadata map (for convenience)
 */
export type MetadataMap = Record<string, string>;

/**
 * Convert metadata array to map
 */
export const toMetadataMap = (
  metadata: readonly DocumentMetadata[]
): MetadataMap => {
  return Object.fromEntries(metadata.map((m) => [m.key, m.value]));
};

/**
 * Convert metadata map to array
 */
export const fromMetadataMap = (
  documentId: DocumentId,
  map: MetadataMap
): CreateMetadataPayload[] => {
  return Object.entries(map).map(([key, value]) => ({
    documentId,
    key: key as MetadataKey,
    value: value as MetadataValue,
  }));
};
