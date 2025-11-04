/**
 * Download Token Request DTOs
 */

import { Schema as S } from "effect";
import {
  DocumentId,
  UserId,
  DocumentVersionId,
} from "../../../domain/refined/uuid";
import { Token } from "../../../domain/download-token/value-object";

/**
 * Generate Download Link Command
 */
export const GenerateDownloadLinkCommand = S.Struct({
  documentId: DocumentId,
  versionId: S.optional(DocumentVersionId), // If not provided, use latest version
  userId: UserId, // For permission checking
  ttlMs: S.optional(S.Number.pipe(S.positive())), // Time-to-live in milliseconds (optional, default applies)
});

export type GenerateDownloadLinkCommand = S.Schema.Type<
  typeof GenerateDownloadLinkCommand
>;

/**
 * Validate Download Token Query
 */
export const ValidateDownloadTokenQuery = S.Struct({
  token: Token,
});

export type ValidateDownloadTokenQuery = S.Schema.Type<
  typeof ValidateDownloadTokenQuery
>;

/**
 * Download File Query
 */
export const DownloadFileQuery = S.Struct({
  token: Token,
});

export type DownloadFileQuery = S.Schema.Type<typeof DownloadFileQuery>;

/**
 * Cleanup Expired Tokens Command (Admin only)
 */
export const CleanupExpiredTokensCommand = S.Struct({
  userId: UserId, // For admin authorization
});

export type CleanupExpiredTokensCommand = S.Schema.Type<
  typeof CleanupExpiredTokensCommand
>;

/**
 * Mark Token Used Command (Internal)
 */
export const MarkTokenUsedCommand = S.Struct({
  token: Token,
});

export type MarkTokenUsedCommand = S.Schema.Type<typeof MarkTokenUsedCommand>;
