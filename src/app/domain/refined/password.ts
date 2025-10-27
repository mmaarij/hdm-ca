import { Schema as S, Effect } from "effect";
import crypto from "crypto";

/**
 * Password policy & validation (plain password input).
 */
export const PASSWORD_POLICY = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBERS: true,
  REQUIRE_SPECIAL_CHARS: true,
  SPECIAL_CHARS: /[!@#$%^&*(),.?":{}|<>]/,
} as const;

export const Password = S.String.pipe(
  S.filter((value) => value.length >= PASSWORD_POLICY.MIN_LENGTH, {
    message: () =>
      `Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters long`,
  }),
  S.filter((value) => value.length <= PASSWORD_POLICY.MAX_LENGTH, {
    message: () =>
      `Password cannot exceed ${PASSWORD_POLICY.MAX_LENGTH} characters`,
  }),
  S.filter(
    (value) => !PASSWORD_POLICY.REQUIRE_UPPERCASE || /[A-Z]/.test(value),
    {
      message: () => "Password must contain at least one uppercase letter",
    }
  ),
  S.filter(
    (value) => !PASSWORD_POLICY.REQUIRE_LOWERCASE || /[a-z]/.test(value),
    {
      message: () => "Password must contain at least one lowercase letter",
    }
  ),
  S.filter((value) => !PASSWORD_POLICY.REQUIRE_NUMBERS || /\d/.test(value), {
    message: () => "Password must contain at least one number",
  }),
  S.filter(
    (value) =>
      !PASSWORD_POLICY.REQUIRE_SPECIAL_CHARS ||
      PASSWORD_POLICY.SPECIAL_CHARS.test(value),
    { message: () => "Password must contain at least one special character" }
  ),
  S.brand("Password")
);
export type Password = S.Schema.Type<typeof Password>;

export const makePassword = (input: unknown) =>
  S.decodeUnknown(Password)(input);
export const makePasswordSync = (input: unknown) =>
  S.decodeUnknownSync(Password)(input);

/**
 * Hashed password (opaque string; storage-safe bounds).
 * We store as 'algo:params:salt:hash' (e.g., 'scrypt:N=16384,r=8,p=1:<saltBase64>:<hashBase64>').
 */
export const HashedPassword = S.String.pipe(
  S.filter((value) => value.length > 0, {
    message: () => "Hashed password cannot be empty",
  }),
  S.filter((value) => value.length <= 255, {
    message: () => "Hashed password cannot exceed 255 characters",
  }),
  S.brand("HashedPassword")
);
export type HashedPassword = S.Schema.Type<typeof HashedPassword>;

export const makeHashedPassword = (input: unknown) =>
  S.decodeUnknown(HashedPassword)(input);

/**
 * Scrypt parameters (balanced for server-side; tune to your SLA)
 * rules for scrypt:
 *  N: the cost factor, the number of iterations of the algorithm
 *  r: the block size (memory usage)
 *  p: the parallelization factor (threads)
 *  salt: a random salt (random bytes)
 *  key: the derived key
 *  encoded: the encoded password
 *
 */
const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const SALT_BYTES = 16;
const KEYLEN = 64;

/** Hash a valid Password with scrypt and random salt, returning a branded HashedPassword. */
export const hashPassword = (
  password: string
): Effect.Effect<HashedPassword, Error, never> =>
  Effect.try(() => {
    const salt = crypto.randomBytes(SALT_BYTES);
    const key = crypto.scryptSync(password, salt, KEYLEN, {
      N: SCRYPT_N,
      r: SCRYPT_r,
      p: SCRYPT_p,
    });
    const encoded = `scrypt:N=${SCRYPT_N},r=${SCRYPT_r},p=${SCRYPT_p}:${salt.toString(
      "base64"
    )}:${key.toString("base64")}`;
    return S.decodeUnknownSync(HashedPassword)(encoded);
  });

/** Verify a plain password against a stored HashedPassword. */
export const verifyPassword = (
  password: string,
  stored: HashedPassword
): Effect.Effect<boolean, Error, never> =>
  Effect.try(() => {
    const parts = stored.split(":");
    if (parts.length !== 4) return false;

    const [algoPart, paramsPart, saltPart, hashPart] = parts;
    if (!algoPart.startsWith("scrypt") || !saltPart || !hashPart) return false;

    const conf: Record<string, string> = Object.fromEntries(
      paramsPart.split(",").map((kv) => kv.split("="))
    );
    const N = Number(conf["N"] ?? SCRYPT_N);
    const r = Number(conf["r"] ?? SCRYPT_r);
    const p = Number(conf["p"] ?? SCRYPT_p);

    const salt = Buffer.from(saltPart, "base64");
    const expected = Buffer.from(hashPart, "base64");
    const derived = crypto.scryptSync(password, salt, expected.length, {
      N,
      r,
      p,
    });

    return crypto.timingSafeEqual(derived, expected);
  });
