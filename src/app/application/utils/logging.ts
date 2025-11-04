/**
 * Application-level logging utilities
 *
 * Provides structured logging for use cases and workflows.
 * Uses Effect's built-in logging capabilities.
 */

import { Effect } from "effect";

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
  readonly [key: string]: unknown;
}

/**
 * Create a structured log effect
 */
export const log = (level: LogLevel, message: string, context?: LogContext) => {
  const structuredMessage = context
    ? `${message} ${JSON.stringify(context)}`
    : message;

  switch (level) {
    case "debug":
      return Effect.logDebug(structuredMessage);
    case "info":
      return Effect.logInfo(structuredMessage);
    case "warn":
      return Effect.logWarning(structuredMessage);
    case "error":
      return Effect.logError(structuredMessage);
  }
};

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
