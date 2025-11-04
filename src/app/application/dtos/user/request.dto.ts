/**
 * User Request DTOs
 *
 * Command/Query DTOs for user-related operations.
 * These are application-layer contracts, separate from domain entities.
 */

import { Schema as S } from "effect";
import { EmailAddress } from "../../../domain/refined/email";
import { UserRole } from "../../../domain/user/value-object";
import { UserId } from "../../../domain/refined/uuid";

/**
 * Register User Command
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

/**
 * Login User Command
 */
export const LoginUserCommand = S.Struct({
  email: EmailAddress,
  password: S.String.pipe(S.minLength(1)),
});

export type LoginUserCommand = S.Schema.Type<typeof LoginUserCommand>;

/**
 * Update User Profile Command
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

/**
 * Update User Role Command (Admin only)
 */
export const UpdateUserRoleCommand = S.Struct({
  userId: UserId,
  role: UserRole,
});

export type UpdateUserRoleCommand = S.Schema.Type<typeof UpdateUserRoleCommand>;

/**
 * Get User Query
 */
export const GetUserQuery = S.Struct({
  userId: UserId,
});

export type GetUserQuery = S.Schema.Type<typeof GetUserQuery>;

/**
 * List Users Query
 */
export const ListUsersQuery = S.Struct({
  page: S.optional(S.Number.pipe(S.positive())),
  limit: S.optional(S.Number.pipe(S.positive(), S.lessThanOrEqualTo(100))),
});

export type ListUsersQuery = S.Schema.Type<typeof ListUsersQuery>;

/**
 * Delete User Command
 */
export const DeleteUserCommand = S.Struct({
  userId: UserId,
});

export type DeleteUserCommand = S.Schema.Type<typeof DeleteUserCommand>;
