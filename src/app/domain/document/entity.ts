import { Schema as S } from "effect";
import { DocumentId, DocumentVersionId, UserId } from "../refined/uuid";
import { DateTime } from "../refined/date-time";
import {
  Filename,
  FilePath,
  MimeType,
  FileSize,
  VersionNumber,
} from "./value-object";

/**
 * Document Entity
 *
 * Represents a document in the system (header/metadata only).
 * Actual file content is stored in versions.
 */
export const Document = S.Struct({
  id: DocumentId,
  filename: Filename,
  originalName: Filename,
  mimeType: MimeType,
  size: FileSize,
  path: FilePath,
  uploadedBy: UserId,
  createdAt: S.optional(DateTime),
  updatedAt: S.optional(DateTime),
});

export type Document = S.Schema.Type<typeof Document>;

/**
 * Document Version Entity
 *
 * Represents a specific version of a document with its file content.
 */
export const DocumentVersion = S.Struct({
  id: DocumentVersionId,
  documentId: DocumentId,
  filename: Filename,
  originalName: Filename,
  mimeType: MimeType,
  size: FileSize,
  path: FilePath,
  versionNumber: VersionNumber,
  uploadedBy: UserId,
  createdAt: S.optional(DateTime),
});

export type DocumentVersion = S.Schema.Type<typeof DocumentVersion>;

/**
 * Create Document payload
 */
export const CreateDocumentPayload = S.Struct({
  id: S.optional(DocumentId),
  filename: Filename,
  originalName: Filename,
  mimeType: MimeType,
  size: FileSize,
  path: FilePath,
  uploadedBy: UserId,
});

export type CreateDocumentPayload = S.Schema.Type<typeof CreateDocumentPayload>;

/**
 * Create Document Version payload
 */
export const CreateDocumentVersionPayload = S.Struct({
  id: S.optional(DocumentVersionId),
  documentId: DocumentId,
  filename: Filename,
  originalName: Filename,
  mimeType: MimeType,
  size: FileSize,
  path: FilePath,
  versionNumber: VersionNumber,
  uploadedBy: UserId,
});

export type CreateDocumentVersionPayload = S.Schema.Type<
  typeof CreateDocumentVersionPayload
>;

/**
 * Update Document payload
 */
export const UpdateDocumentPayload = S.partial(
  S.Struct({
    filename: Filename,
    originalName: Filename,
  })
);

export type UpdateDocumentPayload = S.Schema.Type<typeof UpdateDocumentPayload>;

/**
 * Document with its latest version (for listing)
 */
export const DocumentWithVersion = S.Struct({
  document: Document,
  latestVersion: S.optional(DocumentVersion),
});

export type DocumentWithVersion = S.Schema.Type<typeof DocumentWithVersion>;
