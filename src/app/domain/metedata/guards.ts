import { Effect } from "effect";
import { DocumentMetadata } from "./entity";
import { isReservedKey } from "./value-object";
import { MetadataValidationError } from "./errors";

/**
 * Metadata Domain Business Rules and Guards
 */

/**
 * Guard: Metadata key must not be reserved
 */
export const guardNotReservedKey = (
  key: string
): Effect.Effect<void, MetadataValidationError> =>
  !isReservedKey(key)
    ? Effect.void
    : Effect.fail(
        new MetadataValidationError({
          message: `Metadata key '${key}' is reserved and cannot be used`,
          field: "key",
        })
      );

/**
 * Find metadata by key
 */
export const findMetadataByKey = (
  metadata: readonly DocumentMetadata[],
  key: string
): DocumentMetadata | undefined => {
  return metadata.find((m) => m.key === key);
};

/**
 * Check if metadata key exists
 */
export const hasMetadataKey = (
  metadata: readonly DocumentMetadata[],
  key: string
): boolean => {
  return metadata.some((m) => m.key === key);
};

/**
 * Get metadata value by key
 */
export const getMetadataValue = (
  metadata: readonly DocumentMetadata[],
  key: string
): string | undefined => {
  return findMetadataByKey(metadata, key)?.value;
};

/**
 * Filter metadata by key pattern
 */
export const filterMetadataByPattern = (
  metadata: readonly DocumentMetadata[],
  pattern: RegExp
): readonly DocumentMetadata[] => {
  return metadata.filter((m) => pattern.test(m.key));
};

/**
 * Count metadata entries for a document
 */
export const countMetadata = (
  metadata: readonly DocumentMetadata[]
): number => {
  return metadata.length;
};

/**
 * Business rule: Max metadata entries per document
 */
export const MAX_METADATA_PER_DOCUMENT = 50;

/**
 * Guard: Check metadata limit
 */
export const guardMetadataLimit = (
  currentCount: number
): Effect.Effect<void, MetadataValidationError> =>
  currentCount < MAX_METADATA_PER_DOCUMENT
    ? Effect.void
    : Effect.fail(
        new MetadataValidationError({
          message: `Cannot exceed ${MAX_METADATA_PER_DOCUMENT} metadata entries per document`,
        })
      );
