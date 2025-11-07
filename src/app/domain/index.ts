/**
 * Domain Exports
 *
 * Centralized exports for all domain entities, errors, and types
 */

// Refined types
export * from "./refined/uuid";
export * from "./refined/email";
export * from "./refined/date-time";
export * from "./refined/password";
export * from "./refined/metadata";

// Shared utilities
export * from "./shared";

// User domain
export * from "./user/entity";
export * from "./user/value-object";
export * from "./user/schema";
export * from "./user/errors";
export * from "./user/guards";
export * from "./user/repository";

// Document domain
export * from "./document/entity";
export {
  Filename,
  FilePath,
  MimeType,
  VersionNumber,
} from "./document/value-object";
export * from "./document/schema";
export * from "./document/errors";
export * from "./document/service";
export {
  isDocumentOwner,
  isValidFileSize,
  isSafeFilename,
  guardFileSize,
  guardMimeType,
  guardDocumentOwnership,
  guardSafeFilename,
} from "./document/guards";
export { DocumentRepositoryTag } from "./document/repository";

// Permission domain
export * from "./permission/entity";
export * from "./permission/value-object";
export * from "./permission/schema";
export * from "./permission/errors";
export * from "./permission/guards";
export * from "./permission/repository";

// Download token domain
export * from "./download-token/entity";
export * from "./download-token/value-object";
export * from "./download-token/schema";
export * from "./download-token/errors";
export * from "./download-token/guards";
export * from "./download-token/repository";

// Metadata domain
export * from "./metedata/entity";
export * from "./metedata/value-object";
export * from "./metedata/schema";
export * from "./metedata/errors";
export * from "./metedata/guards";
export * from "./metedata/repository";
