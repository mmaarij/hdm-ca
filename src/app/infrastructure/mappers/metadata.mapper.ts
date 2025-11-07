import { Option } from "effect";
import {
  DocumentMetadataEntity,
  MetadataId,
} from "../../domain/metedata/entity";
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
  toDomain: (row: MetadataRow): DocumentMetadataEntity =>
    new DocumentMetadataEntity(
      row.id as MetadataId,
      row.documentId as DocumentId,
      row.key as MetadataKey,
      row.value as MetadataValue,
      typeof row.createdAt === "string"
        ? new Date(row.createdAt)
        : row.createdAt
    ),

  /**
   * Domain → Database Create Input
   */
  toDbCreate: (metadata: DocumentMetadataEntity) => ({
    id: metadata.id,
    documentId: metadata.documentId,
    key: metadata.key,
    value: metadata.value,
    createdAt: metadata.createdAt.toISOString(),
  }),

  /**
   * Domain → Database Update Input
   */
  toDbUpdate: (metadata: DocumentMetadataEntity) => ({
    value: metadata.value,
  }),

  /**
   * Convert array of rows to domain entities
   */
  toDomainMany: (rows: MetadataRow[]): DocumentMetadataEntity[] =>
    rows.map(MetadataMapper.toDomain),
};
