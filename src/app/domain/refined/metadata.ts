import { Schema as S } from "effect";

/** Allowed MIME types for file uploads */
export const ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",

  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  // Text files
  "text/plain",
  "text/csv",
  "text/html",
  "text/css",
  "text/javascript",
  "application/json",
  "application/xml",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Check if a MIME type is allowed */
export const isAllowedMimeType = (mime: string): mime is AllowedMimeType =>
  ALLOWED_MIME_TYPES.includes(mime.toLowerCase() as AllowedMimeType);

/** Schema filter ensuring MIME type is in the allowed list */
export const ValidMimeType = S.filter(
  (mime: string) => isAllowedMimeType(mime),
  { message: () => "MIME type is not allowed" }
);

/** Opaque file key used by storage providers */
export const FileKey = S.String.pipe(
  S.filter((value) => value.trim().length > 0, {
    message: () => "FileKey must be non-empty",
  }),
  S.brand("FileKey")
);
export type FileKey = S.Schema.Type<typeof FileKey>;

/** Non-negative integer byte size */
export const FileSize = S.Number.pipe(
  S.int(),
  S.filter((value) => value >= 0, { message: () => "FileSize must be >= 0" }),
  S.brand("FileSize")
);
export type FileSize = S.Schema.Type<typeof FileSize>;

/** Async/sync constructors */
export const makeFileKey = (input: unknown) => S.decodeUnknown(FileKey)(input);
export const makeFileSize = (input: unknown) =>
  S.decodeUnknown(FileSize)(input);

export const makeFileKeySync = (input: unknown) =>
  S.decodeUnknownSync(FileKey)(input);
export const makeFileSizeSync = (input: unknown) =>
  S.decodeUnknownSync(FileSize)(input);
