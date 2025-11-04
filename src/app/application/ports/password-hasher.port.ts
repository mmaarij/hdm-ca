/**
 * Password Hasher Port
 *
 * Abstract interface for password hashing operations.
 * Implemented by infrastructure adapters (bcrypt, argon2, etc.)
 */

import { Effect, Context } from "effect";
import { Password } from "../../domain/refined/password";

/**
 * Password Hasher Port Interface
 */
export interface PasswordHasherPort {
  /**
   * Hash a password
   */
  readonly hash: (password: Password) => Effect.Effect<string, Error>;

  /**
   * Verify a password against a hash
   */
  readonly verify: (
    password: Password,
    hash: string
  ) => Effect.Effect<boolean, Error>;
}

/**
 * Context tag for dependency injection
 */
export const PasswordHasherPortTag = Context.GenericTag<PasswordHasherPort>(
  "@app/PasswordHasherPort"
);
