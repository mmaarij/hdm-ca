import { Effect, Option, Context } from "effect";
import { DocumentMetadataEntity as DocumentMetadata, MetadataId } from "./entity";
import { MetadataDomainError } from "./errors";
import { DocumentId } from "../refined/uuid";

/**
 * Metadata Repository Interface
 *
 * Defines the contract for metadata data persistence operations.
 * Repositories work with entities, not payloads.
 */
export interface MetadataRepository {
  /**
   * Save a metadata entry (create or update)
   */
  readonly save: (
    metadata: DocumentMetadata
  ) => Effect.Effect<DocumentMetadata, MetadataDomainError>;

  /**
   * Find metadata by ID
   */
  readonly findById: (
    id: MetadataId
  ) => Effect.Effect<Option.Option<DocumentMetadata>, MetadataDomainError>;

  /**
   * Find metadata by document and key
   */
  readonly findByDocumentAndKey: (
    documentId: DocumentId,
    key: string
  ) => Effect.Effect<Option.Option<DocumentMetadata>, MetadataDomainError>;

  /**
   * Find all metadata for a document
   */
  readonly findByDocument: (
    documentId: DocumentId
  ) => Effect.Effect<readonly DocumentMetadata[], MetadataDomainError>;

  /**
   * Delete metadata
   */
  readonly delete: (id: MetadataId) => Effect.Effect<void, MetadataDomainError>;

  /**
   * Delete all metadata for a document
   */
  readonly deleteByDocument: (
    documentId: DocumentId
  ) => Effect.Effect<void, MetadataDomainError>;

  /**
   * Delete metadata by document and key
   */
  readonly deleteByDocumentAndKey: (
    documentId: DocumentId,
    key: string
  ) => Effect.Effect<void, MetadataDomainError>;
}

/**
 * Context tag for dependency injection
 */
export const MetadataRepositoryTag = Context.GenericTag<MetadataRepository>(
  "@app/MetadataRepository"
);
