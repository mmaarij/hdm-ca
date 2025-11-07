import { Effect, Option, Context } from "effect";
import {
  DocumentEntity,
  DocumentVersionEntity,
  DocumentWithVersion,
} from "./entity";
import { DocumentDomainError } from "./errors";
import { DocumentId, UserId } from "../refined/uuid";
import { Checksum, ContentRef, Filename } from "./value-object";
import { PaginationParams, Paginated } from "../shared/pagination";

/**
 * Document Repository Interface
 *
 * Defines the contract for document data persistence operations.
 *
 * Document is the aggregate root. Versions are managed internally
 * and should not be directly exposed through the repository interface
 * for external manipulation.
 */
export interface DocumentRepository {
  /**
   * Save a document (creates or updates the aggregate including all versions)
   */
  readonly save: (
    document: DocumentEntity
  ) => Effect.Effect<DocumentEntity, DocumentDomainError>;

  /**
   * Find document by ID (loads the aggregate)
   */
  readonly findById: (
    id: DocumentId
  ) => Effect.Effect<Option.Option<DocumentEntity>, DocumentDomainError>;

  /**
   * Find document by version checksum (for idempotency checks)
   * Returns the parent document, not the version directly
   */
  readonly findByChecksum: (
    checksum: Checksum
  ) => Effect.Effect<Option.Option<DocumentEntity>, DocumentDomainError>;

  /**
   * Find document by content reference
   * Returns the parent document, not the version directly
   */
  readonly findByContentRef: (
    contentRef: ContentRef
  ) => Effect.Effect<Option.Option<DocumentEntity>, DocumentDomainError>;

  /**
   * Find document by filename and user (for duplicate check)
   * Returns the parent document if found
   */
  readonly findByFilenameAndUser: (
    filename: Filename,
    userId: UserId
  ) => Effect.Effect<Option.Option<DocumentEntity>, DocumentDomainError>;

  /**
   * List documents by user with pagination
   * Returns documents with their latest version for display
   */
  readonly listByUser: (
    userId: UserId,
    pagination: PaginationParams
  ) => Effect.Effect<Paginated<DocumentWithVersion>, DocumentDomainError>;

  /**
   * List all documents with pagination
   */
  readonly listAll: (
    pagination: PaginationParams
  ) => Effect.Effect<Paginated<DocumentWithVersion>, DocumentDomainError>;

  /**
   * Search documents by query
   */
  readonly search: (
    query: string,
    pagination: PaginationParams
  ) => Effect.Effect<Paginated<DocumentEntity>, DocumentDomainError>;

  /**
   * Delete document (and all its versions)
   */
  readonly delete: (id: DocumentId) => Effect.Effect<void, DocumentDomainError>;

  /**
   * Add audit log entry
   */
  readonly addAudit: (
    documentId: DocumentId,
    action: string,
    performedBy: UserId,
    details: Option.Option<string>
  ) => Effect.Effect<void, DocumentDomainError>;
}

/**
 * Context tag for dependency injection
 */
export const DocumentRepositoryTag = Context.GenericTag<DocumentRepository>(
  "@app/DocumentRepository"
);
