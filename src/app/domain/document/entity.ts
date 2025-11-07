import { Schema as S, Option, Effect as E, pipe } from "effect";
import { DocumentId, DocumentVersionId, UserId } from "../refined/uuid";
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
import {
  BaseEntity,
  IEntity,
  Maybe,
  normalizeMaybe,
  optionToMaybe,
} from "../shared/base-entity";
import { DocumentValidationError } from "./errors";
import * as DocumentGuards from "./guards";
import { DocumentSchema, DocumentVersionSchema } from "./schema";

// ============================================================================
// Document Version Entity
// ============================================================================

/**
 * Serialized DocumentVersion type (for external systems)
 */
export type SerializedDocumentVersion = {
  readonly id: string;
  readonly documentId: string;
  readonly filename: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly size: number;
  readonly path?: Maybe<string>;
  readonly contentRef?: Maybe<string>;
  readonly checksum?: Maybe<string>;
  readonly versionNumber: number;
  readonly uploadedBy: string;
  readonly createdAt?: Date;
};

/**
 * Document Version Entity - Part of Document Aggregate
 *
 * Represents a specific version of a document with its file content.
 */
export class DocumentVersionEntity extends BaseEntity implements IEntity {
  constructor(
    public readonly id: DocumentVersionId,
    public readonly documentId: DocumentId,
    public readonly filename: Filename,
    public readonly originalName: Filename,
    public readonly mimeType: MimeType,
    public readonly size: FileSize,
    public readonly path: Option.Option<FilePath>,
    public readonly contentRef: Option.Option<ContentRef>,
    public readonly checksum: Option.Option<Checksum>,
    public readonly versionNumber: VersionNumber,
    public readonly uploadedBy: UserId,
    public readonly createdAt: Date
  ) {
    super();
  }

  /**
   * Create a new document version with validation
   */
  static create(
    input: SerializedDocumentVersion
  ): E.Effect<DocumentVersionEntity, DocumentValidationError, never> {
    return pipe(
      S.decodeUnknown(DocumentVersionSchema)(input),
      E.flatMap((data) => {
        // Domain validation
        return pipe(
          E.all([
            DocumentGuards.guardFileSize(data.size),
            DocumentGuards.guardMimeType(data.mimeType),
            DocumentGuards.guardSafeFilename(data.filename),
          ]),
          E.flatMap(() =>
            E.succeed(
              new DocumentVersionEntity(
                data.id,
                data.documentId,
                data.filename,
                data.originalName,
                data.mimeType,
                data.size,
                normalizeMaybe(data.path),
                normalizeMaybe(data.contentRef),
                normalizeMaybe(data.checksum),
                data.versionNumber,
                data.uploadedBy,
                data.createdAt ?? new Date()
              )
            )
          )
        );
      }),
      E.mapError(
        (error) =>
          new DocumentValidationError({
            message: `Document version validation failed: ${error}`,
            field: "version",
          })
      )
    );
  }

  /**
   * Update version with path and content ref after upload
   */
  updateAfterUpload(updates: {
    path: FilePath;
    contentRef: ContentRef;
    checksum: Checksum;
  }): DocumentVersionEntity {
    return new DocumentVersionEntity(
      this.id,
      this.documentId,
      this.filename,
      this.originalName,
      this.mimeType,
      this.size,
      Option.some(updates.path),
      Option.some(updates.contentRef),
      Option.some(updates.checksum),
      this.versionNumber,
      this.uploadedBy,
      this.createdAt
    );
  }

  /**
   * Serialize to external format
   */
  serialize(): SerializedDocumentVersion {
    return {
      id: this.id,
      documentId: this.documentId,
      filename: this.filename,
      originalName: this.originalName,
      mimeType: this.mimeType,
      size: this.size,
      path: optionToMaybe(this.path),
      contentRef: optionToMaybe(this.contentRef),
      checksum: optionToMaybe(this.checksum),
      versionNumber: this.versionNumber,
      uploadedBy: this.uploadedBy,
      createdAt: this.createdAt,
    };
  }
}

// ============================================================================
// Document Entity
// ============================================================================

/**
 * Serialized Document type (for external systems)
 */
export type SerializedDocument = {
  readonly id: string;
  readonly filename: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly size: number;
  readonly path?: Maybe<string>;
  readonly uploadedBy: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
  readonly versions?: SerializedDocumentVersion[];
};

/**
 * Document Entity - Aggregate Root
 *
 * Represents a document aggregate root in the system.
 * Manages versions internally as part of the aggregate.
 */
