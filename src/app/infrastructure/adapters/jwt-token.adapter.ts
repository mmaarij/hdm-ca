/**
 * JWT Token Service Adapter
 *
 * Infrastructure implementation of JwtPort using jsonwebtoken.
 */

import { Effect, Layer, Config } from "effect";
import jwt, { type SignOptions } from "jsonwebtoken";
import type {
  JwtPort,
  JwtPayload,
  JwtSignResult,
} from "../../application/ports/jwt.port";
import { JwtPortTag } from "../../application/ports/jwt.port";
import { makeUserId } from "../../domain/refined/uuid";
import { makeEmailAddress } from "../../domain/refined/email";

/**
 * JWT configuration from environment
 */
const JWT_SECRET = Config.string("JWT_SECRET").pipe(
  Config.withDefault("your-secret-key-change-in-production")
);

const JWT_EXPIRY = Config.string("JWT_EXPIRY").pipe(Config.withDefault("24h"));

/**
 * JWT-based token service implementation
 */
const makeJwtService = (secret: string, expiry: string): JwtPort => ({
  sign: (payload: JwtPayload): Effect.Effect<JwtSignResult, Error> =>
    Effect.try({
      try: () => {
        // Note: jwt library's SignOptions type is restrictive for expiresIn
        // but accepts string format like "24h" at runtime
        const token = jwt.sign(
          {
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
          },
          secret,
          { expiresIn: expiry } as SignOptions
        );
        const expiresIn = parseExpiryToSeconds(expiry);
        return { token, expiresIn };
      },
      catch: (error) => new Error(`JWT signing failed: ${error}`),
    }),

  verify: (token: string): Effect.Effect<JwtPayload, Error> =>
    Effect.gen(function* () {
      const decoded = yield* Effect.try({
        try: () => jwt.verify(token, secret),
        catch: (error) => new Error(`JWT verification failed: ${error}`),
      });

      if (typeof decoded === "string") {
        return yield* Effect.fail(new Error("Invalid token payload"));
      }

      const userId = yield* makeUserId(decoded.userId);
      const email = yield* makeEmailAddress(decoded.email);

      return {
        userId,
        email,
        role: decoded.role as string,
      };
    }),
});

/**
 * Parse JWT expiry string to seconds
 */
function parseExpiryToSeconds(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 86400; // Default 24h

  const [, value, unit] = match;
  const numValue = parseInt(value, 10);

  switch (unit) {
    case "s":
      return numValue;
    case "m":
      return numValue * 60;
    case "h":
      return numValue * 3600;
    case "d":
      return numValue * 86400;
    default:
      return 86400;
  }
}

/**
 * Layer providing JwtService with configuration
 */
export const JwtServiceLive = Layer.effect(
  JwtPortTag,
  Effect.gen(function* () {
    const secret = yield* JWT_SECRET;
    const expiry = yield* JWT_EXPIRY;
    return makeJwtService(secret, expiry);
  })
);
