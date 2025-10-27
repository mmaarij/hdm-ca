import { Effect } from "effect";
import { DownloadToken } from "./entity";
import { isTokenExpired, isTokenUsed } from "./value-object";
import {
  DownloadTokenExpiredError,
  DownloadTokenAlreadyUsedError,
} from "./errors";

/**
 * Download Token Domain Business Rules and Guards
 */

/**
 * Guard: Token must not be expired
 */
export const guardTokenNotExpired = (
  token: DownloadToken
): Effect.Effect<void, DownloadTokenExpiredError> =>
  !isTokenExpired(token.expiresAt)
    ? Effect.void
    : Effect.fail(
        new DownloadTokenExpiredError({
          token: token.token,
          expiresAt: token.expiresAt,
          message: "Download token has expired",
        })
      );

/**
 * Guard: Token must not have been used
 */
export const guardTokenNotUsed = (
  token: DownloadToken
): Effect.Effect<void, DownloadTokenAlreadyUsedError> =>
  !isTokenUsed(token.usedAt)
    ? Effect.void
    : Effect.fail(
        new DownloadTokenAlreadyUsedError({
          token: token.token,
          usedAt: token.usedAt!,
          message: "Download token has already been used",
        })
      );

/**
 * Guard: Token must be valid (not expired and not used)
 */
export const guardTokenValid = (
  token: DownloadToken
): Effect.Effect<
  void,
  DownloadTokenExpiredError | DownloadTokenAlreadyUsedError
> =>
  Effect.all([guardTokenNotExpired(token), guardTokenNotUsed(token)]).pipe(
    Effect.map(() => undefined)
  );

/**
 * Check if token is valid for download
 */
export const isTokenValidForDownload = (token: DownloadToken): boolean => {
  return !isTokenExpired(token.expiresAt) && !isTokenUsed(token.usedAt);
};

/**
 * Calculate remaining validity time in milliseconds
 */
export const getRemainingValidity = (token: DownloadToken): number => {
  const remaining = token.expiresAt.getTime() - Date.now();
  return Math.max(0, remaining);
};

/**
 * Check if token will expire soon (within 1 hour)
 */
export const isTokenExpiringSoon = (token: DownloadToken): boolean => {
  const oneHour = 60 * 60 * 1000;
  return getRemainingValidity(token) < oneHour;
};
