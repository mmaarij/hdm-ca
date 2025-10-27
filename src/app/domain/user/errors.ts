import { Data } from "effect";

/**
 * User Domain Errors
 */

export class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
  readonly userId?: string;
  readonly email?: string;
  readonly message?: string;
}> {}

export class UserAlreadyExistsError extends Data.TaggedError(
  "UserAlreadyExistsError"
)<{
  readonly email: string;
  readonly message?: string;
}> {}

export class UserValidationError extends Data.TaggedError(
  "UserValidationError"
)<{
  readonly message: string;
  readonly field?: string;
}> {}

export class InvalidCredentialsError extends Data.TaggedError(
  "InvalidCredentialsError"
)<{
  readonly message?: string;
}> {}

export class UserForbiddenError extends Data.TaggedError("UserForbiddenError")<{
  readonly message: string;
  readonly userId?: string;
}> {}

export class UserConstraintError extends Data.TaggedError(
  "UserConstraintError"
)<{
  readonly message: string;
}> {}

/**
 * Union of all User domain errors
 */
export type UserDomainError =
  | UserNotFoundError
  | UserAlreadyExistsError
  | UserValidationError
  | InvalidCredentialsError
  | UserForbiddenError
  | UserConstraintError;
