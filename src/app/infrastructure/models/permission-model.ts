import { sqliteTable, text, index, unique } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { documents } from "./documents-model";
import { users } from "./users-model";

/**
 * Document permissions table
 */
export const documentPermissions = sqliteTable(
  "document_permissions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuid()),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
    grantedBy: text("granted_by")
      .notNull()
      .references(() => users.id),
    grantedAt: text("granted_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    documentUserIdx: index("idx_permissions_document_user").on(
      table.documentId,
      table.userId
    ),
    uniquePermissionPerUser: unique("unique_permission_per_user").on(
      table.documentId,
      table.userId,
      table.permission
    ),
  })
);
