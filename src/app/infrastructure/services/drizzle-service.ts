import { drizzle, BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { Effect, Context, Layer } from "effect";
import * as schema from "../models";
import { loadDatabaseConfig } from "../config/database.config";

/**
 * Drizzle database instance
 */
export type DrizzleDB = BunSQLiteDatabase<typeof schema>;

/**
 * Database service tag
 */
export class DrizzleService extends Context.Tag("DrizzleService")<
  DrizzleService,
  { readonly db: DrizzleDB }
>() {}

/**
 * Create database instance
 */
export const makeDrizzleDb = (): DrizzleDB => {
  const config = loadDatabaseConfig();
  const sqlite = new Database(config.path);
  // Ensure SQLite enforces foreign key constraints so ON DELETE CASCADE works
  try {
    sqlite.exec("PRAGMA foreign_keys = ON;");
  } catch (e) {
    // If enabling PRAGMA fails for any reason, continue - cascade may not work.
    // Errors will surface via DB constraint failures later.
  }
  return drizzle(sqlite, { schema });
};

/**
 * Database service implementation
 */
export const DrizzleServiceLive = Layer.succeed(DrizzleService, {
  db: makeDrizzleDb(),
});

/**
 * Get database instance from context
 */
export const getDb = Effect.gen(function* () {
  const service = yield* DrizzleService;
  return service.db;
});
