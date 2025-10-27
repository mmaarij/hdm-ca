import { Schema as S } from "effect";
import { UserId } from "../refined/uuid";
import { EmailAddress } from "../refined/email";
import { HashedPassword } from "../refined/password";
import { DateTime } from "../refined/date-time";
import { UserRole } from "./value-object";

/**
 * User Entity
 *
 * Represents an authenticated user in the system.
 */
export const User = S.Struct({
  id: UserId,
  email: EmailAddress,
  password: HashedPassword,
  role: UserRole,
  createdAt: S.optional(DateTime),
  updatedAt: S.optional(DateTime),
});

export type User = S.Schema.Type<typeof User>;

/**
 * User without sensitive fields (for API responses)
 */
export const UserPublic = S.Struct({
  id: UserId,
  email: EmailAddress,
  role: UserRole,
  createdAt: S.optional(DateTime),
  updatedAt: S.optional(DateTime),
});

export type UserPublic = S.Schema.Type<typeof UserPublic>;

/**
 * Create User payload (accepts plain password before hashing)
 */
export const CreateUserPayload = S.Struct({
  email: EmailAddress,
  password: S.String, // Will be validated and hashed
  role: S.optional(UserRole),
});

export type CreateUserPayload = S.Schema.Type<typeof CreateUserPayload>;

/**
 * Update User payload
 */
export const UpdateUserPayload = S.partial(
  S.Struct({
    email: EmailAddress,
    password: S.String, // Will be validated and hashed
    role: UserRole,
  })
);

export type UpdateUserPayload = S.Schema.Type<typeof UpdateUserPayload>;

/**
 * Helper to convert User to UserPublic (remove password)
 */
export const toPublicUser = (user: User): UserPublic => ({
  id: user.id,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
