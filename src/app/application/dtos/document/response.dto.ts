/**
 * Document Response DTOs
 */

import { Schema as S } from "effect";
import {
  DocumentId,
  UserId,
  DocumentVersionId,
} from "../../../domain/refined/uuid";
import {
  Filename,
  MimeType,
  FileSize,
  VersionNumber,
  DocumentStatus,
  Checksum,
} from "../../../domain/document/value-object";
import { DateTime } from "../../../domain/refined/date-time";

/**
 * Document Response
 */
export const DocumentResponse = S.Struct({
  id: DocumentId,
  filename: Filename,
  originalName: Filename,
  mimeType: MimeType,
  size: FileSize,
  status: DocumentStatus, // DRAFT or PUBLISHED
  uploadedBy: UserId,
  createdAt: S.optional(DateTime),
  updatedAt: S.optional(DateTime),
});

export type DocumentResponse = S.Schema.Type<typeof DocumentResponse>;

/**
 * Document Version Response
 */
export const DocumentVersionResponse = S.Struct({
  id: DocumentVersionId,
  documentId: DocumentId,
  filename: Filename,
  originalName: Filename,
  mimeType: MimeType,
  size: FileSize,
  versionNumber: VersionNumber,
  uploadedBy: UserId,
  createdAt: S.optional(DateTime),
});

export type DocumentVersionResponse = S.Schema.Type<
  typeof DocumentVersionResponse
>;

/**
 * Document with Latest Version Response
 */
export const DocumentWithVersionResponse = S.Struct({
  document: DocumentResponse,
  latestVersion: S.optional(DocumentVersionResponse),
});

export type DocumentWithVersionResponse = S.Schema.Type<
  typeof DocumentWithVersionResponse
>;

/**
 * Upload Document Response
 */
export const UploadDocumentResponse = S.Struct({
  documentId: DocumentId,
  versionId: DocumentVersionId,
  document: DocumentResponse,
  version: DocumentVersionResponse,
});

export type UploadDocumentResponse = S.Schema.Type<
  typeof UploadDocumentResponse
>;

/**
 * Initiate Upload Response
 */
export const InitiateUploadResponse = S.Struct({
  documentId: DocumentId,
  versionId: DocumentVersionId,
  uploadUrl: S.String, // Pre-signed URL for upload
  checksum: Checksum, // Echo back for confirmation
  expiresAt: DateTime, // URL expiration time
});

export type InitiateUploadResponse = S.Schema.Type<
  typeof InitiateUploadResponse
>;

/**
 * Confirm Upload Response
 */
export const ConfirmUploadResponse = S.Struct({
  documentId: DocumentId,
  versionId: DocumentVersionId,
  status: DocumentStatus,
  document: DocumentResponse,
  version: DocumentVersionResponse,
});

export type ConfirmUploadResponse = S.Schema.Type<typeof ConfirmUploadResponse>;

/**
 * Paginated Documents Response
 */
export const PaginatedDocumentsResponse = S.Struct({
  documents: S.Array(DocumentWithVersionResponse),
  total: S.Number,
  page: S.Number,
  limit: S.Number,
  totalPages: S.Number,
  hasNextPage: S.Boolean,
  hasPreviousPage: S.Boolean,
});

export type PaginatedDocumentsResponse = S.Schema.Type<
  typeof PaginatedDocumentsResponse
>;

/**
 * Search Documents Response
 */
export const SearchDocumentsResponse = S.Struct({
  results: S.Array(DocumentVersionResponse),
  total: S.Number,
  page: S.Number,
  limit: S.Number,
  totalPages: S.Number,
  hasNextPage: S.Boolean,
  hasPreviousPage: S.Boolean,
});

export type SearchDocumentsResponse = S.Schema.Type<
  typeof SearchDocumentsResponse
>;
