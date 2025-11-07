import { Effect, Option, Context } from "effect";
import {
  DocumentPermissionEntity as DocumentPermission,
  PermissionId,
} from "./entity";
import { PermissionDomainError } from "./errors";
import { DocumentId, UserId } from "../refined/uuid";
import { PermissionType } from "./value-object";

/**
 * Permission Repository Interface
 *
 * Defines the contract for permission data persistence operations.
 * Repositories work with entities, not payloads.
 */
export interface PermissionRepository {
  /**
   * Save a permission (create or update)
   */
  readonly save: (
    permission: DocumentPermission
  ) => Effect.Effect<DocumentPermission, PermissionDomainError>;

  /**
   * Find permission by ID
   */
  readonly findById: (
    id: PermissionId
  ) => Effect.Effect<Option.Option<DocumentPermission>, PermissionDomainError>;

  /**
   * Find permissions for a document
   */
  readonly findByDocument: (
    documentId: DocumentId
  ) => Effect.Effect<readonly DocumentPermission[], PermissionDomainError>;

  /**
   * Find permissions for a user on a specific document
   */
  readonly findByUserAndDocument: (
    userId: UserId,
    documentId: DocumentId
  ) => Effect.Effect<readonly DocumentPermission[], PermissionDomainError>;

  /**
   * Find all permissions for a user across all documents
   */
  readonly findByUser: (
    userId: UserId
  ) => Effect.Effect<readonly DocumentPermission[], PermissionDomainError>;

  /**
   * Delete permission
   */
  readonly delete: (
    id: PermissionId
  ) => Effect.Effect<void, PermissionDomainError>;

  /**
   * Check if user has specific permission on document
   */
  readonly hasPermission: (
    userId: UserId,
    documentId: DocumentId,
    permission: PermissionType
  ) => Effect.Effect<boolean, PermissionDomainError>;

  /**
   * Delete all permissions for a document
   */
  readonly deleteByDocument: (
    documentId: DocumentId
  ) => Effect.Effect<void, PermissionDomainError>;
}

/**
 * Context tag for dependency injection
 */
export const PermissionRepositoryTag = Context.GenericTag<PermissionRepository>(
  "@app/PermissionRepository"
);
