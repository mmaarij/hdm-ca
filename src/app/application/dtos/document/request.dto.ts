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
  StringToDocumentId,
  StringToDocumentVersionId,
  StringToUserId,
} from "../../../domain/refined/uuid";
import {
  Filename,
  MimeType,
  FileSize,
  FilePath,
} from "../../../domain/document/value-object";
import type { UploadedFile } from "../../ports/storage.port";

/**
 * Upload Document Input (raw from API)
 */
export const UploadDocumentInput = S.Struct({
  documentId: S.optional(S.String),
  file: S.Any as S.Schema<UploadedFile>,
  uploadedBy: S.String,
});

export type UploadDocumentInput = S.Schema.Type<typeof UploadDocumentInput>;

/**
 * Upload Document Command (branded)
 *
 * Single-step upload that creates new document or adds version to existing.
 * If documentId is provided, creates a new version; otherwise creates new document.
 * File metadata is automatically extracted by the storage layer.
 */
export const UploadDocumentCommand = S.Struct({
  documentId: S.optional(StringToDocumentId),
  file: S.Any as S.Schema<UploadedFile>,
  uploadedBy: StringToUserId,
});

export type UploadDocumentCommand = S.Schema.Type<typeof UploadDocumentCommand>;

/**
 * Get Document Input (raw from API)
 */
export const GetDocumentInput = S.Struct({
  documentId: S.String,
  userId: S.String,
});

export type GetDocumentInput = S.Schema.Type<typeof GetDocumentInput>;

/**
 * Get Document Query (branded)
 */
export const GetDocumentQuery = S.Struct({
  documentId: StringToDocumentId,
  userId: StringToUserId,
});

export type GetDocumentQuery = S.Schema.Type<typeof GetDocumentQuery>;

/**
 * Get Document Version Input (raw from API)
 */
export const GetDocumentVersionInput = S.Struct({
  documentId: S.String,
  versionId: S.String,
  userId: S.String,
});

export type GetDocumentVersionInput = S.Schema.Type<
  typeof GetDocumentVersionInput
>;

/**
 * Get Document Version Query (branded)
 */
export const GetDocumentVersionQuery = S.Struct({
  documentId: StringToDocumentId,
  versionId: StringToDocumentVersionId,
  userId: StringToUserId,
});

export type GetDocumentVersionQuery = S.Schema.Type<
  typeof GetDocumentVersionQuery
>;

/**
 * List Documents Input (raw from API)
 */
export const ListDocumentsInput = S.Struct({
  userId: S.String,
  page: S.optional(S.Number.pipe(S.positive())),
  limit: S.optional(S.Number.pipe(S.positive(), S.lessThanOrEqualTo(100))),
});

export type ListDocumentsInput = S.Schema.Type<typeof ListDocumentsInput>;

/**
 * List Documents Query (branded)
 */
export const ListDocumentsQuery = S.Struct({
  userId: StringToUserId,
  page: S.optional(S.Number.pipe(S.positive())),
  limit: S.optional(S.Number.pipe(S.positive(), S.lessThanOrEqualTo(100))),
});

export type ListDocumentsQuery = S.Schema.Type<typeof ListDocumentsQuery>;

/**
 * List All Documents Input (raw from API, Admin)
 */
export const ListAllDocumentsInput = S.Struct({
  userId: S.String,
  page: S.optional(S.Number.pipe(S.positive())),
  limit: S.optional(S.Number.pipe(S.positive(), S.lessThanOrEqualTo(100))),
});

export type ListAllDocumentsInput = S.Schema.Type<typeof ListAllDocumentsInput>;

/**
 * List All Documents Query (branded, Admin)
 */
export const ListAllDocumentsQuery = S.Struct({
  userId: StringToUserId,
  page: S.optional(S.Number.pipe(S.positive())),
  limit: S.optional(S.Number.pipe(S.positive(), S.lessThanOrEqualTo(100))),
});

export type ListAllDocumentsQuery = S.Schema.Type<typeof ListAllDocumentsQuery>;

/**
 * Search Documents Input (raw from API)
 */
export const SearchDocumentsInput = S.Struct({
  query: S.String.pipe(S.minLength(1)),
  userId: S.String,
  page: S.optional(S.Number.pipe(S.positive())),
  limit: S.optional(S.Number.pipe(S.positive(), S.lessThanOrEqualTo(100))),
});

export type SearchDocumentsInput = S.Schema.Type<typeof SearchDocumentsInput>;

/**
 * Search Documents Query (branded)
 */
export const SearchDocumentsQuery = S.Struct({
  query: S.String.pipe(S.minLength(1)),
  userId: StringToUserId,
  page: S.optional(S.Number.pipe(S.positive())),
  limit: S.optional(S.Number.pipe(S.positive(), S.lessThanOrEqualTo(100))),
});

export type SearchDocumentsQuery = S.Schema.Type<typeof SearchDocumentsQuery>;

/**
 * Delete Document Input (raw from API)
 */
export const DeleteDocumentInput = S.Struct({
  documentId: S.String,
  userId: S.String,
});

export type DeleteDocumentInput = S.Schema.Type<typeof DeleteDocumentInput>;

/**
 * Delete Document Command (branded)
 */
export const DeleteDocumentCommand = S.Struct({
  documentId: StringToDocumentId,
  userId: StringToUserId,
});

export type DeleteDocumentCommand = S.Schema.Type<typeof DeleteDocumentCommand>;
