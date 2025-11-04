/**
 * Document Version Response DTOs
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

/**
 * Version Response
 */
export const VersionResponse = S.Struct({
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

export type VersionResponse = S.Schema.Type<typeof VersionResponse>;

/**
 * Upload New Version Response
 */
export const UploadNewVersionResponse = S.Struct({
  version: VersionResponse,
  message: S.String,
});

export type UploadNewVersionResponse = S.Schema.Type<
  typeof UploadNewVersionResponse
>;

/**
 * List Versions Response
 */
export const ListVersionsResponse = S.Struct({
  versions: S.Array(VersionResponse),
  total: S.Number,
  documentId: DocumentId,
});

export type ListVersionsResponse = S.Schema.Type<typeof ListVersionsResponse>;
