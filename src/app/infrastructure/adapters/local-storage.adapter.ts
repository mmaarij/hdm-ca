/**
 * Local Storage Adapter
 *
 * Infrastructure implementation of StoragePort using local filesystem.
 */

import { Effect, Layer } from "effect";
import * as fs from "fs/promises";
import * as path from "path";
import type {
  StoragePort,
  PresignedUploadUrl,
  FileMetadata,
} from "../../application/ports/storage.port";
import { StoragePortTag } from "../../application/ports/storage.port";

const STORAGE_ROOT = process.env.STORAGE_ROOT || "./data/uploads";
const PRESIGNED_URL_EXPIRY = 3600; // 1 hour in seconds

/**
 * Local filesystem-based storage implementation
 */
const makeLocalStorage = (storageRoot: string): StoragePort => ({
  generatePresignedUploadUrl: (
    filename: string,
    mimeType: string
  ): Effect.Effect<PresignedUploadUrl, Error> => {
    const contentRef = `${Date.now()}-${filename}`;
    const expiresAt = new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000);

    return Effect.succeed({
      // For local storage, this is just a placeholder path
      // In real implementation, you might use a temporary upload endpoint
      url: `/api/upload/${contentRef}`,
      contentRef,
      expiresAt,
    });
  },

  moveToStorage: (
    tempPath: string,
    filename: string
  ): Effect.Effect<string, Error> =>
    Effect.gen(function* () {
      // For local storage, we use a simple date-based directory structure
      const dateDir = new Date().toISOString().split("T")[0];
      const targetDir = path.join(storageRoot, dateDir);

      yield* Effect.tryPromise({
        try: () => fs.mkdir(targetDir, { recursive: true }),
        catch: (error) =>
          new Error(`Failed to create storage directory: ${error}`),
      });

      // Move file to storage
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
    path: string,
    expiresIn: number
  ): Effect.Effect<string, Error> =>
    // For local storage, we just return the path
    // In production, this would generate a signed URL
    Effect.succeed(`/api/download/${encodeURIComponent(path)}`),

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
  makeLocalStorage(STORAGE_ROOT)
);
