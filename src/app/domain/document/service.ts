import { Effect, Option } from "effect";
import { DocumentEntity, DocumentVersionEntity } from "./entity";
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
    existingVersions: readonly DocumentVersionEntity[],
    newChecksum: Checksum
  ) => Effect.Effect<void, DuplicateDocumentError>;

  /**
   * Prepare a new version for a document (business logic for version creation)
   */
  readonly prepareNewVersion: (
    document: DocumentEntity,
    versionProps: {
      filename: Filename;
      originalName: Filename;
      mimeType: MimeType;
      size: FileSize;
      uploadedBy: UserId;
      contentRef?: ContentRef;
      checksum?: Checksum;
    }
  ) => Effect.Effect<DocumentVersionEntity, DuplicateDocumentError>;

  /**
   * Validate that a user can update a document (business rule)
   */
  readonly canUpdate: (
    document: DocumentEntity,
    userId: UserId,
    isAdmin: boolean
  ) => Effect.Effect<void, DocumentUpdateError>;

  /**
   * Calculate the next version number for a document
   */
  readonly getNextVersionNumber: (
    document: DocumentEntity
  ) => Effect.Effect<VersionNumber, never>;

  /**
   * Check if a version with given checksum already exists
   */
  readonly hasVersionWithChecksum: (
    document: DocumentEntity,
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

      // Use the document entity's addVersion method to create the new version
      // This ensures proper version number calculation and immutable updates
      const updatedDocument = document.addVersion(versionProps);

      // Return the latest version
      const latestVersionOpt = updatedDocument.getLatestVersion();
      return yield* Option.match(latestVersionOpt, {
        onNone: () =>
          Effect.fail(
            new DuplicateDocumentError({
              message: "Failed to create new version",
              checksum: versionProps.checksum ?? "",
            })
          ),
        onSome: (version) => Effect.succeed(version),
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
