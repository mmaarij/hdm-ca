/**
 * Authentication Middleware
 *
 * Extracts and validates JWT tokens from Authorization headers.
 * Injects user context into request state for use in route handlers.
 */

import { Effect, Context } from "effect";
import type { JwtPayload, JwtPort } from "../../../application/ports/jwt.port";
import { JwtPortTag } from "../../../application/ports/jwt.port";

/**
 * Authenticated User Context
 *
 * Provides user information extracted from JWT token
 */
export interface AuthContext {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
}

/**
 * Context tag for authenticated user
 */
export const AuthContextTag =
  Context.GenericTag<AuthContext>("@http/AuthContext");

/**
 * Extract JWT token from Authorization header
 */
export const extractToken = (
  authHeader: string | undefined
): Effect.Effect<string, Error> => {
  if (!authHeader) {
    return Effect.fail(new Error("Missing Authorization header"));
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return Effect.fail(
      new Error("Invalid Authorization header format. Expected: Bearer <token>")
    );
  }

  return Effect.succeed(parts[1]);
};

/**
 * Verify JWT token and extract payload
 */
export const verifyToken = (
  token: string
): Effect.Effect<JwtPayload, Error, JwtPort> =>
  Effect.gen(function* () {
    const jwtService = yield* JwtPortTag;
    const payload = yield* jwtService.verify(token);
    return payload;
  });

/**
 * Create AuthContext from JWT payload
 */
export const createAuthContext = (
  payload: JwtPayload
): Effect.Effect<AuthContext> => {
  return Effect.succeed({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  });
};

/**
 * Full authentication flow: extract → verify → create context
 */
export const authenticate = (
  authHeader: string | undefined
): Effect.Effect<AuthContext, Error, JwtPort> =>
  Effect.gen(function* () {
    const token = yield* extractToken(authHeader);
    const payload = yield* verifyToken(token);
    const context = yield* createAuthContext(payload);
    return context;
  });

/**
 * Provide AuthContext from authenticated request
 */
export const withAuth = <R, E, A>(
  effect: Effect.Effect<A, E, R | AuthContext>,
  authHeader: string | undefined
): Effect.Effect<A, E | Error, R | JwtPort> =>
  Effect.gen(function* () {
    const authContext = yield* authenticate(authHeader);
    return yield* Effect.provideService(effect, AuthContextTag, authContext);
  });

/**
 * Get current authenticated user from context
 */
export const requireAuth = (): Effect.Effect<AuthContext, never, AuthContext> =>
  AuthContextTag;

/**
 * Optional authentication - returns undefined if not authenticated
 */
export const optionalAuth = (
  authHeader: string | undefined
): Effect.Effect<AuthContext | undefined, never, JwtPort> =>
  Effect.gen(function* () {
    const result = yield* Effect.either(authenticate(authHeader));
    if (result._tag === "Left") {
      return undefined;
    }
    return result.right;
  });
