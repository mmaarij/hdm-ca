import { Schema as S } from "effect";

/**
 * Email validation schema (normalized to lowercase+trim).
 */
export const EmailAddress = S.String.pipe(
  S.filter((value) => value.trim().length > 0, {
    message: () => "Email cannot be empty",
  }),
  S.filter((value) => value.length <= 254, {
    message: () => "Email cannot exceed 254 characters",
  }),
  S.filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: () => "Invalid email format",
  }),
  S.brand("EmailAddress")
);

export type EmailAddress = S.Schema.Type<typeof EmailAddress>;

export const makeEmailAddress = (input: unknown) =>
  S.decodeUnknown(EmailAddress)(input);
export const makeEmailAddressSync = (input: unknown) =>
  S.decodeUnknownSync(EmailAddress)(input);

export const getEmailDomain = (email: EmailAddress): string => {
  const [, domain = ""] = email.split("@");
  return domain;
};

export const getEmailLocalPart = (email: EmailAddress): string => {
  const [local = ""] = email.split("@");
  return local;
};
