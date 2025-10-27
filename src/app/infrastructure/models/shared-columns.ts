import { text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Shared columns for all tables with timestamps
 */
export const sharedColumns = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
};

/**
 * Shared columns for immutable tables (no updatedAt)
 */
export const immutableColumns = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
};
