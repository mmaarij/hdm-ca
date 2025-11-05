/**
 * Storage Port
 *
 * Abstract interface for file storage operations.
 * Implemented by infrastructure adapters (S3, local filesystem, etc.)
 */

import { Effect, Context } from "effect";

/**
 * Pre-signed upload URL result
 */
export interface PresignedUploadUrl {
  readonly url: string;
  readonly contentRef: string;
  readonly expiresAt: Date;
}

/**
 * Storage Port Interface
 *
 * Defines the contract for file storage operations.
 * Infrastructure layer provides concrete implementations.
 */
export interface StoragePort {
  /**
   * Generate a pre-signed URL for direct file upload
   *
   * @param filename - Name of the file to upload
   * @param mimeType - MIME type of the file
   * @param documentId - Document ID for organizing storage
   * @param versionId - Version ID for organizing storage
   * @returns Pre-signed URL with expiration and content reference
   */
  readonly generatePresignedUploadUrl: (
    filename: string,
    mimeType: string,
    documentId: string,
    versionId: string
  ) => Effect.Effect<PresignedUploadUrl, Error>;

  /**
   * Move file from temporary location to permanent storage
   *
   * @param tempPath - Temporary file path
   * @param filename - Destination filename
   * @returns Final storage path
   */
  readonly moveToStorage: (
    tempPath: string,
    filename: string
  ) => Effect.Effect<string, Error>;

  /**
   * Delete a file from storage
   *
   * @param path - File path to delete
   */
  readonly deleteFile: (path: string) => Effect.Effect<void, Error>;

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
  ) => Effect.Effect<string, Error>;

  /**
   * Check if a file exists in storage
   *
   * @param path - File path to check
   * @returns True if file exists
   */
  readonly fileExists: (path: string) => Effect.Effect<boolean, Error>;

  /**
   * Get file metadata (size, last modified, etc.)
   *
   * @param path - File path
   * @returns File metadata
   */
  readonly getFileMetadata: (
    path: string
  ) => Effect.Effect<FileMetadata, Error>;
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
