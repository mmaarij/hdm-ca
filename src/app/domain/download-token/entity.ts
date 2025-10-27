import { Schema as S } from "effect";
import {
  DownloadTokenId,
  DocumentId,
  DocumentVersionId,
  UserId,
} from "../refined/uuid";
import { DateTime } from "../refined/date-time";
import { Token } from "./value-object";

/**
 * Download Token Entity
 *
 * Represents a shareable link for downloading a document or specific version.
 */
export const DownloadToken = S.Struct({
  id: DownloadTokenId,
  documentId: DocumentId,
  versionId: S.optional(DocumentVersionId),
  token: Token,
  expiresAt: DateTime,
  usedAt: S.optional(DateTime),
  createdBy: UserId,
  createdAt: S.optional(DateTime),
});

export type DownloadToken = S.Schema.Type<typeof DownloadToken>;

/**
 * Create Download Token payload
 */
export const CreateDownloadTokenPayload = S.Struct({
  id: S.optional(DownloadTokenId),
  documentId: DocumentId,
  versionId: S.optional(DocumentVersionId),
  token: S.optional(Token),
  expiresAt: S.optional(DateTime),
  createdBy: UserId,
});

export type CreateDownloadTokenPayload = S.Schema.Type<
  typeof CreateDownloadTokenPayload
>;

/**
 * Download token with document info (for API responses)
 */
export const DownloadTokenWithDocument = S.Struct({
  token: Token,
  documentId: DocumentId,
  versionId: S.optional(DocumentVersionId),
  expiresAt: DateTime,
  downloadUrl: S.String,
});

export type DownloadTokenWithDocument = S.Schema.Type<
  typeof DownloadTokenWithDocument
>;
