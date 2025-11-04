import { Effect, Option, Context } from "effect";
import {
  Document,
  DocumentVersion,
  CreateDocumentPayload,
  CreateDocumentVersionPayload,
  UpdateDocumentPayload,
  UpdateDocumentVersionPayload,
  DocumentWithVersion,
} from "./entity";
import { DocumentDomainError } from "./errors";
import { DocumentId, DocumentVersionId, UserId } from "../refined/uuid";
import { Checksum, ContentRef } from "./value-object";

/**
 * Pagination parameters
 */
export interface PaginationParams {
  readonly page: number;
  readonly limit: number;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  readonly page: number;
  readonly limit: number;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

/**
 * Paginated result
 */
export interface Paginated<T> {
  readonly data: readonly T[];
  readonly meta: PaginationMeta;
}

/**
 * Document Repository Interface
 *
 * Defines the contract for document data persistence operations.
 */
export interface DocumentRepository {
  /**
   * Create a new document
   */
  readonly createDocument: (
    payload: CreateDocumentPayload
  ) => Effect.Effect<Document, DocumentDomainError>;

  /**
   * Create a new document version
   */
  /**
   * Create a new document version.
   *
   * DocumentVersion instances are part of the Document aggregate
   * and should be prepared/managed via the aggregate root in domain logic.
   * Repository implementations still persist versions, but application code
   * should create the version payload using the aggregate (for example
   * DocumentAggregate.prepareAddVersion) and then call this method. External
   * code should not mutate DocumentVersion instances directly.
   */
  readonly createVersion: (
    payload: CreateDocumentVersionPayload
  ) => Effect.Effect<DocumentVersion, DocumentDomainError>;

  /**
   * Find document by ID
   */
  readonly findDocument: (
    id: DocumentId
  ) => Effect.Effect<Option.Option<Document>, DocumentDomainError>;

  /**
   * Find version by ID
   */
  readonly findVersionById: (
    id: DocumentVersionId
  ) => Effect.Effect<Option.Option<DocumentVersion>, DocumentDomainError>;

  /**
   * Find version by checksum (for idempotency)
   */
  readonly findVersionByChecksum: (
    checksum: Checksum
  ) => Effect.Effect<Option.Option<DocumentVersion>, DocumentDomainError>;

  /**
   * Find version by content reference
   */
  readonly findVersionByContentRef: (
    contentRef: ContentRef
  ) => Effect.Effect<Option.Option<DocumentVersion>, DocumentDomainError>;

  /**
   * Get latest version of a document
   */
  readonly getLatestVersion: (
    documentId: DocumentId
  ) => Effect.Effect<Option.Option<DocumentVersion>, DocumentDomainError>;

  /**
   * List all versions for a given document
   */
  readonly listVersions: (
    documentId: DocumentId
  ) => Effect.Effect<readonly DocumentVersion[], DocumentDomainError>;

  /**
   * List documents by user with pagination
   */
  readonly listByUser: (
    userId: UserId,
    pagination: PaginationParams
  ) => Effect.Effect<Paginated<DocumentWithVersion>, DocumentDomainError>;

  /**
   * List all documents with pagination (admin)
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
  ) => Effect.Effect<Paginated<DocumentVersion>, DocumentDomainError>;

  /**
   * Update document
   */
  readonly updateDocument: (
    id: DocumentId,
    payload: UpdateDocumentPayload
  ) => Effect.Effect<Document, DocumentDomainError>;

  /**
   * Update document version
   */
  readonly updateVersion: (
    id: DocumentVersionId,
    payload: UpdateDocumentVersionPayload
  ) => Effect.Effect<DocumentVersion, DocumentDomainError>;

  /**
   * Delete document (and all versions)
   */
  readonly deleteDocument: (
    id: DocumentId
  ) => Effect.Effect<void, DocumentDomainError>;

  /**
   * Add audit log entry
   */
  readonly addAudit: (payload: {
    documentId: DocumentId;
    action: string;
    performedBy: UserId;
    details?: string;
  }) => Effect.Effect<void, DocumentDomainError>;
}

/**
 * Context tag for dependency injection
 */
export const DocumentRepositoryTag = Context.GenericTag<DocumentRepository>(
  "@app/DocumentRepository"
);
