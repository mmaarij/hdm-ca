import { Data } from "effect";

/**
 * Download Token Domain Errors
 */

export class DownloadTokenNotFoundError extends Data.TaggedError(
  "DownloadTokenNotFoundError"
)<{
  readonly tokenId?: string;
  readonly token?: string;
  readonly message?: string;
}> {}

export class DownloadTokenExpiredError extends Data.TaggedError(
  "DownloadTokenExpiredError"
)<{
  readonly token: string;
  readonly expiresAt: Date;
  readonly message?: string;
}> {}

export class DownloadTokenAlreadyUsedError extends Data.TaggedError(
  "DownloadTokenAlreadyUsedError"
)<{
  readonly token: string;
  readonly usedAt: Date;
  readonly message?: string;
}> {}

export class DownloadTokenValidationError extends Data.TaggedError(
  "DownloadTokenValidationError"
)<{
  readonly message: string;
  readonly field?: string;
}> {}

export class DownloadTokenConstraintError extends Data.TaggedError(
  "DownloadTokenConstraintError"
)<{
  readonly message: string;
}> {}

/**
 * Union of all Download Token domain errors
 */
export type DownloadTokenDomainError =
  | DownloadTokenNotFoundError
  | DownloadTokenExpiredError
  | DownloadTokenAlreadyUsedError
  | DownloadTokenValidationError
  | DownloadTokenConstraintError;
