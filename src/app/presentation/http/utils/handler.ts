/**
 * Route Handler Utilities
 *
 * Helper functions for creating type-safe Elysia route handlers
 */

import { Effect, Runtime, Layer } from "effect";
import type { HttpErrorResponse } from "./error-mapper";
import { mapErrorToStatus } from "./error-mapper";
import {
  withCorrelationId,
  extractCorrelationIdFromHeaders,
} from "../middleware/correlation.middleware";

/**
 * Run an Effect with correlation ID and convert to HTTP response
 *
 * Executes an Effect within the provided runtime, handling both success and error cases.
 * Errors are automatically mapped to appropriate HTTP error responses.
 * Correlation IDs are extracted from request headers and propagated through the Effect.
 */
export const runEffect = async <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  runtime: Runtime.Runtime<R>,
  headers?: Record<string, string | undefined>
): Promise<A> => {
  // Extract correlation ID from headers if available
  const correlationId = headers
    ? extractCorrelationIdFromHeaders(headers)
    : undefined;

  // Wrap effect with correlation ID if available
  const effectWithCorrelation = correlationId
    ? withCorrelationId(correlationId, effect)
    : effect;

  const result = await Runtime.runPromise(runtime)(
    Effect.either(effectWithCorrelation)
  );

  if (result._tag === "Left") {
    const httpError = mapErrorToStatus(result.left as any);
    throw httpError;
  }

  return result.right;
};

/**
 * Create a route handler that runs an Effect
 *
 * Simplifies route handler creation by handling Effect execution and error mapping
 */
export const effectHandler = <A, E, R>(runtime: Runtime.Runtime<R>) => {
  return (
    effect: Effect.Effect<A, E, R>,
    headers?: Record<string, string | undefined>
  ) => runEffect(effect, runtime, headers);
};

/**
 * HTTP Error for Elysia error handling
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly error: string,
    message: string,
    public readonly field?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "HttpError";
  }

  toJSON(): HttpErrorResponse {
    return {
      status: this.status,
      error: this.error,
      message: this.message,
      field: this.field,
      details: this.details,
    };
  }
}

/**
 * Convert HttpErrorResponse to HttpError
 */
export const toHttpErrorClass = (error: HttpErrorResponse): HttpError => {
  return new HttpError(
    error.status,
    error.error,
    error.message,
    error.field,
    error.details
  );
};
