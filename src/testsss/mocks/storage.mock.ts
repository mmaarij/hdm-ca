/**
 * Mock Storage Port Implementation
 *
 * In-memory storage adapter for testing without filesystem dependencies
 */

import { Effect, Layer } from "effect";
import type {
  StoragePort,
  FileMetadata,
  UploadedFile,
  StoredFileInfo,
} from "../../app/application/ports/storage.port";
import { StoragePortTag } from "../../app/application/ports/storage.port";

/**
 * In-memory file storage
 */
interface MockFile {
  path: string;
  content: Buffer;
  metadata: FileMetadata;
}

/**
 * Mock storage state
 */
class MockStorageState {
  private files: Map<string, MockFile> = new Map();
  private uploadUrls: Map<string, { expiresAt: Date; used: boolean }> =
    new Map();

  addFile(path: string, content: Buffer, metadata: Partial<FileMetadata>) {
    this.files.set(path, {
      path,
      content,
      metadata: {
        size: content.length,
        lastModified: new Date(),
        contentType: "application/octet-stream",
        ...metadata,
      },
    });
  }

  getFile(path: string): MockFile | undefined {
    return this.files.get(path);
  }

  deleteFile(path: string): boolean {
    return this.files.delete(path);
  }

  fileExists(path: string): boolean {
    return this.files.has(path);
  }

  clear() {
    this.files.clear();
    this.uploadUrls.clear();
  }

  getAllFiles(): MockFile[] {
    return Array.from(this.files.values());
  }

  registerUploadUrl(contentRef: string, expiresAt: Date) {
    this.uploadUrls.set(contentRef, { expiresAt, used: false });
  }

  markUploadUrlUsed(contentRef: string) {
    const url = this.uploadUrls.get(contentRef);
    if (url) {
      url.used = true;
    }
  }
}

/**
 * Create a mock storage port with in-memory state
 */
export const createMockStorage = (state?: MockStorageState): StoragePort => {
  const storageState = state || new MockStorageState();

  return {
    storeUploadedFile: (
      file: UploadedFile,
      documentId: string,
      versionId: string
    ): Effect.Effect<StoredFileInfo, Error> => {
      const storagePath = `/storage/${documentId}/${versionId}/${file.name}`;
      const filename = file.name.split("/").pop() || file.name;
      const originalName = file.name;
      const mimeType = file.type || "application/octet-stream";
      const size = file.size;

      // Create mock file in storage
      storageState.addFile(storagePath, Buffer.from("mock-content"), {
        contentType: mimeType,
        size,
        lastModified: new Date(),
      });

      return Effect.succeed({
        path: storagePath,
        filename,
        originalName,
        mimeType,
        size,
      });
    },

    storeFile: (
      tempPath: string,
      filename: string,
      documentId: string,
      versionId: string
    ): Effect.Effect<string, Error> => {
      const storagePath = `/storage/${documentId}/${versionId}/${filename}`;

      // Simulate moving file by creating a new entry
      const tempFile = storageState.getFile(tempPath);
      if (tempFile) {
        storageState.addFile(storagePath, tempFile.content, {
          contentType: tempFile.metadata.contentType,
        });
        storageState.deleteFile(tempPath);
      } else {
        // If temp file doesn't exist, create empty file
        storageState.addFile(storagePath, Buffer.from(""), {
          contentType: "application/octet-stream",
        });
      }

      return Effect.succeed(storagePath);
    },

    deleteFile: (path: string): Effect.Effect<void, Error> => {
      if (!storageState.fileExists(path)) {
        // In tests, be lenient - just succeed if file doesn't exist
        // This simulates idempotent delete operations
        return Effect.succeed(undefined);
      }

      storageState.deleteFile(path);
      return Effect.succeed(undefined);
    },

    getDownloadUrl: (
      path: string,
      expiresIn: number
    ): Effect.Effect<string, Error> => {
      if (!storageState.fileExists(path)) {
        return Effect.fail(new Error(`File not found: ${path}`));
      }

      const downloadUrl = `https://mock-storage.local/download/${encodeURIComponent(
        path
      )}?expires=${Date.now() + expiresIn * 1000}`;

      return Effect.succeed(downloadUrl);
    },

    fileExists: (path: string): Effect.Effect<boolean, Error> => {
      return Effect.succeed(storageState.fileExists(path));
    },

    getFileMetadata: (path: string): Effect.Effect<FileMetadata, Error> => {
      const file = storageState.getFile(path);
      if (!file) {
        return Effect.fail(new Error(`File not found: ${path}`));
      }

      return Effect.succeed(file.metadata);
    },
  };
};

/**
 * Shared mock storage state for tests
 */
export const testStorageState = new MockStorageState();

/**
 * Mock storage layer for dependency injection
 */
export const MockStorageLive = Layer.succeed(
  StoragePortTag,
  createMockStorage(testStorageState)
);

/**
 * Helper to reset mock storage state between tests
 */
export const resetMockStorage = () => {
  testStorageState.clear();
};

/**
 * Helper to seed mock storage with files
 */
export const seedMockStorage = (
  files: Array<{ path: string; content: string | Buffer }>
) => {
  files.forEach(({ path, content }) => {
    const buffer = typeof content === "string" ? Buffer.from(content) : content;
    testStorageState.addFile(path, buffer, {
      contentType: "application/octet-stream",
      size: buffer.length,
      lastModified: new Date(),
    });
  });
};

/**
 * Helper to verify file was stored
 */
export const verifyFileStored = (path: string): boolean => {
  return testStorageState.fileExists(path);
};

/**
 * Helper to get all stored files
 */
export const getAllStoredFiles = (): string[] => {
  return testStorageState.getAllFiles().map((f) => f.path);
};

/**
 * Create a mock UploadedFile for testing
 *
 * @param name - The filename
 * @param size - File size in bytes (default: 1024)
 * @param type - MIME type (default: "application/pdf")
 * @returns A mock UploadedFile object
 */
export const createMockUploadedFile = (
  name: string,
  size: number = 1024,
  type: string = "application/pdf"
): UploadedFile => {
  return {
    name,
    size,
    type,
    arrayBuffer: async () => new ArrayBuffer(size),
  };
};
