/**
 * Effect Schema Adapter for oRPC
 *
 * Provides a Standard Schema (v1) implementation for oRPC that works with Effect schemas.
 * This allows us to use Effect schemas in oRPC contracts for type-safe routes.
 *
 * https://github.com/standard-schema/standard-schema
 */

import { Schema as S, ParseResult } from "effect";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Create a Standard Schema from an Effect Schema for use with oRPC
 */
export function effectSchema<A, I = A>(
  schema: S.Schema<A, I, never>
): StandardSchemaV1<I, A> {
  return {
    "~standard": {
      version: 1,
      vendor: "effect",
      validate: (input: unknown) => {
        try {
          const result = S.decodeUnknownSync(schema)(input, {
            errors: "all",
            onExcessProperty: "ignore",
          });
          return { value: result };
        } catch (error) {
          if (error instanceof ParseResult.ParseError) {
            return {
              issues: error.issue
                .toString()
                .split("\n")
                .map((msg, idx) => ({
                  message: msg,
                  path: [] as any,
                })),
            };
          }
          return {
            issues: [
              {
                message: error instanceof Error ? error.message : String(error),
                path: [] as any,
              },
            ],
          };
        }
      },
    },
  };
}

/**
 * Helper to create optional Effect schema
 */
export function effectSchemaOptional<A, I = A>(
  schema: S.Schema<A, I, never>
): StandardSchemaV1<I | undefined, A | undefined> {
  return effectSchema(S.optional(schema) as any);
}

/**
 * Helper to create nullable Effect schema
 */
export function effectSchemaNullable<A, I = A>(
  schema: S.Schema<A, I, never>
): StandardSchemaV1<I | null, A | null> {
  return effectSchema(S.NullOr(schema) as any);
}
