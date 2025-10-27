import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuid } from "uuid";
import { sharedColumns } from "./shared-columns";

/**
 * Users table
 */
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuid()),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(),
  ...sharedColumns,
});
