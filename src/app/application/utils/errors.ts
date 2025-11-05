import { Data } from "effect";

/**
 * Application-level errors
 *
 * These extend domain errors with application-specific context
 * and are used to communicate use case failures to the presentation layer.
 */

/**
 * Authentication errors
 */
export class InvalidCredentialsError extends Data.TaggedError(
  "InvalidCredentialsError"
)<{
  readonly message: string;
}> {}

export class TokenExpiredError extends Data.TaggedError("TokenExpiredError")<{
  readonly message: string;
}> {}

export class TokenInvalidError extends Data.TaggedError("TokenInvalidError")<{
  readonly message: string;
}> {}

/**
 * File upload errors
 */
export class FileUploadError extends Data.TaggedError("FileUploadError")<{
  readonly message: string;
  readonly filename?: string;
  readonly cause?: unknown;
}> {}

export class FileSizeExceededError extends Data.TaggedError(
  "FileSizeExceededError"
)<{
  readonly message: string;
  readonly maxSize: number;
  readonly actualSize: number;
}> {}

export class UnsupportedFileTypeError extends Data.TaggedError(
  "UnsupportedFileTypeError"
)<{
  readonly message: string;
  readonly mimeType: string;
}> {}

/**
 * Download errors
 */
export class DownloadTokenExpiredError extends Data.TaggedError(
  "DownloadTokenExpiredError"
)<{
  readonly message: string;
  readonly token: string;
  readonly expiresAt: Date;
}> {}

export class DownloadTokenNotFoundError extends Data.TaggedError(
  "DownloadTokenNotFoundError"
)<{
  readonly message: string;
  readonly token: string;
}> {}

export class DownloadTokenAlreadyUsedError extends Data.TaggedError(
  "DownloadTokenAlreadyUsedError"
)<{
  readonly message: string;
  readonly token: string;
  readonly usedAt: Date;
}> {}

/**
 * Permission errors (application-level)
 */
export class InsufficientPermissionError extends Data.TaggedError(
  "InsufficientPermissionError"
)<{
  readonly message: string;
  readonly requiredPermission: string;
  readonly resource: string;
}> {}

export class CannotRevokeOwnerPermissionError extends Data.TaggedError(
  "CannotRevokeOwnerPermissionError"
)<{
  readonly message: string;
  readonly documentId: string;
}> {}

/**
 * Business rule violations
 */
export class DuplicateMetadataKeyError extends Data.TaggedError(
  "DuplicateMetadataKeyError"
)<{
  readonly message: string;
  readonly key: string;
  readonly documentId: string;
}> {}

export class MaxVersionsExceededError extends Data.TaggedError(
  "MaxVersionsExceededError"
)<{
  readonly message: string;
  readonly maxVersions: number;
  readonly documentId: string;
}> {}

/**
 * Union of all application errors
 */
export type ApplicationError =
  | InvalidCredentialsError
  | TokenExpiredError
  | TokenInvalidError
  | FileUploadError
  | FileSizeExceededError
  | UnsupportedFileTypeError
  | DownloadTokenExpiredError
  | DownloadTokenNotFoundError
  | DownloadTokenAlreadyUsedError
  | InsufficientPermissionError
  | CannotRevokeOwnerPermissionError
  | DuplicateMetadataKeyError
  | MaxVersionsExceededError;
