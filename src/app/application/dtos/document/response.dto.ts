/**
 * Document Response DTOs
 *
 * Simplified response structures without status field.
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
} from "../../../domain/document/value-object";
import { DateTime } from "../../../domain/refined/date-time";
import { Paginated, PaginationMeta } from "../../../domain/shared/pagination";

/**
 * Document Response
 */
export const DocumentResponse = S.Struct({
  id: DocumentId,
  filename: Filename,
  originalName: Filename,
  mimeType: MimeType,
  size: FileSize,
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
 * Paginated Documents Response
 */
export const PaginatedDocumentsResponseSchema = Paginated(
  DocumentWithVersionResponse
);
export type PaginatedDocumentsResponse = S.Schema.Type<
  typeof PaginatedDocumentsResponseSchema
>;

/**
 * Search Documents Response (returns unique documents, not versions)
 */
export const SearchDocumentsResponseSchema = Paginated(DocumentResponse);
export type SearchDocumentsResponse = S.Schema.Type<
  typeof SearchDocumentsResponseSchema
>;
