/**
 * Effect Schema Validation Helpers
 *
 * Integrates Effect Schema with Elysia for request/response validation
 */

import { Effect, Schema as S, ParseResult } from "effect";

/**
 * Decode and validate data using Effect Schema
 */
export const decode = <A, I, R>(
  schema: S.Schema<A, I, R>,
  data: unknown
): Effect.Effect<A, ParseResult.ParseError, R> => {
  return S.decodeUnknown(schema)(data);
};

/**
 * Encode data using Effect Schema
 */
export const encode = <A, I, R>(
  schema: S.Schema<A, I, R>,
  data: A
): Effect.Effect<I, ParseResult.ParseError, R> => {
  return S.encode(schema)(data);
};

/**
 * Validate body with Effect Schema
 */
export const validateBody = <A, I, R>(
  schema: S.Schema<A, I, R>,
  body: unknown
): Effect.Effect<A, ParseResult.ParseError, R> => {
  return decode(schema, body);
};

/**
 * Validate query params with Effect Schema
 */
export const validateQuery = <A, I, R>(
  schema: S.Schema<A, I, R>,
  query: unknown
): Effect.Effect<A, ParseResult.ParseError, R> => {
  return decode(schema, query);
};

/**
 * Validate path params with Effect Schema
 */
export const validateParams = <A, I, R>(
  schema: S.Schema<A, I, R>,
  params: unknown
): Effect.Effect<A, ParseResult.ParseError, R> => {
  return decode(schema, params);
};

/**
 * Validate headers with Effect Schema
 */
export const validateHeaders = <A, I, R>(
  schema: S.Schema<A, I, R>,
  headers: unknown
): Effect.Effect<A, ParseResult.ParseError, R> => {
  return decode(schema, headers);
};
