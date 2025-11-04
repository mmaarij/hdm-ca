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
  Checksum,
  DocumentStatus,
} from "../../../domain/document/value-object";

/**
 * Initiate Upload Command
 *
 * Creates a document record in DRAFT status and returns pre-signed upload URL.
 * This is Phase 1 of the two-phase upload workflow.
 */
export const InitiateUploadCommand = S.Struct({
  filename: Filename,
  originalName: Filename,
  mimeType: MimeType,
  size: FileSize,
  checksum: Checksum, // SHA-256 hash of file content for idempotency
  uploadedBy: UserId,
});

export type InitiateUploadCommand = S.Schema.Type<typeof InitiateUploadCommand>;

/**
 * Confirm Upload Command
 *
 * Confirms that the file was successfully uploaded to storage.
 * This is Phase 2 of the two-phase upload workflow.
 */
export const ConfirmUploadCommand = S.Struct({
  documentId: DocumentId,
  userId: UserId, // For permission checking
  checksum: Checksum, // Must match the initial checksum
  storagePath: FilePath, // Actual storage path after upload
});

export type ConfirmUploadCommand = S.Schema.Type<typeof ConfirmUploadCommand>;

/**
 * Create Document Metadata Command
 *
 * Creates a document record without immediate file upload (metadata-only).
 * File can be uploaded later via initiate/confirm workflow.
 */
export const CreateDocumentMetadataCommand = S.Struct({
  filename: Filename,
  originalName: Filename,
  mimeType: MimeType,
  size: FileSize,
  uploadedBy: UserId,
});

export type CreateDocumentMetadataCommand = S.Schema.Type<
  typeof CreateDocumentMetadataCommand
>;

/**
 * Upload Document Command (DEPRECATED - Use two-phase upload instead)
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
 * Publish Document Command
 */
export const PublishDocumentCommand = S.Struct({
  documentId: DocumentId,
  userId: UserId, // For permission checking
});

export type PublishDocumentCommand = S.Schema.Type<
  typeof PublishDocumentCommand
>;

/**
 * Unpublish Document Command
 */
export const UnpublishDocumentCommand = S.Struct({
  documentId: DocumentId,
  userId: UserId, // For permission checking
});

export type UnpublishDocumentCommand = S.Schema.Type<
  typeof UnpublishDocumentCommand
>;

/**
 * Delete Document Command
 */
export const DeleteDocumentCommand = S.Struct({
  documentId: DocumentId,
  userId: UserId, // For permission checking
});

export type DeleteDocumentCommand = S.Schema.Type<typeof DeleteDocumentCommand>;
