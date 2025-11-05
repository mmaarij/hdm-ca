/**
 * Local Storage Adapter
 *
 * Infrastructure implementation of StoragePort using local filesystem.
 * Organizes files in structure: uploads/{docId}/{versionId}/{filename}
 */

import { Effect, Layer } from "effect";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import type {
  StoragePort,
  FileMetadata,
  UploadedFile,
  StoredFileInfo,
} from "../../application/ports/storage.port";
import { StoragePortTag } from "../../application/ports/storage.port";

const STORAGE_ROOT = process.env.STORAGE_ROOT || "./data/uploads";
const TEMP_ROOT = process.env.TEMP_ROOT || "./data/temp";

/**
 * Get file MIME type from extension
 */
const getMimeTypeFromFilename = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".zip": "application/zip",
    ".json": "application/json",
    ".xml": "application/xml",
  };
  return mimeTypes[ext] || "application/octet-stream";
};

/**
 * Local filesystem-based storage implementation
 */
const makeLocalStorage = (
  storageRoot: string,
  tempRoot: string
): StoragePort => ({
  storeUploadedFile: (
    file: UploadedFile,
    documentId: string,
    versionId: string
  ): Effect.Effect<StoredFileInfo, Error> =>
    Effect.gen(function* () {
      // Extract metadata from uploaded file
      const originalName = file.name || "untitled";
      const filename = originalName;
      const mimeType = file.type || getMimeTypeFromFilename(originalName);
      const size = file.size;

      // Create temp directory
      yield* Effect.tryPromise({
        try: () => fs.mkdir(tempRoot, { recursive: true }),
        catch: (error) =>
          new Error(`Failed to create temp directory: ${error}`),
      });

      // Save to temp file
      const tempPath = path.join(
        tempRoot,
        `${crypto.randomUUID()}-${filename}`
      );
      const arrayBuffer = yield* Effect.tryPromise({
        try: () => file.arrayBuffer(),
        catch: (error) => new Error(`Failed to read file data: ${error}`),
      });

      const buffer = Buffer.from(arrayBuffer);
      yield* Effect.tryPromise({
        try: () => fs.writeFile(tempPath, buffer),
        catch: (error) => new Error(`Failed to write temp file: ${error}`),
      });

      // Move to permanent storage
      const targetDir = path.join(storageRoot, documentId, versionId);
      yield* Effect.tryPromise({
        try: () => fs.mkdir(targetDir, { recursive: true }),
        catch: (error) =>
          new Error(`Failed to create storage directory: ${error}`),
      });

      const storagePath = path.join(targetDir, filename);
      yield* Effect.tryPromise({
        try: () => fs.rename(tempPath, storagePath),
        catch: (error) => new Error(`Failed to move file to storage: ${error}`),
      });

      // Clean up temp file if it still exists (in case rename failed)
      yield* Effect.tryPromise({
        try: () => fs.unlink(tempPath),
        catch: () => undefined, // Ignore if already moved/deleted
      }).pipe(Effect.catchAll(() => Effect.void));

      return {
        path: storagePath,
        filename,
        originalName,
        mimeType,
        size,
      };
    }),

  storeFile: (
    tempPath: string,
    filename: string,
    documentId: string,
    versionId: string
  ): Effect.Effect<string, Error> =>
    Effect.gen(function* () {
      // Create organized directory structure: uploads/{docId}/{versionId}/
      const targetDir = path.join(storageRoot, documentId, versionId);

      yield* Effect.tryPromise({
        try: () => fs.mkdir(targetDir, { recursive: true }),
        catch: (error) =>
          new Error(`Failed to create storage directory: ${error}`),
      });

      // Move file to permanent storage
      const storagePath = path.join(targetDir, filename);
      yield* Effect.tryPromise({
        try: () => fs.rename(tempPath, storagePath),
        catch: (error) => new Error(`Failed to move file to storage: ${error}`),
      });

      return storagePath;
    }),

  deleteFile: (storagePath: string): Effect.Effect<void, Error> =>
    Effect.tryPromise({
      try: () => fs.unlink(storagePath),
      catch: (error) => new Error(`Failed to delete file: ${error}`),
    }),

  getDownloadUrl: (
    filePath: string,
    expiresIn: number
  ): Effect.Effect<string, Error> =>
    // For local storage, we just return the path
    // In production, this would generate a signed URL
    Effect.succeed(`/api/download/${encodeURIComponent(filePath)}`),

  fileExists: (filePath: string): Effect.Effect<boolean, Error> =>
    Effect.tryPromise({
      try: async () => {
        try {
          await fs.access(filePath);
          return true;
        } catch {
          return false;
        }
      },
      catch: (error) => new Error(`Failed to check file existence: ${error}`),
    }),

  getFileMetadata: (filePath: string): Effect.Effect<FileMetadata, Error> =>
    Effect.tryPromise({
      try: async () => {
        const stats = await fs.stat(filePath);
        return {
          size: stats.size,
          lastModified: stats.mtime,
          contentType: "application/octet-stream", // Would need mime-type detection
          etag: stats.mtimeMs.toString(),
        };
      },
      catch: (error) => new Error(`Failed to get file metadata: ${error}`),
    }),
});

/**
 * Layer providing LocalStorage
 */
export const LocalStorageLive = Layer.sync(StoragePortTag, () =>
  makeLocalStorage(STORAGE_ROOT, TEMP_ROOT)
);
