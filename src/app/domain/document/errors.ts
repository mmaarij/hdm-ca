import { Data } from "effect";

/**
 * Document Domain Errors
 */

export class DocumentNotFoundError extends Data.TaggedError(
  "DocumentNotFoundError"
)<{
  readonly documentId: string;
  readonly message?: string;
}> {}

export class DocumentVersionNotFoundError extends Data.TaggedError(
  "DocumentVersionNotFoundError"
)<{
  readonly versionId: string;
  readonly message?: string;
}> {}

export class DocumentAlreadyExistsError extends Data.TaggedError(
  "DocumentAlreadyExistsError"
)<{
  readonly documentId: string;
  readonly message?: string;
}> {}

export class DuplicateDocumentError extends Data.TaggedError(
  "DuplicateDocumentError"
)<{
  readonly message: string;
  readonly checksum: string;
}> {}

export class DocumentValidationError extends Data.TaggedError(
  "DocumentValidationError"
)<{
  readonly message: string;
  readonly field?: string;
}> {}

export class DocumentForbiddenError extends Data.TaggedError(
  "DocumentForbiddenError"
)<{
  readonly message: string;
  readonly documentId?: string;
}> {}

export class DocumentStorageError extends Data.TaggedError(
  "DocumentStorageError"
)<{
  readonly message: string;
  readonly path?: string;
}> {}

export class DocumentConstraintError extends Data.TaggedError(
  "DocumentConstraintError"
)<{
  readonly message: string;
}> {}

export class DocumentUpdateError extends Data.TaggedError(
  "DocumentUpdateError"
)<{
  readonly message: string;
}> {}

export class DocumentInfrastructureError extends Data.TaggedError(
  "DocumentInfrastructureError"
)<{
  readonly message: string;
}> {}

/**
 * Union of all Document domain errors
 */
export type DocumentDomainError =
  | DocumentNotFoundError
  | DocumentVersionNotFoundError
  | DocumentAlreadyExistsError
  | DuplicateDocumentError
  | DocumentValidationError
  | DocumentForbiddenError
  | DocumentStorageError
  | DocumentConstraintError
  | DocumentUpdateError
  | DocumentInfrastructureError;
