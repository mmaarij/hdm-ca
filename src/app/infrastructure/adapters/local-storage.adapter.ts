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
import { DocumentStorageError } from "../../domain/document/errors";

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
  ): Effect.Effect<StoredFileInfo, DocumentStorageError> =>
    Effect.gen(function* () {
      // Extract metadata from uploaded file
      const originalName = file.name || "untitled";
      const filename = originalName;
      const mimeType = file.type || getMimeTypeFromFilename(originalName);
      const size = file.size;

      // Create temp directory
      yield* Effect.tryPromise({
        try: () => fs.mkdir(tempRoot, { recursive: true }),
        catch: () =>
          new DocumentStorageError({
            message: "Failed to create temporary directory for file upload",
          }),
      });

      // Save to temp file
      const tempPath = path.join(
        tempRoot,
        `${crypto.randomUUID()}-${filename}`
      );
      const arrayBuffer = yield* Effect.tryPromise({
        try: () => file.arrayBuffer(),
        catch: () =>
          new DocumentStorageError({
            message: "Failed to read uploaded file data",
          }),
      });

      const buffer = Buffer.from(arrayBuffer);

      // Compute SHA-256 checksum
      const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

      yield* Effect.tryPromise({
        try: () => fs.writeFile(tempPath, buffer),
        catch: () =>
          new DocumentStorageError({
            message: "Failed to write file to temporary storage",
          }),
      });

      // Move to permanent storage
      const targetDir = path.join(storageRoot, documentId, versionId);
      yield* Effect.tryPromise({
        try: () => fs.mkdir(targetDir, { recursive: true }),
        catch: () =>
          new DocumentStorageError({
            message: "Failed to create storage directory",
          }),
      });

      const storagePath = path.join(targetDir, filename);
      yield* Effect.tryPromise({
        try: () => fs.rename(tempPath, storagePath),
        catch: () =>
          new DocumentStorageError({
            message: "Failed to move file to permanent storage",
          }),
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
        checksum,
      };
    }),

  storeFile: (
    tempPath: string,
    filename: string,
    documentId: string,
    versionId: string
  ): Effect.Effect<string, DocumentStorageError> =>
    Effect.gen(function* () {
      // Create organized directory structure: uploads/{docId}/{versionId}/
      const targetDir = path.join(storageRoot, documentId, versionId);

      yield* Effect.tryPromise({
        try: () => fs.mkdir(targetDir, { recursive: true }),
        catch: () =>
          new DocumentStorageError({
            message: "Failed to create storage directory",
          }),
      });

      // Move file to permanent storage
      const storagePath = path.join(targetDir, filename);
      yield* Effect.tryPromise({
        try: () => fs.rename(tempPath, storagePath),
        catch: () =>
          new DocumentStorageError({
            message: "Failed to move file to permanent storage",
          }),
      });

      return storagePath;
    }),

  deleteFile: (
    storagePath: string
  ): Effect.Effect<void, DocumentStorageError> =>
    Effect.tryPromise({
      try: () => fs.unlink(storagePath),
      catch: () =>
        new DocumentStorageError({
          message: "Failed to delete file from storage",
        }),
    }),

  getDownloadUrl: (
    filePath: string,
    expiresIn: number
  ): Effect.Effect<string, DocumentStorageError> =>
    // For local storage, we just return the path
    // In production, this would generate a signed URL
    Effect.succeed(`/api/download/${encodeURIComponent(filePath)}`),

  fileExists: (
    filePath: string
  ): Effect.Effect<boolean, DocumentStorageError> =>
    Effect.tryPromise({
      try: async () => {
        try {
          await fs.access(filePath);
          return true;
        } catch {
          return false;
        }
      },
      catch: () =>
        new DocumentStorageError({
          message: "Failed to check file existence",
        }),
    }),

  getFileMetadata: (
    filePath: string
  ): Effect.Effect<FileMetadata, DocumentStorageError> =>
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
      catch: () =>
        new DocumentStorageError({
          message: "Failed to retrieve file metadata",
        }),
    }),
});

/**
 * Layer providing LocalStorage
 */
export const LocalStorageLive = Layer.sync(StoragePortTag, () =>
  makeLocalStorage(STORAGE_ROOT, TEMP_ROOT)
);
