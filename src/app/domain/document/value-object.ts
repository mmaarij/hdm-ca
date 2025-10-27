import { Schema as S } from "effect";

/**
 * Document-specific value objects
 */

/** File size limit (100 MB in bytes) */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

/** Minimum file size */
export const MIN_FILE_SIZE = 1;

/**
 * Filename schema
 */
export const Filename = S.String.pipe(
  S.filter((value) => value.trim().length > 0, {
    message: () => "Filename cannot be empty",
  }),
  S.filter((value) => value.length <= 255, {
    message: () => "Filename cannot exceed 255 characters",
  }),
  S.brand("Filename")
);

export type Filename = S.Schema.Type<typeof Filename>;

/**
 * File path schema (storage path)
 */
export const FilePath = S.String.pipe(
  S.filter((value) => value.trim().length > 0, {
    message: () => "File path cannot be empty",
  }),
  S.brand("FilePath")
);

export type FilePath = S.Schema.Type<typeof FilePath>;

/**
 * MIME type schema
 * Supports standard MIME types with optional parameters (e.g., charset)
 * Examples: text/plain, application/json, text/html;charset=utf-8
 */
export const MimeType = S.String.pipe(
  S.filter((value) => value.trim().length > 0, {
    message: () => "MIME type cannot be empty",
  }),
  S.filter((value) => /^[\w-]+\/[\w-+.]+(?:;[\w-]+=[\w-]+)*$/.test(value), {
    message: () => "Invalid MIME type format",
  }),
  S.brand("MimeType")
);

export type MimeType = S.Schema.Type<typeof MimeType>;

/**
 * File size schema (in bytes)
 */
export const FileSize = S.Number.pipe(
  S.int(),
  S.filter((value) => value >= MIN_FILE_SIZE, {
    message: () => `File size must be at least ${MIN_FILE_SIZE} byte`,
  }),
  S.filter((value) => value <= MAX_FILE_SIZE, {
    message: () => `File size cannot exceed ${MAX_FILE_SIZE} bytes (100 MB)`,
  }),
  S.brand("FileSize")
);

export type FileSize = S.Schema.Type<typeof FileSize>;

/**
 * Version number schema
 */
export const VersionNumber = S.Number.pipe(
  S.int(),
  S.filter((value) => value >= 1, {
    message: () => "Version number must be at least 1",
  }),
  S.brand("VersionNumber")
);

export type VersionNumber = S.Schema.Type<typeof VersionNumber>;

/** Constructors */
export const makeFilename = (input: unknown) =>
  S.decodeUnknown(Filename)(input);
export const makeFilePath = (input: unknown) =>
  S.decodeUnknown(FilePath)(input);
export const makeMimeType = (input: unknown) =>
  S.decodeUnknown(MimeType)(input);
export const makeFileSize = (input: unknown) =>
  S.decodeUnknown(FileSize)(input);
export const makeVersionNumber = (input: unknown) =>
  S.decodeUnknown(VersionNumber)(input);
