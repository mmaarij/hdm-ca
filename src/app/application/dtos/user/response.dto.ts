/**
 * User Response DTOs
 *
 * Response DTOs for user-related operations.
 * These never expose sensitive domain information (like hashed passwords).
 */

import { Schema as S } from "effect";
import { UserId } from "../../../domain/refined/uuid";
import { EmailAddress } from "../../../domain/refined/email";
import { UserRole } from "../../../domain/user/value-object";
import { DateTime } from "../../../domain/refined/date-time";
import { Paginated } from "../../../domain/shared/pagination";

/**
 * User Response (Public)
 */
export const UserResponse = S.Struct({
  id: UserId,
  email: EmailAddress,
  role: UserRole,
  createdAt: S.optional(DateTime),
  updatedAt: S.optional(DateTime),
});

export type UserResponse = S.Schema.Type<typeof UserResponse>;

/**
 * Login Response (includes authentication token)
 */
export const LoginResponse = S.Struct({
  user: UserResponse,
  token: S.String,
  expiresIn: S.Number, // seconds
});

export type LoginResponse = S.Schema.Type<typeof LoginResponse>;

/**
 * Register Response
 */
export const RegisterResponse = S.Struct({
  user: UserResponse,
});

export type RegisterResponse = S.Schema.Type<typeof RegisterResponse>;

/**
 * User Profile Response
 */
export const UserProfileResponse = UserResponse;

export type UserProfileResponse = S.Schema.Type<typeof UserProfileResponse>;

/**
 * List Users Response
 */
export type ListUsersResponse = Paginated<UserResponse>;
