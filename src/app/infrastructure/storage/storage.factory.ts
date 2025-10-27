import { Layer } from "effect";
import { StorageService } from "./storage.interface";
import { LocalStorageServiceLive } from "./local-storage";
import { loadStorageConfig } from "../config/storage.config";

/**
 * Storage factory that returns the appropriate storage provider
 */
export const StorageServiceLive = (): Layer.Layer<
  StorageService,
  never,
  never
> => {
  const config = loadStorageConfig();

  switch (config.type) {
    case "local":
      return LocalStorageServiceLive;
    case "s3":
      // TODO: Implement S3 storage
      throw new Error("S3 storage not yet implemented");
    default:
      return LocalStorageServiceLive;
  }
};
