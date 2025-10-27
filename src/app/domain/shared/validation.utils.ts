import { Schema as S, ParseResult } from "effect";
import { Effect } from "effect";

/**
 * Validation utilities using Effect Schema
 */

/**
 * Decode and validate unknown input
 */
export const validate =
  <A, I, R>(schema: S.Schema<A, I, R>) =>
  (input: unknown) =>
    S.decodeUnknown(schema)(input);

/**
 * Decode and validate with sync version (throws on error)
 */
export const validateSync =
  <A, I>(schema: S.Schema<A, I, never>) =>
  (input: unknown) =>
    S.decodeUnknownSync(schema)(input);

/**
 * Convert ParseResult error to string message
 */
export const parseErrorToString = (error: ParseResult.ParseError): string => {
  return String(error);
};

/**
 * Validate and map error to custom error type
 */
export const validateWith =
  <A, I, E>(
    schema: S.Schema<A, I, never>,
    mapError: (error: ParseResult.ParseError) => E
  ) =>
  (input: unknown): Effect.Effect<A, E, never> =>
    S.decodeUnknown(schema)(input).pipe(Effect.mapError(mapError));

/**
 * Validate optional field
 */
export const validateOptional =
  <A, I>(schema: S.Schema<A, I, never>) =>
  (
    input: unknown
  ): Effect.Effect<A | undefined, ParseResult.ParseError, never> =>
    input === undefined || input === null
      ? Effect.succeed(undefined)
      : S.decodeUnknown(schema)(input);

/**
 * Validate array of items
 */
export const validateArray = <A, I, R>(schema: S.Schema<A, I, R>) =>
  S.Array(schema);

/**
 * Create a validator that checks multiple conditions
 */
export const combine =
  <A>(...validators: Array<(value: A) => Effect.Effect<void, Error>>) =>
  (value: A): Effect.Effect<void, Error> =>
    Effect.all(validators.map((v) => v(value))).pipe(
      Effect.map(() => undefined)
    );
