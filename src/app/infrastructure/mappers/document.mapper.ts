import { Option } from "effect";
import {
  DocumentEntity,
  DocumentVersionEntity,
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
import { normalizeMaybe } from "../../domain/shared/base-entity";

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
  toDomain: (row: DocumentRow): DocumentEntity =>
    new DocumentEntity(
      row.id as DocumentId,
      row.filename as Filename,
      row.originalName as Filename,
      row.mimeType as MimeType,
      row.size as FileSize,
      normalizeMaybe(row.path as FilePath | null),
      row.uploadedBy as UserId,
      typeof row.createdAt === "string"
        ? new Date(row.createdAt)
        : row.createdAt,
      typeof row.updatedAt === "string"
        ? new Date(row.updatedAt)
        : row.updatedAt,
      [] // Empty by default, populate separately
    ),

  /**
   * Database → Domain (Document with versions)
   */
  toDomainWithVersions: (
    row: DocumentRow,
    versionRows: DocumentVersionRow[]
  ): DocumentEntity => {
    const versions = versionRows.map(DocumentVersionMapper.toDomain);

    return new DocumentEntity(
      row.id as DocumentId,
      row.filename as Filename,
      row.originalName as Filename,
      row.mimeType as MimeType,
      row.size as FileSize,
      normalizeMaybe(row.path as FilePath | null),
      row.uploadedBy as UserId,
      typeof row.createdAt === "string"
        ? new Date(row.createdAt)
        : row.createdAt,
      typeof row.updatedAt === "string"
        ? new Date(row.updatedAt)
        : row.updatedAt,
      versions
    );
  },

  /**
   * Domain → Database Create Input
   */
  toDbCreate: (document: DocumentEntity) => ({
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
  toDbUpdate: (document: DocumentEntity) => ({
    filename: document.filename,
    originalName: document.originalName,
    path: Option.getOrNull(document.path),
    updatedAt: new Date().toISOString(),
  }),

  /**
   * Convert array of rows to domain entities
   */
  toDomainMany: (rows: DocumentRow[]): DocumentEntity[] =>
    rows.map(DocumentMapper.toDomain),
};

/**
 * DocumentVersion Mapper - Infrastructure ↔ Domain
 */
export const DocumentVersionMapper = {
  /**
   * Database → Domain
   */
  toDomain: (row: DocumentVersionRow): DocumentVersionEntity =>
    new DocumentVersionEntity(
      row.id as DocumentVersionId,
      row.documentId as DocumentId,
      row.filename as Filename,
      row.originalName as Filename,
      row.mimeType as MimeType,
      row.size as FileSize,
      normalizeMaybe(row.path as FilePath | null),
      normalizeMaybe(row.contentRef as ContentRef | null),
      normalizeMaybe(row.checksum as Checksum | null),
      row.versionNumber as VersionNumber,
      row.uploadedBy as UserId,
      typeof row.createdAt === "string"
        ? new Date(row.createdAt)
        : row.createdAt
    ),

  /**
   * Domain → Database Create Input
   */
  toDbCreate: (version: DocumentVersionEntity) => ({
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
  toDbUpdate: (version: DocumentVersionEntity) => ({
    path: Option.getOrNull(version.path),
    contentRef: Option.getOrNull(version.contentRef),
    checksum: Option.getOrNull(version.checksum),
  }),

  /**
   * Convert array of rows to domain entities
   */
  toDomainMany: (rows: DocumentVersionRow[]): DocumentVersionEntity[] =>
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
