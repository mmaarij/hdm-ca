/**
 * Document Request DTOs
 *
 * Command/Query DTOs for document-related operations.
 */

import { Schema as S } from "effect";
import { DocumentId, UserId } from "../../../domain/refined/uuid";
import {
  Filename,
  MimeType,
  FileSize,
  FilePath,
} from "../../../domain/document/value-object";

/**
 * Upload Document Command
 *
 * File content is handled separately (e.g., multipart form data in HTTP layer)
 * This DTO captures metadata about the upload.
 */
export const UploadDocumentCommand = S.Struct({
  filename: Filename,
  originalName: Filename,
  mimeType: MimeType,
  size: FileSize,
  path: FilePath, // Temporary storage path from upload
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
 * Update Document Command
 */
export const UpdateDocumentCommand = S.Struct({
  documentId: DocumentId,
  userId: UserId, // For permission checking
  filename: S.optional(Filename),
  originalName: S.optional(Filename),
});

export type UpdateDocumentCommand = S.Schema.Type<typeof UpdateDocumentCommand>;

/**
 * Delete Document Command
 */
export const DeleteDocumentCommand = S.Struct({
  documentId: DocumentId,
  userId: UserId, // For permission checking
});

export type DeleteDocumentCommand = S.Schema.Type<typeof DeleteDocumentCommand>;
