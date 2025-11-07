import { Schema as S, Option } from "effect";
import { DocumentId, DocumentVersionId, UserId } from "../refined/uuid";
import { DateTime } from "../refined/date-time";
import {
  Filename,
  FilePath,
  MimeType,
  FileSize,
  VersionNumber,
  ContentRef,
  Checksum,
} from "./value-object";
import { v4 as uuidv4 } from "uuid";

/**
 * Document Entity - Pure Domain Model
 *
 * Represents a document aggregate root in the system.
 * Manages versions internally as part of the aggregate.
 */
export interface Document {
  readonly id: DocumentId;
  readonly filename: Filename;
  readonly originalName: Filename;
  readonly mimeType: MimeType;
  readonly size: FileSize;
  readonly path: Option.Option<FilePath>;
  readonly uploadedBy: UserId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly versions: readonly DocumentVersion[];
}

/**
 * Document Version Entity - Part of Document Aggregate
 *
 * Represents a specific version of a document with its file content.
 */
export interface DocumentVersion {
  readonly id: DocumentVersionId;
  readonly documentId: DocumentId;
  readonly filename: Filename;
  readonly originalName: Filename;
  readonly mimeType: MimeType;
  readonly size: FileSize;
  readonly path: Option.Option<FilePath>;
  readonly contentRef: Option.Option<ContentRef>;
  readonly checksum: Option.Option<Checksum>;
  readonly versionNumber: VersionNumber;
  readonly uploadedBy: UserId;
  readonly createdAt: Date;
}

/**
 * Factory functions for DocumentVersion
 */
export const DocumentVersion = {
  /**
   * Create a new document version
   */
  create: (props: {
    documentId: DocumentId;
    filename: Filename;
    originalName: Filename;
    mimeType: MimeType;
    size: FileSize;
    versionNumber: VersionNumber;
    uploadedBy: UserId;
    path?: FilePath;
    contentRef?: ContentRef;
    checksum?: Checksum;
  }): DocumentVersion => ({
    id: uuidv4() as DocumentVersionId,
    documentId: props.documentId,
    filename: props.filename,
    originalName: props.originalName,
    mimeType: props.mimeType,
    size: props.size,
    path: props.path ? Option.some(props.path) : Option.none(),
    contentRef: props.contentRef
      ? Option.some(props.contentRef)
      : Option.none(),
    checksum: props.checksum ? Option.some(props.checksum) : Option.none(),
    versionNumber: props.versionNumber,
    uploadedBy: props.uploadedBy,
    createdAt: new Date(),
  }),

  /**
   * Update version with path and content ref after upload
   */
  updateAfterUpload: (
    version: DocumentVersion,
    updates: {
      path: FilePath;
      contentRef: ContentRef;
      checksum: Checksum;
    }
  ): DocumentVersion => ({
    ...version,
    path: Option.some(updates.path),
    contentRef: Option.some(updates.contentRef),
    checksum: Option.some(updates.checksum),
  }),
};

/**
 * Factory functions for Document Aggregate
 */
export const Document = {
  /**
   * Create a new document with its first version
   */
  create: (props: {
    filename: Filename;
    originalName: Filename;
    mimeType: MimeType;
    size: FileSize;
    uploadedBy: UserId;
    path?: FilePath;
  }): Document => {
    const id = uuidv4() as DocumentId;
    const now = new Date();

    return {
      id,
      filename: props.filename,
      originalName: props.originalName,
      mimeType: props.mimeType,
      size: props.size,
      path: props.path ? Option.some(props.path) : Option.none(),
      uploadedBy: props.uploadedBy,
      createdAt: now,
      updatedAt: now,
      versions: [],
    };
  },

  /**
   * Add a new version to the document
   */
  addVersion: (
    document: Document,
    versionProps: {
      filename: Filename;
      originalName: Filename;
      mimeType: MimeType;
      size: FileSize;
      uploadedBy: UserId;
      path?: FilePath;
      contentRef?: ContentRef;
      checksum?: Checksum;
    }
  ): Document => {
    const nextVersionNumber = (document.versions.length + 1) as VersionNumber;

    const newVersion = DocumentVersion.create({
      documentId: document.id,
      filename: versionProps.filename,
      originalName: versionProps.originalName,
      mimeType: versionProps.mimeType,
      size: versionProps.size,
      versionNumber: nextVersionNumber,
      uploadedBy: versionProps.uploadedBy,
      path: versionProps.path,
      contentRef: versionProps.contentRef,
      checksum: versionProps.checksum,
    });

    return {
      ...document,
      versions: [...document.versions, newVersion],
      updatedAt: new Date(),
    };
  },

  /**
   * Update document metadata
   */
  update: (
    document: Document,
    updates: {
      filename?: Filename;
      originalName?: Filename;
      path?: FilePath;
    }
  ): Document => ({
    ...document,
    filename: updates.filename ?? document.filename,
    originalName: updates.originalName ?? document.originalName,
    path: updates.path ? Option.some(updates.path) : document.path,
    updatedAt: new Date(),
  }),

  /**
   * Get latest version of the document
   */
  getLatestVersion: (document: Document): Option.Option<DocumentVersion> =>
    document.versions.length > 0
      ? Option.some(document.versions[document.versions.length - 1])
      : Option.none(),

  /**
   * Get version by version number
   */
  getVersion: (
    document: Document,
    versionNumber: VersionNumber
  ): Option.Option<DocumentVersion> =>
    Option.fromNullable(
      document.versions.find((v) => v.versionNumber === versionNumber)
    ),

  /**
   * Get all versions
   */
  getAllVersions: (document: Document): readonly DocumentVersion[] =>
    document.versions,

  /**
   * Check if document has a specific version
   */
  hasVersion: (document: Document, versionNumber: VersionNumber): boolean =>
    document.versions.some((v) => v.versionNumber === versionNumber),
};

/**
 * Document with its latest version (for listing/display purposes)
 */
export interface DocumentWithVersion {
  readonly document: Document;
  readonly latestVersion: Option.Option<DocumentVersion>;
}

/**
 * Helper to create DocumentWithVersion from Document
 */
export const toDocumentWithVersion = (
  document: Document
): DocumentWithVersion => ({
  document,
  latestVersion: Document.getLatestVersion(document),
});

// ============================================================================
// Schema Definitions for Validation (kept for backward compatibility)
// ============================================================================

/**
 * Document Schema for validation
 */
export const DocumentSchema = S.Struct({
  id: DocumentId,
  filename: Filename,
  originalName: Filename,
  mimeType: MimeType,
  size: FileSize,
  path: S.optional(FilePath),
  uploadedBy: UserId,
  createdAt: S.optional(DateTime),
  updatedAt: S.optional(DateTime),
});

/**
 * Document Version Schema for validation
 */
export const DocumentVersionSchema = S.Struct({
  id: DocumentVersionId,
  documentId: DocumentId,
  filename: Filename,
  originalName: Filename,
  mimeType: MimeType,
  size: FileSize,
  path: S.optional(FilePath),
  contentRef: S.optional(ContentRef),
  checksum: S.optional(Checksum),
  versionNumber: VersionNumber,
  uploadedBy: UserId,
  createdAt: S.optional(DateTime),
});
