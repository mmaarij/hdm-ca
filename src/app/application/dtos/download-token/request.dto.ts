/**
 * Download Token Request DTOs
 */

import { Schema as S } from "effect";
import {
  DocumentId,
  UserId,
  DocumentVersionId,
  StringToDocumentId,
  StringToUserId,
  StringToDocumentVersionId,
} from "../../../domain/refined/uuid";
import { Token } from "../../../domain/download-token/value-object";

/**
 * Generate Download Link Input (raw from API)
 */
export const GenerateDownloadLinkInput = S.Struct({
  documentId: S.String,
  versionId: S.optional(S.String),
  userId: S.String,
  ttlMs: S.optional(S.Number.pipe(S.positive())),
});

export type GenerateDownloadLinkInput = S.Schema.Type<
  typeof GenerateDownloadLinkInput
>;

/**
 * Generate Download Link Command (branded)
 */
export const GenerateDownloadLinkCommand = S.Struct({
  documentId: StringToDocumentId,
  versionId: S.optional(StringToDocumentVersionId),
  userId: StringToUserId,
  ttlMs: S.optional(S.Number.pipe(S.positive())),
});

export type GenerateDownloadLinkCommand = S.Schema.Type<
  typeof GenerateDownloadLinkCommand
>;

/**
 * Validate Download Token Input (raw from API)
 */
export const ValidateDownloadTokenInput = S.Struct({
  token: S.String,
});

export type ValidateDownloadTokenInput = S.Schema.Type<
  typeof ValidateDownloadTokenInput
>;

/**
 * Validate Download Token Query (branded)
 */
export const ValidateDownloadTokenQuery = S.Struct({
  token: Token,
});

export type ValidateDownloadTokenQuery = S.Schema.Type<
  typeof ValidateDownloadTokenQuery
>;

/**
 * Download File Input (raw from API)
 */
export const DownloadFileInput = S.Struct({
  token: S.String,
});

export type DownloadFileInput = S.Schema.Type<typeof DownloadFileInput>;

/**
 * Download File Query (branded)
 */
export const DownloadFileQuery = S.Struct({
  token: Token,
});

export type DownloadFileQuery = S.Schema.Type<typeof DownloadFileQuery>;

/**
 * Cleanup Expired Tokens Input (raw from API)
 */
export const CleanupExpiredTokensInput = S.Struct({
  userId: S.String,
});

export type CleanupExpiredTokensInput = S.Schema.Type<
  typeof CleanupExpiredTokensInput
>;

/**
 * Cleanup Expired Tokens Command (branded, Admin only)
 */
export const CleanupExpiredTokensCommand = S.Struct({
  userId: StringToUserId,
});

export type CleanupExpiredTokensCommand = S.Schema.Type<
  typeof CleanupExpiredTokensCommand
>;

/**
 * Mark Token Used Input (raw from API)
 */
export const MarkTokenUsedInput = S.Struct({
  token: S.String,
});

export type MarkTokenUsedInput = S.Schema.Type<typeof MarkTokenUsedInput>;

/**
 * Mark Token Used Command (branded, Internal)
 */
export const MarkTokenUsedCommand = S.Struct({
  token: Token,
});

export type MarkTokenUsedCommand = S.Schema.Type<typeof MarkTokenUsedCommand>;
