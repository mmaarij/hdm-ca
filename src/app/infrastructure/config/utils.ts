import { Effect } from "effect";

/**
 * JWT configuration
 */
export interface JwtConfig {
  readonly secret: string;
  readonly expiresIn: string;
}

/**
 * Load JWT config from environment
 */
export const loadJwtConfig = (): JwtConfig => ({
  secret: process.env.JWT_SECRET || "jwt_secret_key_change_in_production",
  expiresIn: process.env.JWT_EXPIRES_IN || "24h",
});

/**
 * JWT config as Effect
 */
export const JwtConfigLive = Effect.succeed(loadJwtConfig());

/**
 * Export for easy access
 */
export const getJwtConfig = loadJwtConfig();
