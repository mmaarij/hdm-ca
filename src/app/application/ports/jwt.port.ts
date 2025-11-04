/**
 * JWT Port
 *
 * Abstract interface for JWT token operations.
 * Implemented by infrastructure adapters (jsonwebtoken, jose, etc.)
 */

import { Effect, Context } from "effect";
import { UserId } from "../../domain/refined/uuid";
import { EmailAddress } from "../../domain/refined/email";

/**
 * JWT payload
 */
export interface JwtPayload {
  readonly userId: UserId;
  readonly email: EmailAddress;
  readonly role: string;
}

/**
 * JWT sign result
 */
export interface JwtSignResult {
  readonly token: string;
  readonly expiresIn: number;
}

/**
 * JWT Port Interface
 */
export interface JwtPort {
  /**
   * Sign a JWT token
   */
  readonly sign: (payload: JwtPayload) => Effect.Effect<JwtSignResult, Error>;

  /**
   * Verify a JWT token
   */
  readonly verify: (token: string) => Effect.Effect<JwtPayload, Error>;
}

/**
 * Context tag for dependency injection
 */
export const JwtPortTag = Context.GenericTag<JwtPort>("@app/JwtPort");
