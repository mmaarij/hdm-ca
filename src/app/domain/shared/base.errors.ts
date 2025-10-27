import { Data } from "effect";

/**
 * Base domain errors
 */

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly entityType: string;
  readonly id?: string;
  readonly message?: string;
}> {}

export class AlreadyExistsError extends Data.TaggedError("AlreadyExistsError")<{
  readonly entityType: string;
  readonly id?: string;
  readonly message?: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly field?: string;
  readonly value?: unknown;
}> {}

export class ForbiddenError extends Data.TaggedError("ForbiddenError")<{
  readonly message: string;
  readonly resource?: string;
}> {}

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
  readonly message: string;
}> {}

export class ConstraintError extends Data.TaggedError("ConstraintError")<{
  readonly message: string;
  readonly constraint?: string;
}> {}

export class InfrastructureError extends Data.TaggedError(
  "InfrastructureError"
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Union of all base domain errors
 */
export type BaseDomainError =
  | NotFoundError
  | AlreadyExistsError
  | ValidationError
  | ForbiddenError
  | UnauthorizedError
  | ConstraintError
  | InfrastructureError;
