import { Effect, Config } from "effect";

/**
 * Server configuration
 */
export interface ServerConfig {
  readonly port: number;
  readonly hostname: string;
  readonly environment: "development" | "production" | "test";
}

/**
 * Load server config from environment
 */
export const loadServerConfig = (): ServerConfig => ({
  port: Number(process.env.PORT) || 3000,
  hostname: process.env.HOSTNAME || "localhost",
  environment: (process.env.NODE_ENV as any) || "development",
});

/**
 * Server config as Effect
 */
export const ServerConfigLive = Effect.succeed(loadServerConfig());
