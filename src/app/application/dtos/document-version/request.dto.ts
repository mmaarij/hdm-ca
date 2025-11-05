/**
 * Document Version Request DTOs
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
  FilePath,
} from "../../../domain/document/value-object";

/**
 * Upload New Version Command
 *
 * Simplified to match document upload flow.
 * File metadata is automatically extracted by the storage layer.
 */
export const UploadNewVersionCommand = S.Struct({
  documentId: DocumentId,
  file: S.Any, // The uploaded file itself (type: UploadedFile)
  uploadedBy: UserId,
});

export type UploadNewVersionCommand = S.Schema.Type<
  typeof UploadNewVersionCommand
>;

/**
 * List Versions Query
 */
export const ListVersionsQuery = S.Struct({
  documentId: DocumentId,
  userId: UserId, // For permission checking
});

export type ListVersionsQuery = S.Schema.Type<typeof ListVersionsQuery>;

/**
 * Get Version Query
 */
export const GetVersionQuery = S.Struct({
  versionId: DocumentVersionId,
  userId: UserId, // For permission checking
});

export type GetVersionQuery = S.Schema.Type<typeof GetVersionQuery>;

/**
 * Get Latest Version Query
 */
export const GetLatestVersionQuery = S.Struct({
  documentId: DocumentId,
  userId: UserId, // For permission checking
});

export type GetLatestVersionQuery = S.Schema.Type<typeof GetLatestVersionQuery>;
