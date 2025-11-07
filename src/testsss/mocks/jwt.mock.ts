/**
 * Mock JWT Port Implementation
 *
 * Simple mock for testing without actual JWT signing/verification
 */

import { Effect, Layer } from "effect";
import type {
  JwtPort,
  JwtPayload,
  JwtSignResult,
} from "../../app/application/ports/jwt.port";
import { JwtPortTag } from "../../app/application/ports/jwt.port";

/**
 * Mock JWT tokens are just base64 encoded JSON
 */
const createMockToken = (payload: JwtPayload): string => {
  const json = JSON.stringify(payload);
  return `mock.${Buffer.from(json).toString("base64")}`;
};

const parseMockToken = (token: string): JwtPayload | null => {
  try {
    const [prefix, encoded] = token.split(".");
    if (prefix !== "mock") {
      return null;
    }
    const json = Buffer.from(encoded, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
};

/**
 * Mock JWT port for testing
 */
export const createMockJwt = (): JwtPort => ({
  sign: (payload: JwtPayload): Effect.Effect<JwtSignResult, Error> => {
    const token = createMockToken(payload);
    return Effect.succeed({
      token,
      expiresIn: 3600, // 1 hour
    });
  },

  verify: (token: string): Effect.Effect<JwtPayload, Error> => {
    const payload = parseMockToken(token);
    if (!payload) {
      return Effect.fail(new Error("Invalid token"));
    }
    return Effect.succeed(payload);
  },
});

/**
 * Mock JWT layer for dependency injection
 */
export const MockJwtLive = Layer.succeed(JwtPortTag, createMockJwt());

/**
 * Helper to create a mock JWT token for testing
 */
export const createMockJwtToken = (payload: JwtPayload): string => {
  return createMockToken(payload);
};

/**
 * Helper to decode a mock JWT token for assertions
 */
export const decodeMockJwtToken = (token: string): JwtPayload | null => {
  return parseMockToken(token);
};
