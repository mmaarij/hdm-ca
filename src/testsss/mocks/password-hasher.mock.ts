/**
 * Mock Password Hasher Port Implementation
 *
 * Simple mock for testing without bcrypt overhead
 */

import { Effect, Layer } from "effect";
import type { PasswordHasherPort } from "../../app/application/ports/password-hasher.port";
import { PasswordHasherPortTag } from "../../app/application/ports/password-hasher.port";
import type { Password } from "../../app/domain/refined/password";

/**
 * Mock password hasher that prefixes passwords instead of actual hashing
 * This is much faster for testing and deterministic
 */
export const createMockPasswordHasher = (): PasswordHasherPort => ({
  hash: (password: Password): Effect.Effect<string, Error> => {
    // Just prefix with "hashed:" for testing
    const hashed = `hashed:${password}`;
    return Effect.succeed(hashed);
  },

  verify: (password: Password, hash: string): Effect.Effect<boolean, Error> => {
    const expectedHash = `hashed:${password}`;
    return Effect.succeed(hash === expectedHash);
  },
});

/**
 * Mock password hasher layer for dependency injection
 */
export const MockPasswordHasherLive = Layer.succeed(
  PasswordHasherPortTag,
  createMockPasswordHasher()
);

/**
 * Helper to create a mock hashed password for testing
 */
export const mockHashedPassword = (plainPassword: string): string => {
  return `hashed:${plainPassword}`;
};
