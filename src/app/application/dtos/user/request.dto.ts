/**
 * User Request DTOs
 *
 * Command/Query DTOs for user-related operations.
 * These are application-layer contracts, separate from domain entities.
 *
 * Each operation has two schemas:
 * - *Input: Raw input from API (strings, numbers) - used by presentation layer
 * - *Command/*Query: Branded domain types - used by workflows after transformation
 */

import { Schema as S } from "effect";
import { EmailAddress } from "../../../domain/refined/email";
import { UserRole } from "../../../domain/user/value-object";
import { UserId, StringToUserId } from "../../../domain/refined/uuid";

// ============================================================================
// Register User
// ============================================================================

/**
 * Raw input from API
 */
export const RegisterUserInput = S.Struct({
  email: S.String,
  password: S.String,
  role: S.optional(S.String),
});
export type RegisterUserInput = S.Schema.Type<typeof RegisterUserInput>;

/**
 * Branded command for workflows
 */
export const RegisterUserCommand = S.Struct({
  email: EmailAddress,
  password: S.String.pipe(
    S.minLength(8, { message: () => "Password must be at least 8 characters" }),
    S.maxLength(128, {
      message: () => "Password must be at most 128 characters",
    })
  ),
  role: S.optional(UserRole),
});
export type RegisterUserCommand = S.Schema.Type<typeof RegisterUserCommand>;

// ============================================================================
// Login User
// ============================================================================

/**
 * Raw input from API
 */
export const LoginUserInput = S.Struct({
  email: S.String,
  password: S.String,
});
export type LoginUserInput = S.Schema.Type<typeof LoginUserInput>;

/**
 * Branded command for workflows
 */
export const LoginUserCommand = S.Struct({
  email: EmailAddress,
  password: S.String.pipe(S.minLength(1)),
});
export type LoginUserCommand = S.Schema.Type<typeof LoginUserCommand>;

// ============================================================================
// Update User Profile
// ============================================================================

/**
 * Raw input from API
 */
export const UpdateUserProfileInput = S.partial(
  S.Struct({
    email: S.String,
    password: S.String,
  })
);
export type UpdateUserProfileInput = S.Schema.Type<
  typeof UpdateUserProfileInput
>;

/**
 * Branded command for workflows
 */
export const UpdateUserProfileCommand = S.partial(
  S.Struct({
    email: EmailAddress,
    password: S.String.pipe(
      S.minLength(8, {
        message: () => "Password must be at least 8 characters",
      }),
      S.maxLength(128, {
        message: () => "Password must be at most 128 characters",
      })
    ),
  })
);
export type UpdateUserProfileCommand = S.Schema.Type<
  typeof UpdateUserProfileCommand
>;

// ============================================================================
// Update User Role (Admin only)
// ============================================================================

/**
 * Raw input from API
 */
export const UpdateUserRoleInput = S.Struct({
  userId: S.String,
  role: S.String,
});
export type UpdateUserRoleInput = S.Schema.Type<typeof UpdateUserRoleInput>;

/**
 * Branded command for workflows
 */
export const UpdateUserRoleCommand = S.Struct({
  userId: StringToUserId,
  role: UserRole,
});
export type UpdateUserRoleCommand = S.Schema.Type<typeof UpdateUserRoleCommand>;

// ============================================================================
// Get User
// ============================================================================

/**
 * Raw input from API
 */
export const GetUserInput = S.Struct({
  userId: S.String,
});
export type GetUserInput = S.Schema.Type<typeof GetUserInput>;

/**
 * Branded query for workflows
 */
export const GetUserQuery = S.Struct({
  userId: StringToUserId,
});
export type GetUserQuery = S.Schema.Type<typeof GetUserQuery>;

// ============================================================================
// List Users
// ============================================================================

/**
 * Raw input from API
 */
export const ListUsersInput = S.Struct({
  userId: S.String,
  page: S.optional(S.Number),
  limit: S.optional(S.Number),
});
export type ListUsersInput = S.Schema.Type<typeof ListUsersInput>;

/**
 * Branded query for workflows
 */
export const ListUsersQuery = S.Struct({
  userId: StringToUserId,
  page: S.optional(S.Number.pipe(S.positive())),
  limit: S.optional(S.Number.pipe(S.positive(), S.lessThanOrEqualTo(100))),
});
export type ListUsersQuery = S.Schema.Type<typeof ListUsersQuery>;

// ============================================================================
// Delete User
// ============================================================================

/**
 * Raw input from API
 */
export const DeleteUserInput = S.Struct({
  userId: S.String,
});
export type DeleteUserInput = S.Schema.Type<typeof DeleteUserInput>;

/**
 * Branded command for workflows
 */
export const DeleteUserCommand = S.Struct({
  userId: StringToUserId,
});
export type DeleteUserCommand = S.Schema.Type<typeof DeleteUserCommand>;
