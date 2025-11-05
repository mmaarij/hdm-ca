/**
 * Correlation Tracking
 *
 * Provides request correlation IDs for distributed tracing and log aggregation
 */

import { Effect, Context, FiberRef } from "effect";
import { v4 as uuid } from "uuid";

/**
 * Correlation ID for request tracking
 */
export interface CorrelationId {
  readonly value: string;
}

/**
 * Context tag for correlation ID
 */
export const CorrelationIdTag =
  Context.GenericTag<CorrelationId>("@app/CorrelationId");

/**
 * FiberRef for storing correlation ID in fiber-local storage
 */
export const correlationIdRef = FiberRef.unsafeMake<string | undefined>(
  undefined
);

/**
 * Generate a new correlation ID
 */
export const generateCorrelationId = (): string => uuid();

/**
 * Create correlation context
 */
export const makeCorrelationId = (value?: string): CorrelationId => ({
  value: value || generateCorrelationId(),
});

/**
 * Get current correlation ID from context or fiber-local storage
 */
export const getCorrelationId = (): Effect.Effect<string, never, never> =>
  Effect.gen(function* () {
    // Try to get from fiber-local storage first
    const fiberLocalId = yield* FiberRef.get(correlationIdRef);
    if (fiberLocalId) {
      return fiberLocalId;
    }

    // Generate new ID if not found
    const newId = generateCorrelationId();
    yield* FiberRef.set(correlationIdRef, newId);
    return newId;
  });

/**
 * Set correlation ID in fiber-local storage
 */
export const setCorrelationId = (
  correlationId: string
): Effect.Effect<void, never, never> =>
  FiberRef.set(correlationIdRef, correlationId);

/**
 * Run an effect with a specific correlation ID
 */
export const withCorrelationId = <A, E, R>(
  correlationId: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    yield* setCorrelationId(correlationId);
    return yield* effect;
  });

/**
 * Run an effect with a new correlation ID
 */
export const withNewCorrelationId = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> => {
  const newId = generateCorrelationId();
  return withCorrelationId(newId, effect);
};

/**
 * Extract correlation ID from HTTP headers (X-Correlation-ID or X-Request-ID)
 */
export const extractCorrelationIdFromHeaders = (
  headers: Record<string, string | undefined>
): string => {
  return (
    headers["x-correlation-id"] ||
    headers["x-request-id"] ||
    generateCorrelationId()
  );
};
