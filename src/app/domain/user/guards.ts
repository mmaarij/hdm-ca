import { Effect, Schema as S } from "effect";
import { User, UserPublic } from "./entity";
import { UserRole } from "./value-object";
import { validateUser, validateUserPublic } from "./schema";

/**
 * User Domain Business Rules and Guards
 */

/**
 * Validate if a user entity is valid
 */
export const guardUser = (input: unknown): Effect.Effect<User, Error> =>
  validateUser(input).pipe(Effect.mapError((e) => new Error(String(e))));

/**
 * Check if user has admin role
 */
export const isUserAdmin = (user: User | UserPublic): boolean =>
  user.role === "ADMIN";

/**
 * Check if user has standard user role
 */
export const isUserStandard = (user: User | UserPublic): boolean =>
  user.role === "USER";

/**
 * Check if user can perform admin operations
 */
export const canPerformAdminOperation = (
  user: User | UserPublic
): Effect.Effect<void, Error> =>
  isUserAdmin(user)
    ? Effect.void
    : Effect.fail(new Error("User does not have admin privileges"));

/**
 * Check if email format is valid (business rule)
 */
export const hasValidEmailFormat = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Check if password meets complexity requirements
 */
export const hasValidPasswordComplexity = (password: string): boolean => {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[!@#$%^&*(),.?":{}|<>]/.test(password)
  );
};

/**
 * Business rule: Check if two users are the same
 */
export const isSameUser = (
  user1: User | UserPublic,
  user2: User | UserPublic
): boolean => user1.id === user2.id;

/**
 * Business rule: Check if user can modify another user
 */
export const canModifyUser = (
  actor: User | UserPublic,
  target: User | UserPublic
): boolean => {
  // Admin can modify anyone, or user can modify themselves
  return isUserAdmin(actor) || isSameUser(actor, target);
};
