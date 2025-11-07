import { Effect, Option } from "effect";
import { Document, DocumentVersion } from "./entity";
import { DocumentUpdateError, DuplicateDocumentError } from "./errors";
import {
  Checksum,
  ContentRef,
  Filename,
  MimeType,
  FileSize,
  VersionNumber,
} from "./value-object";
import { UserId } from "../refined/uuid";

/**
 * Document Domain Service - Pure Business Logic
 *
 * Pure domain service that works only with entities.
 * No I/O operations, no repository calls.
 * Contains business rules that span across the Document aggregate.
 */
export interface DocumentDomainService {
  /**
   * Validate that new content doesn't create a duplicate version
   */
  readonly validateNoDuplicateContent: (
    existingVersions: readonly DocumentVersion[],
    newChecksum: Checksum
  ) => Effect.Effect<void, DuplicateDocumentError>;

  /**
   * Prepare a new version for a document (business logic for version creation)
   */
  readonly prepareNewVersion: (
    document: Document,
    versionProps: {
      filename: Filename;
      originalName: Filename;
      mimeType: MimeType;
      size: FileSize;
      uploadedBy: UserId;
      contentRef?: ContentRef;
      checksum?: Checksum;
    }
  ) => Effect.Effect<DocumentVersion, DuplicateDocumentError>;

  /**
   * Validate that a user can update a document (business rule)
   */
  readonly canUpdate: (
    document: Document,
    userId: UserId,
    isAdmin: boolean
  ) => Effect.Effect<void, DocumentUpdateError>;

  /**
   * Calculate the next version number for a document
   */
  readonly getNextVersionNumber: (
    document: Document
  ) => Effect.Effect<VersionNumber, never>;

  /**
   * Check if a version with given checksum already exists
   */
  readonly hasVersionWithChecksum: (
    document: Document,
    checksum: Checksum
  ) => Effect.Effect<boolean, never>;
}

/**
 * Live implementation of Document Domain Service
 */
export const DocumentDomainServiceLive: DocumentDomainService = {
  validateNoDuplicateContent: (existingVersions, newChecksum) => {
    const duplicate = existingVersions.find((v) =>
      Option.exists(v.checksum, (cs) => cs === newChecksum)
    );

    return duplicate
      ? Effect.fail(
          new DuplicateDocumentError({
            message: "Document with this content already exists",
            checksum: newChecksum,
          })
        )
      : Effect.void;
  },

  prepareNewVersion: (document, versionProps) =>
    Effect.gen(function* () {
      // Validate no duplicate content if checksum provided
      if (versionProps.checksum) {
        yield* DocumentDomainServiceLive.validateNoDuplicateContent(
          document.versions,
          versionProps.checksum
        );
      }

      // Get next version number
      const versionNumber =
        yield* DocumentDomainServiceLive.getNextVersionNumber(document);

      // Create version entity
      return DocumentVersion.create({
        documentId: document.id,
        filename: versionProps.filename,
        originalName: versionProps.originalName,
        mimeType: versionProps.mimeType,
        size: versionProps.size,
        versionNumber,
        uploadedBy: versionProps.uploadedBy,
        contentRef: versionProps.contentRef,
        checksum: versionProps.checksum,
      });
    }),

  canUpdate: (document, userId, isAdmin) => {
    if (!isAdmin && document.uploadedBy !== userId) {
      return Effect.fail(
        new DocumentUpdateError({
          message: "User does not have permission to update this document",
        })
      );
    }
    return Effect.void;
  },

  getNextVersionNumber: (document) =>
    Effect.succeed((document.versions.length + 1) as VersionNumber),

  hasVersionWithChecksum: (document, checksum) =>
    Effect.succeed(
      document.versions.some((v) =>
        Option.exists(v.checksum, (cs) => cs === checksum)
      )
    ),
};
