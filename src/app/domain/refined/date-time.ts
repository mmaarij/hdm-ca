import { Schema as S } from "effect";

/**
 * Branded Date type used across the domain.
 */
export const DateTime = S.Date.pipe(S.brand("DateTime"));
export type DateTime = S.Schema.Type<typeof DateTime>;

/**
 * ISO-8601 string <-> DateTime
 */
export const DateTimeIso = S.DateFromString.pipe(S.brand("DateTime"));
export type DateTimeIso = S.Schema.Type<typeof DateTimeIso>;

/**
 * Epoch millis <-> DateTime
 */
export const DateTimeEpoch = S.transform(S.Number, DateTime, {
  decode: (epoch) => new Date(epoch),
  encode: (value) => value,
  strict: false,
});
export type DateTimeEpoch = S.Schema.Type<typeof DateTimeEpoch>;

/**
 * Accept Date | string | number → DateTime
 */
export const DateTimeFromAny = S.transform(S.Unknown, DateTime, {
  decode: (input) => {
    if (input instanceof Date) return input;
    if (typeof input === "string" || typeof input === "number")
      return new Date(input);
    throw new Error(`Cannot convert ${typeof input} to Date`);
  },
  encode: (value) => value,
  strict: false,
});
export type DateTimeFromAny = S.Schema.Type<typeof DateTimeFromAny>;

/**
 * Union transformer: string → DateTime
 * Use in DTOs to accept ISO-8601 strings and transform to branded DateTime
 */
export const StringToDateTime = S.DateFromString.pipe(S.brand("DateTime"));
export type StringToDateTime = S.Schema.Type<typeof StringToDateTime>;

/**
 * Union transformer: number → DateTime
 * Use in DTOs to accept epoch timestamps and transform to branded DateTime
 */
export const NumberToDateTime = S.transform(S.Number, DateTime, {
  decode: (epoch) => new Date(epoch),
  encode: (date) => date,
  strict: false,
});
export type NumberToDateTime = S.Schema.Type<typeof NumberToDateTime>;

/**
 * Union transformer: string | number → DateTime
 * Use in DTOs to accept either ISO-8601 strings or epoch timestamps
 */
export const StringOrNumberToDateTime = S.Union(
  StringToDateTime,
  NumberToDateTime
);
export type StringOrNumberToDateTime = S.Schema.Type<
  typeof StringOrNumberToDateTime
>;

/** Constructors */
export const makeDateTimeFromIso = (input: unknown) =>
  S.decodeUnknown(DateTimeIso)(input);
export const makeDateTimeFromEpoch = (input: unknown) =>
  S.decodeUnknown(DateTimeEpoch)(input);
export const makeDateTimeFromAny = (input: unknown) =>
  S.decodeUnknown(DateTimeFromAny)(input);
