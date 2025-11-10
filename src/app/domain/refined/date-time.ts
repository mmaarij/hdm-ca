import { Schema as S } from "effect";

/**
 * Branded DateTime type with proper JSON encoding/decoding
 *
 * - Encoded form: ISO-8601 string for JSON serialization
 * - Decoded form: Date object with "DateTime" brand
 *
 * When encoding to JSON, Date objects are converted to ISO strings.
 * When decoding from JSON, ISO strings are converted to Date objects.
 */
export const DateTime = S.DateFromString.pipe(S.brand("DateTime"));
export type DateTime = S.Schema.Type<typeof DateTime>;

/**
 * @deprecated Use DateTime directly - it already handles ISO strings
 */
export const DateTimeIso = DateTime;
export type DateTimeIso = S.Schema.Type<typeof DateTimeIso>;

/**
 * Epoch millis <-> DateTime
 */
export const DateTimeEpoch = S.transform(S.Number, DateTime, {
  strict: true,
  decode: (epoch) => new Date(epoch).toISOString(),
  encode: (dateStr) => new Date(dateStr).getTime(),
});
export type DateTimeEpoch = S.Schema.Type<typeof DateTimeEpoch>;

/**
 * Runtime constructors for creating DateTime values
 *
 * These are for use in domain logic where you need to create DateTime values.
 * Since DateTime is Date & Brand<"DateTime">, we create branded Date objects.
 * The Schema handles encoding Date -> ISO string automatically when serializing to JSON.
 */
export const DateTimeHelpers = {
  /** Get current date/time as branded DateTime */
  now: (): DateTime => new Date() as DateTime,

  /** Convert Date to branded DateTime */
  fromDate: (date: Date): DateTime => date as DateTime,

  /** Convert ISO string to branded DateTime */
  fromISOString: (iso: string): DateTime => new Date(iso) as DateTime,

  /** Convert timestamp to branded DateTime */
  fromTimestamp: (timestamp: number): DateTime =>
    new Date(timestamp) as DateTime,
} as const;
