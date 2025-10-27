import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { documents } from "./documents-model";
import { users } from "./users-model";

/**
 * Document audit log table
 */
export const documentAudit = sqliteTable(
  "document_audit",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuid()),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    performedBy: text("performed_by")
      .notNull()
      .references(() => users.id),
    details: text("details").notNull().default(""),
    performedAt: text("performed_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    documentIdIdx: index("idx_audit_document_id").on(table.documentId),
    performedAtIdx: index("idx_audit_performed_at").on(table.performedAt),
  })
);
