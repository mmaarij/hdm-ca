/**
 * Storage Port
 *
 * Abstract interface for file storage operations.
 * Implemented by infrastructure adapters (S3, local filesystem, etc.)
 */

import { Effect, Context } from "effect";
import type { DocumentStorageError } from "../../domain/document/errors";

/**
 * Uploaded file data from HTTP multipart form
 */
export interface UploadedFile {
  readonly name: string;
  readonly size: number;
  readonly type?: string;
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

/**
 * Result of storing an uploaded file
 */
export interface StoredFileInfo {
  readonly path: string;
  readonly filename: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly size: number;
  readonly checksum: string; // SHA-256 hash of file content
}

/**
 * Storage Port Interface
 *
 * Defines the contract for file storage operations.
 * Infrastructure layer provides concrete implementations.
 */
export interface StoragePort {
  /**
   * Store uploaded file with automatic metadata extraction
   * Handles temp file creation, metadata extraction, and cleanup
   *
   * @param file - Uploaded file from HTTP multipart form
   * @param documentId - Document ID for organizing storage
   * @param versionId - Version ID for organizing storage
   * @returns Stored file information (path, metadata)
   */
  readonly storeUploadedFile: (
    file: UploadedFile,
    documentId: string,
    versionId: string
  ) => Effect.Effect<StoredFileInfo, DocumentStorageError>;

  /**
   * Store file in organized structure: uploads/{docId}/{versionId}/{filename}
   * (Lower-level method for when you already have a file on disk)
   *
   * @param tempPath - Temporary file path from upload
   * @param filename - Original filename
   * @param documentId - Document ID for organizing storage
   * @param versionId - Version ID for organizing storage
   * @returns Final storage path
   */
  readonly storeFile: (
    tempPath: string,
    filename: string,
    documentId: string,
    versionId: string
  ) => Effect.Effect<string, DocumentStorageError>;

  /**
   * Delete a file from storage
   *
   * @param path - File path to delete
   */
  readonly deleteFile: (
    path: string
  ) => Effect.Effect<void, DocumentStorageError>;

  /**
   * Get a temporary download URL for a file
   *
   * @param path - File path
   * @param expiresIn - URL validity duration in seconds
   * @returns Temporary download URL
   */
  readonly getDownloadUrl: (
    path: string,
    expiresIn: number
  ) => Effect.Effect<string, DocumentStorageError>;

  /**
   * Check if a file exists in storage
   *
   * @param path - File path to check
   * @returns True if file exists
   */
  readonly fileExists: (
    path: string
  ) => Effect.Effect<boolean, DocumentStorageError>;

  /**
   * Get file metadata (size, last modified, etc.)
   *
   * @param path - File path
   * @returns File metadata
   */
  readonly getFileMetadata: (
    path: string
  ) => Effect.Effect<FileMetadata, DocumentStorageError>;
}

/**
 * File metadata
 */
export interface FileMetadata {
  readonly size: number;
  readonly lastModified: Date;
  readonly contentType: string;
  readonly etag?: string;
}

/**
 * Context tag for dependency injection
 */
export const StoragePortTag =
  Context.GenericTag<StoragePort>("@app/StoragePort");
