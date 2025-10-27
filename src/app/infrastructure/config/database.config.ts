import { Effect } from "effect";
import path from "path";

/**
 * Database configuration
 */
export interface DatabaseConfig {
  readonly path: string;
  readonly readonly: boolean;
  readonly fileMustExist: boolean;
}

/**
 * Load database config from environment
 */
export const loadDatabaseConfig = (): DatabaseConfig => ({
  path: process.env.DATABASE_PATH || path.join(process.cwd(), "data", "hdm.db"),
  readonly: false,
  fileMustExist: false,
});

/**
 * Database config as Effect
 */
export const DatabaseConfigLive = Effect.succeed(loadDatabaseConfig());
