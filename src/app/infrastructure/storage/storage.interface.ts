import { Effect, Context } from "effect";

/**
 * Storage file metadata
 */
export interface StoredFile {
  readonly key: string;
  readonly size: number;
  readonly mimeType: string;
}

/**
 * File to store
 */
export interface FileToStore {
  readonly content: Buffer;
  readonly filename: string;
  readonly mimeType: string;
}

/**
 * Storage provider interface
 */
export interface IStorageProvider {
  /**
   * Store a file
   */
  readonly store: (
    key: string,
    file: FileToStore
  ) => Effect.Effect<StoredFile, Error>;

  /**
   * Retrieve a file
   */
  readonly retrieve: (key: string) => Effect.Effect<Buffer, Error>;

  /**
   * Delete a file
   */
  readonly delete: (key: string) => Effect.Effect<void, Error>;

  /**
   * Check if file exists
   */
  readonly exists: (key: string) => Effect.Effect<boolean, Error>;

  /**
   * Get file metadata
   */
  readonly getMetadata: (key: string) => Effect.Effect<StoredFile, Error>;
}

/**
 * Storage service tag for dependency injection
 */
export class StorageService extends Context.Tag("StorageService")<
  StorageService,
  IStorageProvider
>() {}
