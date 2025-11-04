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
 */
export const UploadNewVersionCommand = S.Struct({
  documentId: DocumentId,
  filename: Filename,
  originalName: Filename,
  mimeType: MimeType,
  size: FileSize,
  path: FilePath, // Temporary storage path from upload
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
