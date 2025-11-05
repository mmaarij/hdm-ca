/**
 * Performance Monitoring
 *
 * Tracks timing and performance metrics for use cases and workflows
 */

import { Effect } from "effect";
import { logInfo } from "./logging";
import { getCorrelationId } from "../../presentation/http/middleware/correlation.middleware";

/**
 * Performance metrics for a use case execution
 */
export interface PerformanceMetrics {
  readonly useCase: string;
  readonly durationMs: number;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly correlationId?: string;
  readonly success: boolean;
}

/**
 * Measure execution time of an effect
 */
export const measureDuration = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<{ result: A; durationMs: number }, E, R> =>
  Effect.gen(function* () {
    const startTime = Date.now();
    const result = yield* effect;
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    return { result, durationMs };
  });

/**
 * Track performance metrics for a use case
 */
export const withPerformanceTracking = <A, E, R>(
  useCase: string,
  effect: Effect.Effect<A, E, R>,
  context?: Record<string, unknown>
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const startTime = new Date();
    const startMs = Date.now();
    const correlationId = yield* getCorrelationId();

    const result = yield* Effect.either(effect);

    const endTime = new Date();
    const endMs = Date.now();
    const durationMs = endMs - startMs;

    const metrics: PerformanceMetrics = {
      useCase,
      durationMs,
      startTime,
      endTime,
      correlationId,
      success: result._tag === "Right",
    };

    // Log performance metrics
    yield* logInfo(`[PERF] ${useCase}`, {
      ...context,
      durationMs,
      correlationId,
      success: metrics.success,
      timestamp: endTime.toISOString(),
    });

    // Warn if operation is slow (> 1 second)
    if (durationMs > 1000) {
      yield* Effect.logWarning(
        `[PERF] Slow operation detected: ${useCase} took ${durationMs}ms`,
        { ...context, durationMs, correlationId }
      );
    }

    if (result._tag === "Left") {
      return yield* Effect.fail(result.left);
    }

    return result.right;
  }) as Effect.Effect<A, E, R>;

/**
 * Simple timing wrapper that just logs duration
 */
export const logDuration = <A, E, R>(
  label: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const { result, durationMs } = yield* measureDuration(effect);
    yield* Effect.logDebug(`${label} completed in ${durationMs}ms`);
    return result;
  });
