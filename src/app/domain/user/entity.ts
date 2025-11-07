import { Schema as S, Option } from "effect";
import { UserId } from "../refined/uuid";
import { EmailAddress } from "../refined/email";
import { HashedPassword } from "../refined/password";
import { DateTime } from "../refined/date-time";
import { UserRole } from "./value-object";
import { v4 as uuidv4 } from "uuid";

/**
 * User Entity - Pure Domain Model
 *
 * Represents an authenticated user in the system.
 */
export interface User {
  readonly id: UserId;
  readonly email: EmailAddress;
  readonly password: HashedPassword;
  readonly role: UserRole;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * User without sensitive fields (for API responses)
 */
export interface UserPublic {
  readonly id: UserId;
  readonly email: EmailAddress;
  readonly role: UserRole;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Factory functions for User entity
 */
export const User = {
  /**
   * Create a new user
   */
  create: (props: {
    email: EmailAddress;
    password: HashedPassword;
    role?: UserRole;
  }): User => {
    const now = new Date();
    return {
      id: uuidv4() as UserId,
      email: props.email,
      password: props.password,
      role: props.role ?? ("USER" as UserRole),
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Update user
   */
  update: (
    user: User,
    updates: {
      email?: EmailAddress;
      password?: HashedPassword;
      role?: UserRole;
    }
  ): User => ({
    ...user,
    email: updates.email ?? user.email,
    password: updates.password ?? user.password,
    role: updates.role ?? user.role,
    updatedAt: new Date(),
  }),

  /**
   * Convert User to UserPublic (remove password)
   */
  toPublic: (user: User): UserPublic => ({
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }),
};

// ============================================================================
// Schema Definitions for Validation (kept for backward compatibility)
// ============================================================================

/**
 * User Schema for validation
 */
export const UserSchema = S.Struct({
  id: UserId,
  email: EmailAddress,
  password: HashedPassword,
  role: UserRole,
  createdAt: S.optional(DateTime),
  updatedAt: S.optional(DateTime),
});

/**
 * UserPublic Schema for validation
 */
export const UserPublicSchema = S.Struct({
  id: UserId,
  email: EmailAddress,
  role: UserRole,
  createdAt: S.optional(DateTime),
  updatedAt: S.optional(DateTime),
});
