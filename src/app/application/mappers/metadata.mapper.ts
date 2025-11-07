/**
 * Metadata Application → Domain Mappers
 *
 * Maps Application DTOs to Domain entities for metadata operations.
 */

import type {
  AddMetadataCommand,
  UpdateMetadataCommand,
} from "../dtos/metedata/request.dto";
import type {
  MetadataResponse,
  ListMetadataResponse,
  MetadataMapResponse,
} from "../dtos/metedata/response.dto";
import type { DocumentMetadataEntity as DocumentMetadata } from "../../domain/metedata/entity";
import type { DocumentId, UserId } from "../../domain/refined/uuid";
import type {
  MetadataKey,
  MetadataValue,
} from "../../domain/metedata/value-object";

/**
 * Command to Domain Mappers
 */
export const MetadataCommandMapper = {
  /**
   * Map AddMetadataCommand to DocumentMetadata.create parameters
   */
  toCreateParams: (
    command: AddMetadataCommand
  ): {
    documentId: DocumentId;
    key: MetadataKey;
    value: MetadataValue;
  } => ({
    documentId: command.documentId,
    key: command.key,
    value: command.value,
  }),

  /**
   * Map UpdateMetadataCommand to DocumentMetadata.update parameters
   */
  toUpdateParams: (
    command: UpdateMetadataCommand
  ): {
    value: MetadataValue;
  } => ({
    value: command.value,
  }),
} as const;

/**
 * Domain to Response Mappers
 */
export const MetadataResponseMapper = {
  /**
   * Map DocumentMetadata entity to MetadataResponse DTO
   */
  toMetadataResponse: (metadata: DocumentMetadata): MetadataResponse => ({
    id: metadata.id,
    documentId: metadata.documentId,
    key: metadata.key,
    value: metadata.value,
    createdAt: metadata.createdAt as any, // Branded Date type
  }),

  /**
   * Map metadata list to ListMetadataResponse DTO
   */
  toListMetadataResponse: (
    metadata: readonly DocumentMetadata[]
  ): ListMetadataResponse => ({
    metadata: metadata.map(MetadataResponseMapper.toMetadataResponse),
    total: metadata.length,
  }),

  /**
   * Map metadata list to key-value map
   */
  toMetadataMapResponse: (
    metadata: readonly DocumentMetadata[]
  ): MetadataMapResponse => {
    return metadata.reduce((acc, m) => {
      acc[m.key] = m.value;
      return acc;
    }, {} as Record<string, string>) as MetadataMapResponse;
  },
} as const;
