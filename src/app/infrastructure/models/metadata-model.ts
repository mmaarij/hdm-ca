import { sqliteTable, text, index, unique } from "drizzle-orm/sqlite-core";
import { v4 as uuid } from "uuid";
import { immutableColumns } from "./shared-columns";
import { documents } from "./documents-model";

/**
 * Document metadata table
 */
export const documentMetadata = sqliteTable(
  "document_metadata",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuid()),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    ...immutableColumns,
  },
  (table) => ({
    documentIdIdx: index("idx_metadata_document_id").on(table.documentId),
    uniqueKeyPerDoc: unique("unique_metadata_key_per_document").on(
      table.documentId,
      table.key
    ),
  })
);
