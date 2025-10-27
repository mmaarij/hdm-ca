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

/** Constructors */
export const makeDateTimeFromIso = (input: unknown) =>
  S.decodeUnknown(DateTimeIso)(input);
export const makeDateTimeFromEpoch = (input: unknown) =>
  S.decodeUnknown(DateTimeEpoch)(input);
export const makeDateTimeFromAny = (input: unknown) =>
  S.decodeUnknown(DateTimeFromAny)(input);
