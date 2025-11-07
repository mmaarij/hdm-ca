import { Schema as S } from "effect";

/**
 * User Domain Schemas
 *
 * Domain validation happens through:
 * - Entity factory functions (User.create, User.update)
 * - Domain guards (in guards.ts)
 * - Value objects with branded types
 *
 * These schemas are used for external input validation (login, registration)
 */

/**
 * Login/Auth specific schemas
 */
export const LoginCredentials = S.Struct({
  email: S.String,
  password: S.String,
});

export type LoginCredentials = S.Schema.Type<typeof LoginCredentials>;

export const validateLoginCredentials = (input: unknown) =>
  S.decodeUnknown(LoginCredentials)(input);

/**
 * Register schema (for new user signup)
 */
export const RegisterPayload = S.Struct({
  email: S.String,
  password: S.String,
  role: S.optional(S.Literal("ADMIN", "USER")),
});

export type RegisterPayload = S.Schema.Type<typeof RegisterPayload>;

export const validateRegisterPayload = (input: unknown) =>
  S.decodeUnknown(RegisterPayload)(input);
