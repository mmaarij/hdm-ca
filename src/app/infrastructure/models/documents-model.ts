import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { v4 as uuid } from "uuid";
import { sharedColumns } from "./shared-columns";
import { users } from "./users-model";

/**
 * Documents table (document headers/metadata)
 */
export const documents = sqliteTable(
  "documents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuid()),
    filename: text("filename").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    path: text("path").notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...sharedColumns,
  },
  (table) => ({
    uploadedByIdx: index("idx_documents_uploaded_by").on(table.uploadedBy),
  })
);
