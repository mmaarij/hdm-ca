/**
 * Document Application → Domain Mappers
 *
 * Maps Application DTOs to Domain entities for document operations.
 */

import { Option, pipe } from "effect";
import type { UploadDocumentCommand } from "../dtos/document/request.dto";
import type {
  DocumentResponse,
  DocumentVersionResponse,
  DocumentWithVersionResponse,
  UploadDocumentResponse,
  PaginatedDocumentsResponse,
  SearchDocumentsResponse,
} from "../dtos/document/response.dto";
import {
  DocumentEntity,
  DocumentVersionEntity,
  type DocumentWithVersion,
} from "../../domain/document/entity";
import type {
  Filename,
  MimeType,
  FileSize,
  FilePath,
} from "../../domain/document/value-object";
import type { UserId } from "../../domain/refined/uuid";
import { DateTimeHelpers } from "../../domain/refined/date-time";

/**
 * Command to Domain Mappers
 */
export const DocumentCommandMapper = {
  /**
   * Map UploadDocumentCommand to Document.create parameters
   */
  toCreateParams: (
    filename: Filename,
    originalName: Filename,
    mimeType: MimeType,
    size: FileSize,
    uploadedBy: UserId,
    path: FilePath
  ): {
    filename: Filename;
    originalName: Filename;
    mimeType: MimeType;
    size: FileSize;
    uploadedBy: UserId;
    path: FilePath;
  } => ({
    filename,
    originalName,
    mimeType,
    size,
    uploadedBy,
    path,
  }),

  /**
   * Map UploadDocumentCommand to DocumentVersion parameters for addVersion
   */
  toVersionParams: (
    filename: Filename,
    originalName: Filename,
    mimeType: MimeType,
    size: FileSize,
    uploadedBy: UserId,
    path: FilePath
  ): {
    filename: Filename;
    originalName: Filename;
    mimeType: MimeType;
    size: FileSize;
    uploadedBy: UserId;
    path: FilePath;
  } => ({
    filename,
    originalName,
    mimeType,
    size,
    uploadedBy,
    path,
  }),
} as const;

/**
 * Domain to Response Mappers
 */
export const DocumentResponseMapper = {
  /**
   * Map DocumentVersion to DocumentVersionResponse DTO
   */
  toVersionResponse: (
    version: DocumentVersionEntity
  ): DocumentVersionResponse => ({
    id: version.id,
    documentId: version.documentId,
    filename: version.filename,
    originalName: version.originalName,
    mimeType: version.mimeType,
    size: version.size,
    versionNumber: version.versionNumber,
    uploadedBy: version.uploadedBy,
    createdAt: DateTimeHelpers.fromDate(version.createdAt),
  }),

  /**
   * Map Document entity to DocumentResponse DTO
   * Uses latest version for file metadata, falls back to document metadata if no versions
   */
  toDocumentResponse: (document: DocumentEntity): DocumentResponse => {
    const latestVersionOpt = document.getLatestVersion();

    return pipe(
      latestVersionOpt,
      Option.match({
        onNone: () => ({
          id: document.id,
          filename: document.filename,
          originalName: document.originalName,
          mimeType: document.mimeType,
          size: document.size,
          uploadedBy: document.uploadedBy,
          createdAt: DateTimeHelpers.fromDate(document.createdAt),
          updatedAt: DateTimeHelpers.fromDate(document.updatedAt),
        }),
        onSome: (latestVersion) => ({
          id: document.id,
          filename: latestVersion.filename,
          originalName: latestVersion.originalName,
          mimeType: latestVersion.mimeType,
          size: latestVersion.size,
          uploadedBy: document.uploadedBy,
          createdAt: DateTimeHelpers.fromDate(document.createdAt),
          updatedAt: DateTimeHelpers.fromDate(document.updatedAt),
        }),
      })
    );
  },

  /**
   * Map Document with latest version to DocumentWithVersionResponse DTO
   * Accepts either a Document (where we'll extract latest version from versions array)
   * or a DocumentWithVersion object (where latestVersion is already provided)
   */
  toDocumentWithVersionResponse: (
    input:
      | DocumentEntity
      | {
          document: DocumentEntity;
          latestVersion: Option.Option<DocumentVersionEntity>;
        }
  ): DocumentWithVersionResponse => {
    // Check if input is DocumentWithVersion or plain Document
    const isDocumentWithVersion =
      "document" in input && "latestVersion" in input;

    if (isDocumentWithVersion) {
      // Use the provided latestVersion
      const { document, latestVersion } = input;
      return {
        document: DocumentResponseMapper.toDocumentResponse(document),
        latestVersion: pipe(
          latestVersion,
          Option.map(DocumentResponseMapper.toVersionResponse),
          Option.getOrUndefined
        ),
      };
    } else {
      // Extract from document's versions array
      const document = input as DocumentEntity;
      const latestVersion = pipe(
        document.getLatestVersion(),
        Option.map(DocumentResponseMapper.toVersionResponse)
      );

      return {
        document: DocumentResponseMapper.toDocumentResponse(document),
        latestVersion: Option.isSome(latestVersion)
          ? latestVersion.value
          : undefined,
      };
    }
  },

  /**
   * Map Document and version to UploadDocumentResponse DTO
   */
  toUploadDocumentResponse: (
    document: DocumentEntity,
    version: DocumentVersionEntity
  ): UploadDocumentResponse => ({
    documentId: document.id,
    versionId: version.id,
    document: DocumentResponseMapper.toDocumentResponse(document),
    version: DocumentResponseMapper.toVersionResponse(version),
  }),

  /**
   * Map paginated documents to PaginatedDocumentsResponse DTO
   * Accepts either DocumentEntity[] or DocumentWithVersion[]
   */
  toPaginatedDocumentsResponse: (
    documents: readonly (DocumentEntity | DocumentWithVersion)[],
    total: number,
    page: number,
    limit: number
  ): PaginatedDocumentsResponse => {
    const totalPages = Math.ceil(total / limit);
    return {
      data: documents.map((doc) =>
        "document" in doc
          ? DocumentResponseMapper.toDocumentWithVersionResponse(doc)
          : DocumentResponseMapper.toDocumentWithVersionResponse(doc)
      ),
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  },

  /**
   * Map search results to SearchDocumentsResponse DTO
   */
  toSearchDocumentsResponse: (
    documents: readonly DocumentEntity[],
    total: number,
    page: number,
    limit: number
  ): SearchDocumentsResponse => {
    const totalPages = Math.ceil(total / limit);
    return {
      data: documents.map(DocumentResponseMapper.toDocumentResponse),
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  },
} as const;
