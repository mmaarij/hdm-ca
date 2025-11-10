import { Schema as S } from "effect";
import { UserId } from "../refined/uuid";
import { EmailAddress } from "../refined/email";
import { HashedPassword } from "../refined/password";
import { UserRole } from "./value-object";

/**
 * User Domain Schemas
 *
 * Contains both entity schemas (for validation and encoding/decoding)
 * and specific use-case schemas (login, registration).
 *
 * Note: Entity schemas use S.Date for internal date representation.
 * API DTOs use DateTime (DateFromString with branding) for JSON serialization.
 */

// ============================================================================
// Entity Schemas
// ============================================================================

/**
 * User Schema for validation and encoding/decoding
 */
export const UserSchema = S.Struct({
  id: UserId,
  email: EmailAddress,
  password: HashedPassword,
  role: UserRole,
  createdAt: S.optional(S.Date),
  updatedAt: S.optional(S.Date),
});

/**
 * Type derived from User Schema
 */
export type UserSchemaType = S.Schema.Type<typeof UserSchema>;

/**
 * UserPublic Schema (without password)
 */
export const UserPublicSchema = S.Struct({
  id: UserId,
  email: EmailAddress,
  role: UserRole,
  createdAt: S.optional(S.Date),
  updatedAt: S.optional(S.Date),
});

/**
 * Type derived from UserPublic Schema
 */
export type UserPublicSchemaType = S.Schema.Type<typeof UserPublicSchema>;

// ============================================================================
// Auth-Specific Schemas
// ============================================================================

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
