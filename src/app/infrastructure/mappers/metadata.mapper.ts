import { Option } from "effect";
import { DocumentMetadata, MetadataId } from "../../domain/metedata/entity";
import { DocumentId } from "../../domain/refined/uuid";
import { MetadataKey, MetadataValue } from "../../domain/metedata/value-object";

/**
 * Database row type for Metadata (from Drizzle)
 */
export interface MetadataRow {
  id: string;
  documentId: string;
  key: string;
  value: string;
  createdAt: Date | string;
}

/**
 * Metadata Mapper - Infrastructure ↔ Domain
 */
export const MetadataMapper = {
  /**
   * Database → Domain
   */
  toDomain: (row: MetadataRow): DocumentMetadata => ({
    id: row.id as MetadataId,
    documentId: row.documentId as DocumentId,
    key: row.key as MetadataKey,
    value: row.value as MetadataValue,
    createdAt:
      typeof row.createdAt === "string"
        ? new Date(row.createdAt)
        : row.createdAt,
  }),

  /**
   * Domain → Database Create Input
   */
  toDbCreate: (metadata: DocumentMetadata) => ({
    id: metadata.id,
    documentId: metadata.documentId,
    key: metadata.key,
    value: metadata.value,
    createdAt: metadata.createdAt.toISOString(),
  }),

  /**
   * Domain → Database Update Input
   */
  toDbUpdate: (metadata: DocumentMetadata) => ({
    value: metadata.value,
  }),

  /**
   * Convert array of rows to domain entities
   */
  toDomainMany: (rows: MetadataRow[]): DocumentMetadata[] =>
    rows.map(MetadataMapper.toDomain),
};
