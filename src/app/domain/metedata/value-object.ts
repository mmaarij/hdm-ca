import { Schema as S } from "effect";

/**
 * Metadata key schema
 */
export const MetadataKey = S.String.pipe(
  S.filter((value) => value.trim().length > 0, {
    message: () => "Metadata key cannot be empty",
  }),
  S.filter((value) => value.length <= 100, {
    message: () => "Metadata key cannot exceed 100 characters",
  }),
  S.filter((value) => /^[a-zA-Z0-9_.-]+$/.test(value), {
    message: () =>
      "Metadata key can only contain alphanumeric characters, underscores, dots, and hyphens",
  }),
  S.brand("MetadataKey")
);

export type MetadataKey = S.Schema.Type<typeof MetadataKey>;

/**
 * Metadata value schema
 */
export const MetadataValue = S.String.pipe(
  S.filter((value) => value.length <= 1000, {
    message: () => "Metadata value cannot exceed 1000 characters",
  }),
  S.brand("MetadataValue")
);

export type MetadataValue = S.Schema.Type<typeof MetadataValue>;

/**
 * Reserved metadata keys (system-managed)
 */
export const RESERVED_METADATA_KEYS = [
  "system.createdAt",
  "system.updatedAt",
  "system.version",
  "system.checksum",
] as const;

/**
 * Check if a key is reserved
 */
export const isReservedKey = (key: string): boolean =>
  RESERVED_METADATA_KEYS.includes(key as any);

/**
 * Constructors
 */
export const makeMetadataKey = (input: unknown) =>
  S.decodeUnknown(MetadataKey)(input);

export const makeMetadataValue = (input: unknown) =>
  S.decodeUnknown(MetadataValue)(input);
