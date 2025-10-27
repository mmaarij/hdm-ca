import { Schema as S } from "effect";

/**
 * User Role Enumeration
 */
export const UserRole = S.Literal("ADMIN", "USER");
export type UserRole = S.Schema.Type<typeof UserRole>;

export const DEFAULT_ROLE: UserRole = "USER";

export const isAdmin = (role: UserRole): boolean => role === "ADMIN";
export const isUser = (role: UserRole): boolean => role === "USER";
