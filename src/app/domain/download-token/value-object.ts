import { Schema as S } from "effect";
import { randomBytes } from "crypto";

/**
 * Download token string (cryptographically secure random token)
 */
export const Token = S.String.pipe(
  S.filter((value) => value.length > 0, {
    message: () => "Token cannot be empty",
  }),
  S.brand("Token")
);

export type Token = S.Schema.Type<typeof Token>;

/**
 * Generate a secure random token
 */
export const generateToken = (): Token => {
  const token = randomBytes(32).toString("base64url");
  return token as Token;
};

/**
 * Token expiration duration (in milliseconds)
 */
export const DEFAULT_TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAX_TOKEN_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Calculate expiration date from now
 */
export const calculateExpirationDate = (
  durationMs: number = DEFAULT_TOKEN_EXPIRATION_MS
): Date => {
  return new Date(Date.now() + durationMs);
};

/**
 * Check if a token is expired
 */
export const isTokenExpired = (expiresAt: Date): boolean => {
  return expiresAt.getTime() < Date.now();
};

/**
 * Check if a token has been used
 */
export const isTokenUsed = (usedAt?: Date): boolean => {
  return usedAt !== undefined;
};
