/**
 * Document Request DTOs
 *
 * Command/Query DTOs for document-related operations.
 * Simplified single-step upload flow with automatic versioning.
 */

import { Schema as S } from "effect";
import {
  DocumentId,
  DocumentVersionId,
  UserId,
} from "../../../domain/refined/uuid";
import {
  Filename,
  MimeType,
  FileSize,
  FilePath,
} from "../../../domain/document/value-object";
import type { UploadedFile } from "../../ports/storage.port";

/**
 * Upload Document Command
 *
 * Single-step upload that creates new document or adds version to existing.
 * If documentId is provided, creates a new version; otherwise creates new document.
 * File metadata is automatically extracted by the storage layer.
 */
export const UploadDocumentCommand = S.Struct({
  documentId: S.optional(DocumentId), // Optional: provide to add new version
  file: S.Any as S.Schema<UploadedFile>, // The uploaded file itself
  uploadedBy: UserId,
});

export type UploadDocumentCommand = S.Schema.Type<typeof UploadDocumentCommand>;

/**
 * Get Document Query
 */
export const GetDocumentQuery = S.Struct({
  documentId: DocumentId,
  userId: UserId, // For permission checking
});

export type GetDocumentQuery = S.Schema.Type<typeof GetDocumentQuery>;

/**
 * Get Document Version Query
 */
export const GetDocumentVersionQuery = S.Struct({
  documentId: DocumentId,
  versionId: DocumentVersionId,
  userId: UserId, // For permission checking
});

export type GetDocumentVersionQuery = S.Schema.Type<
  typeof GetDocumentVersionQuery
>;

/**
 * List Documents Query
 */
export const ListDocumentsQuery = S.Struct({
  userId: UserId,
  page: S.optional(S.Number.pipe(S.positive())),
  limit: S.optional(S.Number.pipe(S.positive(), S.lessThanOrEqualTo(100))),
});

export type ListDocumentsQuery = S.Schema.Type<typeof ListDocumentsQuery>;

/**
 * List All Documents Query (Admin)
 */
export const ListAllDocumentsQuery = S.Struct({
  page: S.optional(S.Number.pipe(S.positive())),
  limit: S.optional(S.Number.pipe(S.positive(), S.lessThanOrEqualTo(100))),
});

export type ListAllDocumentsQuery = S.Schema.Type<typeof ListAllDocumentsQuery>;

/**
 * Search Documents Query
 */
export const SearchDocumentsQuery = S.Struct({
  query: S.String.pipe(S.minLength(1)),
  userId: UserId, // For permission checking
  page: S.optional(S.Number.pipe(S.positive())),
  limit: S.optional(S.Number.pipe(S.positive(), S.lessThanOrEqualTo(100))),
});

export type SearchDocumentsQuery = S.Schema.Type<typeof SearchDocumentsQuery>;

/**
 * Delete Document Command
 */
export const DeleteDocumentCommand = S.Struct({
  documentId: DocumentId,
  userId: UserId, // For permission checking
});

export type DeleteDocumentCommand = S.Schema.Type<typeof DeleteDocumentCommand>;
