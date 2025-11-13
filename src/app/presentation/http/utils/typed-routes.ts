/**
 * Typed Routes Utility - oRPC + Elysia + Effect Integration
 *
 * Provides utilities to create type-safe routes that integrate:
 * - oRPC contracts for type safety
 * - Elysia for HTTP handling
 * - Effect for business logic execution
 */

import type { Elysia } from "elysia";
import { Effect, pipe } from "effect";
import type { Runtime } from "effect";
import type { ContractProcedure } from "@orpc/contract";
import { runEffect } from "./handler";
import { withAuth, requireAuth } from "../middleware/auth.middleware";

/**
 * Handler function type for a contract procedure
 * Takes validated input and auth context, returns an Effect
 */
export type ContractHandler<TInput, TOutput, R> = (
  input: TInput,
  auth: { userId: string; email: string; role: string }
) => Effect.Effect<TOutput, Error, R>;

/**
 * Create a type-safe route handler from an oRPC contract
 *
 * This function:
 * 1. Validates input using the contract's schema
 * 2. Requires authentication
 * 3. Passes validated input to your handler
 * 4. Returns properly typed response
 */
export function createContractRoute<
  TInputSchema extends { "~standard": any },
  TOutputSchema extends { "~standard": any },
  TInput = TInputSchema extends {
    "~standard": { validate: (v: any) => { value: infer V } };
  }
    ? V
    : never,
  TOutput = TOutputSchema extends {
    "~standard": { validate: (v: any) => { value: infer V } };
  }
    ? V
    : never,
  R = any
>(
  contract: ContractProcedure<TInputSchema, TOutputSchema, any, any>,
  handler: ContractHandler<TInput, TOutput, R>
) {
  return async (context: {
    headers: Record<string, string | undefined>;
    body?: any;
    params?: any;
    query?: any;
  }) => {
    // Merge all possible input sources
    const rawInput = {
      ...context.params,
      ...context.query,
      ...context.body,
    };

    const effect = pipe(
      requireAuth(),
      Effect.flatMap((auth) =>
        // Validate input using the contract's schema
        Effect.try({
          try: () => {
            const validation =
              contract["~orpc"].inputSchema?.["~standard"].validate(rawInput);
            if (validation && "issues" in validation) {
              throw new Error(
                `Validation failed: ${validation.issues
                  .map((i: any) => i.message)
                  .join(", ")}`
              );
            }
            return validation?.value as TInput;
          },
          catch: (error) =>
            new Error(
              `Input validation error: ${
                error instanceof Error ? error.message : String(error)
              }`
            ),
        })
      ),
      Effect.flatMap((validatedInput) =>
        pipe(
          requireAuth(),
          Effect.flatMap((auth) => handler(validatedInput, auth))
        )
      )
    );

    return runEffect(
      withAuth(effect, context.headers.authorization) as Effect.Effect<
        TOutput,
        any,
        R
      >,
      // Runtime will be provided by the route setup
      undefined as any
    );
  };
}

/**
 * Register typed routes on an Elysia app
 *
 * Example usage:
 * ```ts
 * const app = new Elysia()
 *   .use(registerTypedRoute(documentContract.upload, runtime, uploadHandler))
 *   .use(registerTypedRoute(documentContract.list, runtime, listHandler))
 * ```
 */
export function registerTypedRoute<
  TInputSchema extends { "~standard": any },
  TOutputSchema extends { "~standard": any },
  TInput = any,
  TOutput = any,
  R = any
>(
  contract: ContractProcedure<TInputSchema, TOutputSchema, any, any>,
  runtime: Runtime.Runtime<R>,
  handler: ContractHandler<TInput, TOutput, R>
) {
  return (app: Elysia) => {
    const route = contract["~orpc"].route;
    const method = route.method?.toLowerCase() as
      | "get"
      | "post"
      | "put"
      | "patch"
      | "delete";
    const path = route.path || "/";

    // Wrap handler to inject runtime and handle auth
    const wrappedHandler = async (context: any) => {
      const effect = pipe(
        requireAuth(),
        Effect.flatMap((auth) =>
          // Validate input using the contract's schema
          Effect.try({
            try: () => {
              const rawInput = {
                ...context.params,
                ...context.query,
                ...context.body,
              };

              const validation =
                contract["~orpc"].inputSchema?.["~standard"].validate(rawInput);
              if (validation && "issues" in validation) {
                throw new Error(
                  `Validation failed: ${validation.issues
                    .map((i: any) => i.message)
                    .join(", ")}`
                );
              }
              return validation?.value as TInput;
            },
            catch: (error) =>
              new Error(
                `Input validation error: ${
                  error instanceof Error ? error.message : String(error)
                }`
              ),
          })
        ),
        Effect.flatMap((validatedInput) =>
          pipe(
            requireAuth(),
            Effect.flatMap((auth) => handler(validatedInput, auth))
          )
        )
      );

      return runEffect(
        withAuth(effect, context.headers.authorization) as Effect.Effect<
          TOutput,
          any,
          R
        >,
        runtime
      );
    };

    return app[method](path, wrappedHandler);
  };
}
