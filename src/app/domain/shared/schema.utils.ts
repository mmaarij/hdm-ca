import { Schema as S, ParseResult } from "effect";

/**
 * Schema utilities for common patterns
 */

/**
 * Create a non-empty string schema
 */
export const NonEmptyString = (params?: {
  minLength?: number;
  maxLength?: number;
  message?: string;
}) => {
  const trimmed = S.Trim;
  const nonEmpty = trimmed.pipe(
    S.nonEmptyString({
      message: () => params?.message || "String cannot be empty",
    })
  );

  if (params?.minLength && params?.maxLength) {
    return nonEmpty.pipe(
      S.minLength(params.minLength),
      S.maxLength(params.maxLength)
    );
  } else if (params?.minLength) {
    return nonEmpty.pipe(S.minLength(params.minLength));
  } else if (params?.maxLength) {
    return nonEmpty.pipe(S.maxLength(params.maxLength));
  }

  return nonEmpty;
};

/**
 * Create a positive integer schema
 */
export const PositiveInt = S.Int.pipe(S.greaterThan(0));

/**
 * Create a non-negative integer schema
 */
export const NonNegativeInt = S.Int.pipe(S.greaterThanOrEqualTo(0));

/**
 * Create a nullable schema
 */
export const nullable = <A, I, R>(schema: S.Schema<A, I, R>) =>
  S.NullOr(schema);

/**
 * Create an optional nullable schema
 */
export const optionalNullable = <A, I, R>(schema: S.Schema<A, I, R>) =>
  S.optional(S.NullOr(schema));

/**
 * Create an enum from a const array
 */
export const enumFromArray = <T extends readonly string[]>(values: T) =>
  S.Literal(...values);

/**
 * Create a URL schema
 */
export const Url = S.String.pipe(
  S.filter(
    (s) => {
      try {
        new URL(s);
        return true;
      } catch {
        return false;
      }
    },
    { message: () => "Invalid URL format" }
  )
);

/**
 * Merge two struct schemas
 */
export const mergeStructs = <
  A extends S.Struct.Fields,
  B extends S.Struct.Fields
>(
  a: S.Struct<A>,
  b: S.Struct<B>
): S.Struct<A & B> => S.Struct({ ...a.fields, ...b.fields });

/**
 * Pick fields from a struct schema
 */
export const pickFields = <A extends S.Struct.Fields, K extends keyof A>(
  schema: S.Struct<A>,
  ...keys: K[]
): S.Struct<Pick<A, K>> => {
  const picked = {} as Pick<A, K>;
  for (const key of keys) {
    picked[key] = schema.fields[key];
  }
  return S.Struct(picked);
};

/**
 * Omit fields from a struct schema
 */
export const omitFields = <A extends S.Struct.Fields, K extends keyof A>(
  schema: S.Struct<A>,
  ...keys: K[]
): S.Struct<Omit<A, K>> => {
  const omitted = { ...schema.fields };
  for (const key of keys) {
    delete omitted[key];
  }
  return S.Struct(omitted as Omit<A, K>);
};
