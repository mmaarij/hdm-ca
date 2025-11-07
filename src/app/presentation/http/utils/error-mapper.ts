/**
 * Error Mapper
 *
 * Maps domain errors to HTTP status codes and error responses.
 * Preserves domain semantics while providing appropriate HTTP responses.
 */

import { Effect, Match } from "effect";
import type {
  UserDomainError,
  DocumentDomainError,
  PermissionDomainError,
  MetadataDomainError,
} from "../../../domain";
import type { DownloadTokenDomainError } from "../../../domain/download-token/errors";
import type {
  NotFoundError,
  AlreadyExistsError,
  ValidationError,
  ForbiddenError,
  UnauthorizedError,
  ConstraintError,
  InfrastructureError,
} from "../../../domain/shared/base.errors";
import type { ParseError } from "effect/ParseResult";

/**
 * HTTP Error Response
 */
export interface HttpErrorResponse {
  readonly status: number;
  readonly error: string;
  readonly message: string;
  readonly field?: string;
  readonly details?: Record<string, unknown>;
}

/**
 * Map domain errors to HTTP status codes
 */
export const mapErrorToStatus = (
  error:
    | UserDomainError
    | DocumentDomainError
    | PermissionDomainError
    | MetadataDomainError
    | DownloadTokenDomainError
    | NotFoundError
    | AlreadyExistsError
    | ValidationError
    | ForbiddenError
    | UnauthorizedError
    | ConstraintError
    | InfrastructureError
    | ParseError
    | Error
): HttpErrorResponse => {
  // Use direct conditional instead of Match for better type inference
  if ("_tag" in error) {
    switch (error._tag) {
      // Not Found (404)
      case "UserNotFoundError":
        return {
          status: 404,
          error: "Not Found",
          message: error.message || "User not found",
          details: { userId: error.userId, email: error.email },
        };
      case "DocumentNotFoundError":
        return {
          status: 404,
          error: "Not Found",
          message: error.message || "Document not found",
          details: { documentId: error.documentId },
        };
      case "DocumentVersionNotFoundError":
        return {
          status: 404,
          error: "Not Found",
          message: error.message || "Document version not found",
          details: { versionId: error.versionId },
        };
      case "PermissionNotFoundError":
        return {
          status: 404,
          error: "Not Found",
          message: error.message || "Permission not found",
          details: {
            permissionId: error.permissionId,
            documentId: error.documentId,
            userId: error.userId,
          },
        };
      case "MetadataNotFoundError":
        return {
          status: 404,
          error: "Not Found",
          message: error.message || "Metadata not found",
          details: {
            metadataId: error.metadataId,
            documentId: error.documentId,
            key: error.key,
          },
        };
      case "DownloadTokenNotFoundError":
        return {
          status: 404,
          error: "Not Found",
          message: error.message || "Download token not found",
          details: { tokenId: error.tokenId, token: error.token },
        };

      // Conflict (409)
      case "UserAlreadyExistsError":
        return {
          status: 409,
          error: "Conflict",
          message: error.message || "User already exists",
          details: { email: error.email },
        };
      case "DocumentAlreadyExistsError":
        return {
          status: 409,
          error: "Conflict",
          message: error.message || "Document already exists",
          details: { documentId: error.documentId },
        };
      case "DuplicateDocumentError":
        return {
          status: 409,
          error: "Conflict",
          message: error.message || "Duplicate document",
        };
      case "PermissionAlreadyExistsError":
        return {
          status: 409,
          error: "Conflict",
          message: error.message || "Permission already exists",
          details: { documentId: error.documentId, userId: error.userId },
        };
      case "MetadataAlreadyExistsError":
        return {
          status: 409,
          error: "Conflict",
          message: error.message || "Metadata already exists",
          details: { documentId: error.documentId, key: error.key },
        };
      case "DownloadTokenAlreadyUsedError":
        return {
          status: 409,
          error: "Conflict",
          message: error.message || "Download token has already been used",
          details: { token: error.token, usedAt: error.usedAt },
        };
      case "DownloadTokenExpiredError":
        return {
          status: 409,
          error: "Conflict",
          message: error.message || "Download token has expired",
          details: { token: error.token, expiresAt: error.expiresAt },
        };

      // Unauthorized (401)
      case "InvalidCredentialsError":
        return {
          status: 401,
          error: "Unauthorized",
          message: error.message || "Invalid credentials",
        };

      // Forbidden (403)
      case "UserForbiddenError":
        return {
          status: 403,
          error: "Forbidden",
          message: error.message || "Access forbidden",
          details: { userId: error.userId },
        };
      case "DocumentForbiddenError":
        return {
          status: 403,
          error: "Forbidden",
          message: error.message || "Access forbidden",
          details: { documentId: error.documentId },
        };
      case "PermissionForbiddenError":
        return {
          status: 403,
          error: "Forbidden",
          message: error.message,
        };
      case "InsufficientPermissionError":
        return {
          status: 403,
          error: "Forbidden",
          message: error.message,
          details: {
            userId: error.userId,
            documentId: error.documentId,
            requiredPermission: error.requiredPermission,
          },
        };
      case "MetadataForbiddenError":
        return {
          status: 403,
          error: "Forbidden",
          message: error.message,
        };

      // Bad Request (400) - Validation Errors
      case "UserValidationError":
        return {
          status: 400,
          error: "Bad Request",
          message: error.message,
          field: error.field,
        };
      case "DocumentValidationError":
        return {
          status: 400,
          error: "Bad Request",
          message: error.message,
          field: error.field,
        };
      case "PermissionValidationError":
        return {
          status: 400,
          error: "Bad Request",
          message: error.message,
          field: error.field,
        };
      case "MetadataValidationError":
        return {
          status: 400,
          error: "Bad Request",
          message: error.message,
          field: error.field,
        };

      // Constraint Errors (422)
      case "UserConstraintError":
        return {
          status: 422,
          error: "Unprocessable Entity",
          message: error.message,
        };
      case "DocumentConstraintError":
        return {
          status: 422,
          error: "Unprocessable Entity",
          message: error.message,
        };
      case "PermissionConstraintError":
        return {
          status: 422,
          error: "Unprocessable Entity",
          message: error.message,
        };
      case "MetadataConstraintError":
        return {
          status: 422,
          error: "Unprocessable Entity",
          message: error.message,
        };

      // Storage Errors (500)
      case "DocumentStorageError":
        return {
          status: 500,
          error: "Internal Server Error",
          message: error.message,
        };

      // Infrastructure Errors (500)
      case "DocumentInfrastructureError":
        return {
          status: 500,
          error: "Internal Server Error",
          message: error.message,
        };

      // Schema Validation Errors (400)
      case "ParseError":
        return {
          status: 400,
          error: "Bad Request",
          message: "Invalid request data",
          details: { error: String(error) },
        };

      // Generic Base Errors
      case "NotFoundError":
        return {
          status: 404,
          error: "Not Found",
          message: error.message || "Resource not found",
          details: { entityType: error.entityType, id: error.id },
        };
      case "ForbiddenError":
        return {
          status: 403,
          error: "Forbidden",
          message: error.message || "Access forbidden",
          details: { resource: error.resource },
        };
      case "UnauthorizedError":
        return {
          status: 401,
          error: "Unauthorized",
          message: error.message || "Unauthorized access",
        };
      case "ValidationError":
        return {
          status: 400,
          error: "Bad Request",
          message: error.message || "Validation failed",
          field: error.field,
        };
      case "AlreadyExistsError":
        return {
          status: 409,
          error: "Conflict",
          message: error.message || "Resource already exists",
          details: { entityType: error.entityType, id: error.id },
        };
      case "ConstraintError":
        return {
          status: 422,
          error: "Unprocessable Entity",
          message: error.message || "Constraint violation",
        };
      case "InfrastructureError":
        return {
          status: 500,
          error: "Internal Server Error",
          message: error.message || "Infrastructure error occurred",
          details: { cause: error.cause },
        };
    }
  }

  // Handle authentication/authorization errors from middleware (generic Error instances)
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("missing authorization header")) {
      return {
        status: 401,
        error: "Unauthorized",
        message: "Missing Authorization header",
      };
    }
    if (message.includes("invalid authorization header")) {
      return {
        status: 401,
        error: "Unauthorized",
        message:
          "Invalid Authorization header format. Expected: Bearer <token>",
      };
    }
    if (message.includes("jwt") || message.includes("authentication token")) {
      return {
        status: 401,
        error: "Unauthorized",
        message: "Invalid or expired authentication token",
      };
    }
  }

  // Generic Error (500)
  return {
    status: 500,
    error: "Internal Server Error",
    message:
      error instanceof Error ? error.message : "An unexpected error occurred",
  };
};

/**
 * Create error response Effect
 */
export const toHttpError = (
  error:
    | UserDomainError
    | DocumentDomainError
    | PermissionDomainError
    | MetadataDomainError
    | ParseError
    | Error
): Effect.Effect<never, HttpErrorResponse> => {
  return Effect.fail(mapErrorToStatus(error));
};
