import { Schema as S, Option } from "effect";
import {
  DownloadTokenId,
  DocumentId,
  DocumentVersionId,
  UserId,
} from "../refined/uuid";
import { DateTime } from "../refined/date-time";
import { Token } from "./value-object";
import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";

/**
 * Download Token Entity - Pure Domain Model
 *
 * Represents a shareable link for downloading a document or specific version.
 */
export interface DownloadToken {
  readonly id: DownloadTokenId;
  readonly documentId: DocumentId;
  readonly versionId: Option.Option<DocumentVersionId>;
  readonly token: Token;
  readonly expiresAt: Date;
  readonly usedAt: Option.Option<Date>;
  readonly createdBy: UserId;
  readonly createdAt: Date;
}

/**
 * Download token with document info (for API responses)
 */
export interface DownloadTokenWithDocument {
  readonly token: Token;
  readonly documentId: DocumentId;
  readonly versionId: Option.Option<DocumentVersionId>;
  readonly expiresAt: Date;
  readonly downloadUrl: string;
}

/**
 * Factory functions for DownloadToken entity
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
  }): DownloadToken => {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (props.expiresInHours ?? 24) * 60 * 60 * 1000
    );

    // Generate secure random token
    const tokenValue = randomBytes(32).toString("base64url");

    return {
      id: uuidv4() as DownloadTokenId,
      documentId: props.documentId,
      versionId: props.versionId ? Option.some(props.versionId) : Option.none(),
      token: tokenValue as Token,
      expiresAt,
      usedAt: Option.none(),
      createdBy: props.createdBy,
      createdAt: now,
    };
  },

  /**
   * Mark token as used
   */
  markAsUsed: (token: DownloadToken): DownloadToken => ({
    ...token,
    usedAt: Option.some(new Date()),
  }),

  /**
   * Check if token is expired
   */
  isExpired: (token: DownloadToken): boolean => {
    return new Date() > token.expiresAt;
  },

  /**
   * Check if token has been used
   */
  isUsed: (token: DownloadToken): boolean => {
    return Option.isSome(token.usedAt);
  },

  /**
   * Check if token is valid (not expired and not used)
   */
  isValid: (token: DownloadToken): boolean => {
    return !DownloadToken.isExpired(token) && !DownloadToken.isUsed(token);
  },

  /**
   * Create token with document info for API response
   */
  withDocumentInfo: (
    token: DownloadToken,
    downloadUrl: string
  ): DownloadTokenWithDocument => ({
    token: token.token,
    documentId: token.documentId,
    versionId: token.versionId,
    expiresAt: token.expiresAt,
    downloadUrl,
  }),
};

// ============================================================================
// Schema Definitions for Validation (kept for backward compatibility)
// ============================================================================

/**
 * DownloadToken Schema for validation
 */
export const DownloadTokenSchema = S.Struct({
  id: DownloadTokenId,
  documentId: DocumentId,
  versionId: S.optional(DocumentVersionId),
  token: Token,
  expiresAt: DateTime,
  usedAt: S.optional(DateTime),
  createdBy: UserId,
  createdAt: S.optional(DateTime),
});

/**
 * DownloadTokenWithDocument Schema for validation
 */
export const DownloadTokenWithDocumentSchema = S.Struct({
  token: Token,
  documentId: DocumentId,
  versionId: S.optional(DocumentVersionId),
  expiresAt: DateTime,
  downloadUrl: S.String,
});