export class DocumentEntity extends BaseEntity implements IEntity {
  constructor(
    public readonly id: DocumentId,
    public readonly filename: Filename,
    public readonly originalName: Filename,
    public readonly mimeType: MimeType,
    public readonly size: FileSize,
    public readonly path: Option.Option<FilePath>,
    public readonly uploadedBy: UserId,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly versions: readonly DocumentVersionEntity[]
  ) {
    super();
  }

  /**
   * Create a new document with validation
   */
  static create(
    input: SerializedDocument
  ): E.Effect<DocumentEntity, DocumentValidationError, never> {
    return pipe(
      S.decodeUnknown(DocumentSchema)(input),
      E.flatMap((data) => {
        // Domain validation
        return pipe(
          E.all([
            DocumentGuards.guardFileSize(data.size),
            DocumentGuards.guardMimeType(data.mimeType),
            DocumentGuards.guardSafeFilename(data.filename),
          ]),
          E.flatMap(() =>
            E.succeed(
              new DocumentEntity(
                data.id,
                data.filename,
                data.originalName,
                data.mimeType,
                data.size,
                normalizeMaybe(data.path),
                data.uploadedBy,
                data.createdAt ?? new Date(),
                data.updatedAt ?? new Date(),
                [] // versions will be loaded separately or added via addVersion
              )
            )
          )
        );
      }),
      E.mapError(
        (error) =>
          new DocumentValidationError({
            message: `Document validation failed: ${error}`,
          })
      )
    );
  }

  /**
   * Add a new version to the document
   */
  addVersion(versionProps: {
    filename: Filename;
    originalName: Filename;
    mimeType: MimeType;
    size: FileSize;
    uploadedBy: UserId;
    path?: FilePath;
    contentRef?: ContentRef;
    checksum?: Checksum;
  }): DocumentEntity {
    const nextVersionNumber = (this.versions.length + 1) as VersionNumber;

    const newVersion = new DocumentVersionEntity(
      uuidv4() as DocumentVersionId,
      this.id,
      versionProps.filename,
      versionProps.originalName,
      versionProps.mimeType,
      versionProps.size,
      normalizeMaybe(versionProps.path),
      normalizeMaybe(versionProps.contentRef),
      normalizeMaybe(versionProps.checksum),
      nextVersionNumber,
      versionProps.uploadedBy,
      new Date()
    );

    return new DocumentEntity(
      this.id,
      this.filename,
      this.originalName,
      this.mimeType,
      this.size,
      this.path,
      this.uploadedBy,
      this.createdAt,
      new Date(),
      [...this.versions, newVersion]
    );
  }

  /**
   * Update document metadata
   */
  update(updates: {
    filename?: Filename;
    originalName?: Filename;
    path?: FilePath;
  }): DocumentEntity {
    return new DocumentEntity(
      this.id,
      updates.filename ?? this.filename,
      updates.originalName ?? this.originalName,
      this.mimeType,
      this.size,
      updates.path ? Option.some(updates.path) : this.path,
      this.uploadedBy,
      this.createdAt,
      new Date(),
      this.versions
    );
  }

  /**
   * Get latest version of the document
   */
  getLatestVersion(): Option.Option<DocumentVersionEntity> {
    return this.versions.length > 0
      ? Option.some(this.versions[this.versions.length - 1])
      : Option.none();
  }

  /**
   * Get version by version number
   */
  getVersion(
    versionNumber: VersionNumber
  ): Option.Option<DocumentVersionEntity> {
    return Option.fromNullable(
      this.versions.find((v) => v.versionNumber === versionNumber)
    );
  }

  /**
   * Get all versions
   */
  getAllVersions(): readonly DocumentVersionEntity[] {
    return this.versions;
  }

  /**
   * Check if document has a specific version
   */
  hasVersion(versionNumber: VersionNumber): boolean {
    return this.versions.some((v) => v.versionNumber === versionNumber);
  }

  /**
   * Serialize to external format
   */
  serialize(): SerializedDocument {
    return {
      id: this.id,
      filename: this.filename,
      originalName: this.originalName,
      mimeType: this.mimeType,
      size: this.size,
      path: optionToMaybe(this.path),
      uploadedBy: this.uploadedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      versions: this.versions.map((v) => v.serialize()),
    };
  }
}

// ============================================================================
// Helper Types and Functions
// ============================================================================

/**
 * Document with its latest version (for listing/display purposes)
 */
export interface DocumentWithVersion {
  readonly document: DocumentEntity;
  readonly latestVersion: Option.Option<DocumentVersionEntity>;
}

/**
 * Helper to create DocumentWithVersion from Document
 */
export const toDocumentWithVersion = (
  document: DocumentEntity
): DocumentWithVersion => ({
  document,
  latestVersion: document.getLatestVersion(),
});
