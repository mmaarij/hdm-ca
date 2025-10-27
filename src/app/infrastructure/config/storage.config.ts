import { Effect } from "effect";
import path from "path";

/**
 * Storage configuration
 */
export interface StorageConfig {
  readonly type: "local" | "s3";
  readonly basePath: string;
}

/**
 * Load storage config from environment
 */
export const loadStorageConfig = (): StorageConfig => ({
  type: (process.env.STORAGE_TYPE as "local" | "s3") || "local",
  basePath:
    process.env.STORAGE_BASE_PATH || path.join(process.cwd(), "uploads"),
});

/**
 * Storage config as Effect
 */
export const StorageConfigLive = Effect.succeed(loadStorageConfig());
