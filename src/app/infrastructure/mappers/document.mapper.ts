import { Option } from "effect";
import {
  Document,
  DocumentVersion,
  DocumentWithVersion,
  toDocumentWithVersion,
} from "../../domain/document/entity";
import {
  DocumentId,
  DocumentVersionId,
  UserId,
} from "../../domain/refined/uuid";
import {
  Filename,
  FilePath,
  MimeType,
  FileSize,
  VersionNumber,
  ContentRef,
  Checksum,
} from "../../domain/document/value-object";

/**
 * Database row type for Document (from Drizzle)
 */
export interface DocumentRow {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string | null;
  uploadedBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Database row type for DocumentVersion (from Drizzle)
 */
export interface DocumentVersionRow {
  id: string;
  documentId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string | null;
  contentRef: string | null;
  checksum: string | null;
  versionNumber: number;
  uploadedBy: string;
  createdAt: Date | string;
}

/**
 * Document with versions from database join
 */
export interface DocumentWithVersionsRow {
  document: DocumentRow;
  versions: DocumentVersionRow[];
}

/**
 * Document Mapper - Infrastructure ↔ Domain
 */
export const DocumentMapper = {
  /**
   * Database → Domain (Document only, no versions)
   */
  toDomain: (row: DocumentRow): Document => ({
    id: row.id as DocumentId,
    filename: row.filename as Filename,
    originalName: row.originalName as Filename,
    mimeType: row.mimeType as MimeType,
    size: row.size as FileSize,
    path: row.path ? Option.some(row.path as FilePath) : Option.none(),
    uploadedBy: row.uploadedBy as UserId,
    createdAt:
      typeof row.createdAt === "string"
        ? new Date(row.createdAt)
        : row.createdAt,
    updatedAt:
      typeof row.updatedAt === "string"
        ? new Date(row.updatedAt)
        : row.updatedAt,
    versions: [], // Empty by default, populate separately
  }),

  /**
   * Database → Domain (Document with versions)
   */
  toDomainWithVersions: (
    row: DocumentRow,
    versionRows: DocumentVersionRow[]
  ): Document => {
    const document = DocumentMapper.toDomain(row);
    const versions = versionRows.map(DocumentVersionMapper.toDomain);

    return {
      ...document,
      versions,
    };
  },

  /**
   * Domain → Database Create Input
   */
  toDbCreate: (document: Document) => ({
    id: document.id,
    filename: document.filename,
    originalName: document.originalName,
    mimeType: document.mimeType,
    size: document.size,
    path: Option.getOrNull(document.path),
    uploadedBy: document.uploadedBy,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  }),

  /**
   * Domain → Database Update Input
   */
  toDbUpdate: (document: Document) => ({
    filename: document.filename,
    originalName: document.originalName,
    path: Option.getOrNull(document.path),
    updatedAt: new Date().toISOString(),
  }),

  /**
   * Convert array of rows to domain entities
   */
  toDomainMany: (rows: DocumentRow[]): Document[] =>
    rows.map(DocumentMapper.toDomain),
};

/**
 * DocumentVersion Mapper - Infrastructure ↔ Domain
 */
export const DocumentVersionMapper = {
  /**
   * Database → Domain
   */
  toDomain: (row: DocumentVersionRow): DocumentVersion => ({
    id: row.id as DocumentVersionId,
    documentId: row.documentId as DocumentId,
    filename: row.filename as Filename,
    originalName: row.originalName as Filename,
    mimeType: row.mimeType as MimeType,
    size: row.size as FileSize,
    path: row.path ? Option.some(row.path as FilePath) : Option.none(),
    contentRef: row.contentRef
      ? Option.some(row.contentRef as ContentRef)
      : Option.none(),
    checksum: row.checksum
      ? Option.some(row.checksum as Checksum)
      : Option.none(),
    versionNumber: row.versionNumber as VersionNumber,
    uploadedBy: row.uploadedBy as UserId,
    createdAt:
      typeof row.createdAt === "string"
        ? new Date(row.createdAt)
        : row.createdAt,
  }),

  /**
   * Domain → Database Create Input
   */
  toDbCreate: (version: DocumentVersion) => ({
    id: version.id,
    documentId: version.documentId,
    filename: version.filename,
    originalName: version.originalName,
    mimeType: version.mimeType,
    size: version.size,
    path: Option.getOrNull(version.path),
    contentRef: Option.getOrNull(version.contentRef),
    checksum: Option.getOrNull(version.checksum),
    versionNumber: version.versionNumber,
    uploadedBy: version.uploadedBy,
    createdAt: version.createdAt.toISOString(),
  }),

  /**
   * Domain → Database Update Input
   */
  toDbUpdate: (version: DocumentVersion) => ({
    path: Option.getOrNull(version.path),
    contentRef: Option.getOrNull(version.contentRef),
    checksum: Option.getOrNull(version.checksum),
  }),

  /**
   * Convert array of rows to domain entities
   */
  toDomainMany: (rows: DocumentVersionRow[]): DocumentVersion[] =>
    rows.map(DocumentVersionMapper.toDomain),
};

/**
 * DocumentWithVersion Mapper
 */
export const DocumentWithVersionMapper = {
  /**
   * Database → Domain
   */
  toDomain: (
    docRow: DocumentRow,
    latestVersionRow: DocumentVersionRow | null
  ): DocumentWithVersion => {
    const document = DocumentMapper.toDomain(docRow);
    const latestVersion = latestVersionRow
      ? DocumentVersionMapper.toDomain(latestVersionRow)
      : null;

    return {
      document,
      latestVersion: latestVersion ? Option.some(latestVersion) : Option.none(),
    };
  },

  /**
   * Convert array to domain entities
   */
  toDomainMany: (
    rows: Array<{
      document: DocumentRow;
      latestVersion: DocumentVersionRow | null;
    }>
  ): DocumentWithVersion[] =>
    rows.map((row) =>
      DocumentWithVersionMapper.toDomain(row.document, row.latestVersion)
    ),
};
