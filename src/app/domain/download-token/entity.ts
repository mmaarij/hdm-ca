import { Schema as S, Option, Effect as E, pipe } from "effect";
import {
  DownloadTokenId,
  DocumentId,
  DocumentVersionId,
  UserId,
} from "../refined/uuid";
import { Token } from "./value-object";
import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";
import {
  BaseEntity,
  IEntity,
  Maybe,
  normalizeMaybe,
  optionToMaybe,
} from "../shared/base-entity";
import { DownloadTokenValidationError } from "./errors";
import * as DownloadTokenGuards from "./guards";
import { DownloadTokenSchema, DownloadTokenWithDocumentSchema } from "./schema";

// ============================================================================
// Serialized Types
// ============================================================================
export type SerializedDownloadToken = {
  readonly id: string;
  readonly documentId: string;
  readonly versionId?: Maybe<string>;
  readonly token: string;
  readonly expiresAt: Date;
  readonly usedAt?: Maybe<Date>;
  readonly createdBy: string;
  readonly createdAt?: Date;
};

/**
 * Serialized DownloadTokenWithDocument type (for API responses)
 */
export type SerializedDownloadTokenWithDocument = {
  readonly token: string;
  readonly documentId: string;
  readonly versionId?: Maybe<string>;
  readonly expiresAt: Date;
  readonly downloadUrl: string;
};

// ============================================================================
// DownloadToken Entity
// ============================================================================

/**
 * Download Token Entity - Aggregate Root
 *
 * Represents a shareable link for downloading a document or specific version.
 */
export class DownloadTokenEntity extends BaseEntity implements IEntity {
  constructor(
    public readonly id: DownloadTokenId,
    public readonly documentId: DocumentId,
    public readonly versionId: Option.Option<DocumentVersionId>,
    public readonly token: Token,
    public readonly expiresAt: Date,
    public readonly usedAt: Option.Option<Date>,
    public readonly createdBy: UserId,
    public readonly createdAt: Date
  ) {
    super();
  }

  /**
   * Create a new download token with validation
   */
  static create(
    input: SerializedDownloadToken
  ): E.Effect<DownloadTokenEntity, DownloadTokenValidationError, never> {
    return pipe(
      S.decodeUnknown(DownloadTokenSchema)(input),
      E.flatMap((data) => {
        return E.succeed(
          new DownloadTokenEntity(
            data.id,
            data.documentId,
            normalizeMaybe(data.versionId),
            data.token,
            data.expiresAt,
            normalizeMaybe(data.usedAt),
            data.createdBy,
            data.createdAt ?? new Date()
          )
        );
      }),
      E.mapError(
        (error) =>
          new DownloadTokenValidationError({
            message: `Download token validation failed: ${error}`,
          })
      )
    );
  }

  /**
   * Mark token as used
   */
  markAsUsed(): DownloadTokenEntity {
    return new DownloadTokenEntity(
      this.id,
      this.documentId,
      this.versionId,
      this.token,
      this.expiresAt,
      Option.some(new Date()),
      this.createdBy,
      this.createdAt
    );
  }

  /**
   * Check if token is expired
   */
  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  /**
   * Check if token has been used
   */
  isUsed(): boolean {
    return Option.isSome(this.usedAt);
  }

  /**
   * Check if token is valid (not expired and not used)
   */
  isValid(): boolean {
    return !this.isExpired() && !this.isUsed();
  }

  /**
   * Create token with document info for API response
   */
  withDocumentInfo(downloadUrl: string): SerializedDownloadTokenWithDocument {
    return {
      token: this.token,
      documentId: this.documentId,
      versionId: optionToMaybe(this.versionId),
      expiresAt: this.expiresAt,
      downloadUrl,
    };
  }

  /**
   * Serialize to external format
   */
  serialize(): SerializedDownloadToken {
    return {
      id: this.id,
      documentId: this.documentId,
      versionId: optionToMaybe(this.versionId),
      token: this.token,
      expiresAt: this.expiresAt,
      usedAt: optionToMaybe(this.usedAt),
      createdBy: this.createdBy,
      createdAt: this.createdAt,
    };
  }
}

// ============================================================================
// Legacy Type Aliases and Factory Functions (for backward compatibility)
// ============================================================================

/**
 * Legacy DownloadToken type alias
 * @deprecated Use DownloadTokenEntity instead
 */
export type DownloadToken = DownloadTokenEntity;

/**
 * Legacy DownloadTokenWithDocument type alias
 * @deprecated Use SerializedDownloadTokenWithDocument instead
 */
export interface DownloadTokenWithDocument {
  readonly token: Token;
  readonly documentId: DocumentId;
  readonly versionId: Option.Option<DocumentVersionId>;
  readonly expiresAt: Date;
  readonly downloadUrl: string;
}

/**
 * Legacy DownloadToken factory functions
 * @deprecated Use DownloadTokenEntity methods instead
 */
export const DownloadToken = {
  /**
   * Create a new download token
   */
  create: (props: {
    documentId: DocumentId;
    versionId?: DocumentVersionId;
    createdBy: UserId;
    expiresInHours?: number;
  }): DownloadTokenEntity => {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (props.expiresInHours ?? 24) * 60 * 60 * 1000
    );

    // Generate secure random token
    const tokenValue = randomBytes(32).toString("base64url");

    return new DownloadTokenEntity(
      uuidv4() as DownloadTokenId,
      props.documentId,
      normalizeMaybe(props.versionId),
      tokenValue as Token,
      expiresAt,
      Option.none(),
      props.createdBy,
      now
    );
  },

  /**
   * Mark token as used
   */
  markAsUsed: (token: DownloadTokenEntity): DownloadTokenEntity =>
    token.markAsUsed(),

  /**
   * Check if token is expired
   */
  isExpired: (token: DownloadTokenEntity): boolean => token.isExpired(),

  /**
   * Check if token has been used
   */
  isUsed: (token: DownloadTokenEntity): boolean => token.isUsed(),

  /**
   * Check if token is valid (not expired and not used)
   */
  isValid: (token: DownloadTokenEntity): boolean => token.isValid(),

  /**
   * Create token with document info for API response
   */
  withDocumentInfo: (
    token: DownloadTokenEntity,
    downloadUrl: string
  ): SerializedDownloadTokenWithDocument => token.withDocumentInfo(downloadUrl),
};
