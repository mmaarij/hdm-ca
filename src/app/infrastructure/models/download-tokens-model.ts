import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { v4 as uuid } from "uuid";
import { immutableColumns } from "./shared-columns";
import { documents } from "./documents-model";
import { documentVersions } from "./document-versions-model";
import { users } from "./users-model";

/**
 * Download tokens table
 */
export const downloadTokens = sqliteTable(
  "download_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuid()),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    versionId: text("version_id").references(() => documentVersions.id, {
      onDelete: "cascade",
    }),
    token: text("token").unique().notNull(),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...immutableColumns,
  },
  (table) => ({
    tokenIdx: index("idx_download_tokens_token").on(table.token),
    expiresAtIdx: index("idx_download_tokens_expires_at").on(table.expiresAt),
  })
);
