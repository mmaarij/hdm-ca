import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
} from "drizzle-orm/sqlite-core";
import { v4 as uuid } from "uuid";
import { immutableColumns } from "./shared-columns";
import { documents } from "./documents-model";
import { users } from "./users-model";

/**
 * Document versions table
 */
export const documentVersions = sqliteTable(
  "document_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuid()),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    path: text("path").notNull(),
    versionNumber: integer("version_number").notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => users.id),
    ...immutableColumns,
  },
  (table) => ({
    documentIdIdx: index("idx_document_versions_document_id").on(
      table.documentId
    ),
    versionNumberIdx: index("idx_document_versions_version_number").on(
      table.documentId,
      table.versionNumber
    ),
    uniqueVersionPerDoc: unique("unique_version_per_document").on(
      table.documentId,
      table.versionNumber
    ),
  })
);
