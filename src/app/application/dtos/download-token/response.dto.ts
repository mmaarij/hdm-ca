/**
 * Download Token Response DTOs
 */

import { Schema as S } from "effect";
import { DocumentId, DocumentVersionId } from "../../../domain/refined/uuid";
import { Token } from "../../../domain/download-token/value-object";
import { DateTime } from "../../../domain/refined/date-time";

/**
 * Download Link Response
 */
export const DownloadLinkResponse = S.Struct({
  token: Token,
  documentId: DocumentId,
  versionId: S.optional(DocumentVersionId),
  downloadUrl: S.String,
  expiresAt: DateTime,
});

export type DownloadLinkResponse = S.Schema.Type<typeof DownloadLinkResponse>;

/**
 * Download File Response
 *
 * This is metadata about the file to download.
 * The actual file stream/buffer is handled by the infrastructure layer.
 */
export const DownloadFileResponse = S.Struct({
  documentId: DocumentId,
  versionId: DocumentVersionId,
  filename: S.String,
  mimeType: S.String,
  size: S.Number,
  path: S.String, // Storage path for infrastructure to retrieve
});

export type DownloadFileResponse = S.Schema.Type<typeof DownloadFileResponse>;

/**
 * Validate Token Response
 */
export const ValidateTokenResponse = S.Struct({
  valid: S.Boolean,
  documentId: S.optional(DocumentId),
  versionId: S.optional(DocumentVersionId),
  expiresAt: S.optional(DateTime),
});

export type ValidateTokenResponse = S.Schema.Type<typeof ValidateTokenResponse>;

/**
 * Cleanup Tokens Response
 */
export const CleanupTokensResponse = S.Struct({
  deletedCount: S.Number,
  message: S.String,
});

export type CleanupTokensResponse = S.Schema.Type<typeof CleanupTokensResponse>;
