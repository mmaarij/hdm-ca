import { Data } from "effect";

/**
 * Metadata Domain Errors
 */

export class MetadataNotFoundError extends Data.TaggedError(
  "MetadataNotFoundError"
)<{
  readonly metadataId?: string;
  readonly documentId?: string;
  readonly key?: string;
  readonly message?: string;
}> {}

export class MetadataAlreadyExistsError extends Data.TaggedError(
  "MetadataAlreadyExistsError"
)<{
  readonly documentId: string;
  readonly key: string;
  readonly message?: string;
}> {}

export class MetadataValidationError extends Data.TaggedError(
  "MetadataValidationError"
)<{
  readonly message: string;
  readonly field?: string;
}> {}

export class MetadataForbiddenError extends Data.TaggedError(
  "MetadataForbiddenError"
)<{
  readonly message: string;
}> {}

export class MetadataConstraintError extends Data.TaggedError(
  "MetadataConstraintError"
)<{
  readonly message: string;
}> {}

/**
 * Union of all Metadata domain errors
 */
export type MetadataDomainError =
  | MetadataNotFoundError
  | MetadataAlreadyExistsError
  | MetadataValidationError
  | MetadataForbiddenError
  | MetadataConstraintError;
