import { Schema as S, Option, Effect as E, pipe } from "effect";
import { DocumentId } from "../refined/uuid";
import { MetadataKey, MetadataValue } from "./value-object";
import { v4 as uuidv4 } from "uuid";
import {
  BaseEntity,
  IEntity,
  Maybe,
  normalizeMaybe,
  optionToMaybe,
} from "../shared/base-entity";
import { MetadataValidationError } from "./errors";
import * as MetadataGuards from "./guards";
import { MetadataId, DocumentMetadataSchema } from "./schema";

// Re-export MetadataId for convenience (both type and value)
export { MetadataId };

// ============================================================================
// Serialized Types
// ============================================================================
export type SerializedDocumentMetadata = {
  readonly id: string;
  readonly documentId: string;
  readonly key: string;
  readonly value: string;
  readonly createdAt?: Date;
};

/**
 * Metadata map (for convenience)
 */
export type MetadataMap = Record<string, string>;

// ============================================================================
// DocumentMetadata Entity
// ============================================================================

/**
 * Document Metadata Entity - Aggregate Root
 *
 * Represents a key-value metadata entry for a document.
 */
export class DocumentMetadataEntity extends BaseEntity implements IEntity {
  constructor(
    public readonly id: MetadataId,
    public readonly documentId: DocumentId,
    public readonly key: MetadataKey,
    public readonly value: MetadataValue,
    public readonly createdAt: Date
  ) {
    super();
  }

  /**
   * Create a new metadata entry with validation
   */
  static create(
    input: SerializedDocumentMetadata
  ): E.Effect<DocumentMetadataEntity, MetadataValidationError, never> {
    return pipe(
      S.decodeUnknown(DocumentMetadataSchema)(input),
      E.flatMap((data) => {
        // Domain validation - check if key is not reserved
        return pipe(
          MetadataGuards.guardNotReservedKey(data.key),
          E.flatMap(() =>
            E.succeed(
              new DocumentMetadataEntity(
                data.id,
                data.documentId,
                data.key,
                data.value,
                data.createdAt ?? new Date()
              )
            )
          )
        );
      }),
      E.mapError(
        (error) =>
          new MetadataValidationError({
            message: `Metadata validation failed: ${error}`,
          })
      )
    );
  }

  /**
   * Update metadata value
   */
  updateValue(newValue: MetadataValue): DocumentMetadataEntity {
    return new DocumentMetadataEntity(
      this.id,
      this.documentId,
      this.key,
      newValue,
      this.createdAt
    );
  }

  /**
   * Serialize to external format
   */
  serialize(): SerializedDocumentMetadata {
    return {
      id: this.id,
      documentId: this.documentId,
      key: this.key,
      value: this.value,
      createdAt: this.createdAt,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert metadata array to map
 */
export const toMap = (
  metadata: readonly DocumentMetadataEntity[]
): MetadataMap => {
  return Object.fromEntries(metadata.map((m) => [m.key, m.value]));
};

/**
 * Create metadata entries from map
 */
export const fromMap = (
  documentId: DocumentId,
  map: MetadataMap
): DocumentMetadataEntity[] => {
  return Object.entries(map).map(
    ([key, value]) =>
      new DocumentMetadataEntity(
        uuidv4() as MetadataId,
        documentId,
        key as MetadataKey,
        value as MetadataValue,
        new Date()
      )
  );
};
