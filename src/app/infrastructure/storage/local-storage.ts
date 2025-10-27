import { Effect, Layer } from "effect";
import {
  IStorageProvider,
  StorageService,
  FileToStore,
  StoredFile,
} from "./storage.interface";
import { loadStorageConfig } from "../config/storage.config";
import fs from "fs/promises";
import path from "path";

/**
 * Local filesystem storage implementation
 */
export class LocalStorageProvider implements IStorageProvider {
  constructor(private readonly basePath: string) {}

  store = (
    key: string,
    file: FileToStore
  ): Effect.Effect<StoredFile, Error> => {
    const basePath = this.basePath;
    return Effect.gen(function* () {
      const fullPath = path.join(basePath, key);
      const directory = path.dirname(fullPath);

      // Ensure directory exists
      yield* Effect.tryPromise({
        try: () => fs.mkdir(directory, { recursive: true }),
        catch: (error) => new Error(`Failed to create directory: ${error}`),
      });

      // Write file
      yield* Effect.tryPromise({
        try: () => fs.writeFile(fullPath, file.content),
        catch: (error) => new Error(`Failed to write file: ${error}`),
      });

      return {
        key,
        size: file.content.length,
        mimeType: file.mimeType,
      };
    });
  };

  retrieve = (key: string): Effect.Effect<Buffer, Error> =>
    Effect.tryPromise({
      try: async () => {
        const fullPath = path.join(this.basePath, key);
        return await fs.readFile(fullPath);
      },
      catch: (error) => new Error(`Failed to read file: ${error}`),
    });

  delete = (key: string): Effect.Effect<void, Error> =>
    Effect.tryPromise({
      try: async () => {
        const fullPath = path.join(this.basePath, key);
        await fs.unlink(fullPath);
      },
      catch: (error) => new Error(`Failed to delete file: ${error}`),
    });

  exists = (key: string): Effect.Effect<boolean, Error> =>
    Effect.tryPromise({
      try: async () => {
        const fullPath = path.join(this.basePath, key);
        try {
          await fs.access(fullPath);
          return true;
        } catch {
          return false;
        }
      },
      catch: () => new Error("Failed to check file existence"),
    });

  getMetadata = (key: string): Effect.Effect<StoredFile, Error> =>
    Effect.tryPromise({
      try: async () => {
        const fullPath = path.join(this.basePath, key);
        const stats = await fs.stat(fullPath);
        return {
          key,
          size: stats.size,
          mimeType: "application/octet-stream", // Default, should be stored separately
        };
      },
      catch: (error) => new Error(`Failed to get metadata: ${error}`),
    });
}

/**
 * Create local storage provider
 */
export const makeLocalStorage = (): IStorageProvider => {
  const config = loadStorageConfig();
  return new LocalStorageProvider(config.basePath);
};

/**
 * Local storage service layer
 */
export const LocalStorageServiceLive = Layer.succeed(
  StorageService,
  makeLocalStorage()
);
