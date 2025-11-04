/**
 * Bcrypt Password Hasher Adapter
 *
 * Infrastructure implementation of PasswordHasherPort using bcrypt.
 */

import { Effect, Layer } from "effect";
import bcrypt from "bcryptjs";
import type { PasswordHasherPort } from "../../application/ports/password-hasher.port";
import { PasswordHasherPortTag } from "../../application/ports/password-hasher.port";
import type { Password } from "../../domain/refined/password";

const SALT_ROUNDS = 10;

/**
 * Bcrypt-based password hasher implementation
 */
const makeBcryptPasswordHasher = (): PasswordHasherPort => ({
  hash: (password: Password) =>
    Effect.tryPromise({
      try: () => bcrypt.hash(password, SALT_ROUNDS),
      catch: (error) => new Error(`Password hashing failed: ${error}`),
    }),

  verify: (password: Password, hash: string) =>
    Effect.tryPromise({
      try: () => bcrypt.compare(password, hash),
      catch: (error) => new Error(`Password verification failed: ${error}`),
    }),
});

/**
 * Layer providing BcryptPasswordHasher
 */
export const BcryptPasswordHasherLive = Layer.succeed(
  PasswordHasherPortTag,
  makeBcryptPasswordHasher()
);
