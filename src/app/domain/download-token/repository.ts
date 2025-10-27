import { Effect, Option, Context } from "effect";
import { DownloadToken, CreateDownloadTokenPayload } from "./entity";
import { DownloadTokenDomainError } from "./errors";
import { DownloadTokenId, DocumentId } from "../refined/uuid";
import { Token } from "./value-object";

/**
 * Download Token Repository Interface
 *
 * Defines the contract for download token data persistence operations.
 */
export interface DownloadTokenRepository {
  /**
   * Create a new download token
   */
  readonly create: (
    payload: CreateDownloadTokenPayload
  ) => Effect.Effect<DownloadToken, DownloadTokenDomainError>;

  /**
   * Find token by ID
   */
  readonly findById: (
    id: DownloadTokenId
  ) => Effect.Effect<Option.Option<DownloadToken>, DownloadTokenDomainError>;

  /**
   * Find token by token string
   */
  readonly findByToken: (
    token: Token
  ) => Effect.Effect<Option.Option<DownloadToken>, DownloadTokenDomainError>;

  /**
   * Find all tokens for a document
   */
  readonly findByDocument: (
    documentId: DocumentId
  ) => Effect.Effect<readonly DownloadToken[], DownloadTokenDomainError>;

  /**
   * Mark token as used
   */
  readonly markAsUsed: (
    id: DownloadTokenId
  ) => Effect.Effect<DownloadToken, DownloadTokenDomainError>;

  /**
   * Delete token
   */
  readonly delete: (
    id: DownloadTokenId
  ) => Effect.Effect<void, DownloadTokenDomainError>;

  /**
   * Delete all tokens for a document
   */
  readonly deleteByDocument: (
    documentId: DocumentId
  ) => Effect.Effect<void, DownloadTokenDomainError>;

  /**
   * Delete expired tokens (cleanup)
   */
  readonly deleteExpired: () => Effect.Effect<number, DownloadTokenDomainError>;
}

/**
 * Context tag for dependency injection
 */
export const DownloadTokenRepositoryTag =
  Context.GenericTag<DownloadTokenRepository>("@app/DownloadTokenRepository");
