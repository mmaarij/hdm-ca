/**
 * Application-level logging utilities
 *
 * Provides structured logging for use cases and workflows.
 * Uses Effect's built-in logging capabilities.
 */

import { Effect } from "effect";
import { getCorrelationId } from "../../presentation/http/middleware/correlation.middleware";

/**
 * Log levels
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Log context for structured logging
 */
export interface LogContext {
  readonly workflow?: string;
  readonly useCase?: string;
  readonly userId?: string;
  readonly documentId?: string;
  readonly correlationId?: string;
  readonly [key: string]: unknown;
}

/**
 * Add correlation ID to log context
 */
const enrichContext = (
  context?: LogContext
): Effect.Effect<LogContext, never, never> =>
  Effect.gen(function* () {
    const correlationId = yield* Effect.either(getCorrelationId());
    const corrId =
      correlationId._tag === "Right" ? correlationId.right : undefined;

    return {
      ...context,
      correlationId: context?.correlationId || corrId,
    };
  });

/**
 * Create a structured log effect
 */
export const log = (
  level: LogLevel,
  message: string,
  context?: LogContext
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    const enrichedContext = yield* enrichContext(context);
    const structuredMessage = `${message} ${JSON.stringify(enrichedContext)}`;

    switch (level) {
      case "debug":
        yield* Effect.logDebug(structuredMessage);
        break;
      case "info":
        yield* Effect.logInfo(structuredMessage);
        break;
      case "warn":
        yield* Effect.logWarning(structuredMessage);
        break;
      case "error":
        yield* Effect.logError(structuredMessage);
        break;
    }
  });

/**
 * Log info
 */
export const logInfo = (message: string, context?: LogContext) =>
  log("info", message, context);

/**
 * Log debug
 */
export const logDebug = (message: string, context?: LogContext) =>
  log("debug", message, context);

/**
 * Log warning
 */
export const logWarning = (message: string, context?: LogContext) =>
  log("warn", message, context);

/**
 * Log error
 */
export const logError = (message: string, context?: LogContext) =>
  log("error", message, context);

/**
 * Log use case start
 */
export const logUseCaseStart = (useCase: string, context?: LogContext) =>
  logInfo(`Starting use case: ${useCase}`, { ...context, useCase });

/**
 * Log use case success
 */
export const logUseCaseSuccess = (useCase: string, context?: LogContext) =>
  logInfo(`Use case completed successfully: ${useCase}`, {
    ...context,
    useCase,
  });

/**
 * Log use case failure
 */
export const logUseCaseFailure = (
  useCase: string,
  error: unknown,
  context?: LogContext
) =>
  logError(`Use case failed: ${useCase}`, {
    ...context,
    useCase,
    error: error instanceof Error ? error.message : String(error),
  });

/**
 * Wrap a use case with logging
 */
export const withUseCaseLogging = <E, A>(
  useCase: string,
  effect: Effect.Effect<A, E>,
  context?: LogContext
): Effect.Effect<A, E> =>
  Effect.gen(function* () {
    yield* logUseCaseStart(useCase, context);
    const result = yield* Effect.either(effect);

    if (result._tag === "Left") {
      yield* logUseCaseFailure(useCase, result.left, context);
      return yield* Effect.fail(result.left);
    }

    yield* logUseCaseSuccess(useCase, context);
    return result.right;
  });
