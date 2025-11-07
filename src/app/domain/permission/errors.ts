import { Data } from "effect";

/**
 * Permission Domain Errors
 */

export class PermissionNotFoundError extends Data.TaggedError(
  "PermissionNotFoundError"
)<{
  readonly permissionId?: string;
  readonly documentId?: string;
  readonly userId?: string;
  readonly message?: string;
}> {}

export class PermissionAlreadyExistsError extends Data.TaggedError(
  "PermissionAlreadyExistsError"
)<{
  readonly documentId: string;
  readonly userId: string;
  readonly message?: string;
}> {}

export class PermissionValidationError extends Data.TaggedError(
  "PermissionValidationError"
)<{
  readonly message: string;
  readonly field?: string;
}> {}

export class PermissionForbiddenError extends Data.TaggedError(
  "PermissionForbiddenError"
)<{
  readonly message: string;
}> {}

export class InsufficientPermissionError extends Data.TaggedError(
  "InsufficientPermissionError"
)<{
  readonly message: string;
  readonly userId: string;
  readonly documentId: string;
  readonly requiredPermission: string;
}> {}

export class DocumentAccessDeniedError extends Data.TaggedError(
  "DocumentAccessDeniedError"
)<{
  readonly message: string;
  readonly userId: string;
  readonly documentId: string;
  readonly action: string;
}> {}

export class PermissionConstraintError extends Data.TaggedError(
  "PermissionConstraintError"
)<{
  readonly message: string;
}> {}

/**
 * Union of all Permission domain errors
 */
export type PermissionDomainError =
  | PermissionNotFoundError
  | PermissionAlreadyExistsError
  | PermissionValidationError
  | PermissionForbiddenError
  | InsufficientPermissionError
  | DocumentAccessDeniedError
  | PermissionConstraintError;
