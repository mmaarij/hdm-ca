/**
 * Document Aggregate
 *
 * The Document entity itself is the aggregate root.
 * It manages its versions internally through factory methods:
 * - Document.create()
 * - Document.addVersion()
 * - Document.getLatestVersion()
 * - Document.getVersion()
 * - Document.getAllVersions()
 * - Document.hasVersion()
 *
 * Use the Document entity directly instead of a separate aggregate class.
 */

// Re-export entity types for convenience
export type { Document, DocumentVersion } from "./entity";
