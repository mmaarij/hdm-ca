import { Schema as S } from "effect";
import {
  User,
  CreateUserPayload,
  UpdateUserPayload,
  UserPublic,
} from "./entity";

/**
 * Runtime validators for User domain
 */

export const validateUser = (input: unknown) => S.decodeUnknown(User)(input);

export const validateUserPublic = (input: unknown) =>
  S.decodeUnknown(UserPublic)(input);

export const validateCreateUserPayload = (input: unknown) =>
  S.decodeUnknown(CreateUserPayload)(input);

export const validateUpdateUserPayload = (input: unknown) =>
  S.decodeUnknown(UpdateUserPayload)(input);

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
