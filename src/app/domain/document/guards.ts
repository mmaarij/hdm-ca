import { Effect } from "effect";
import { DocumentEntity, DocumentVersionEntity } from "./entity";
import { UserId } from "../refined/uuid";
import { MAX_FILE_SIZE, MIN_FILE_SIZE } from "./value-object";
import { ALLOWED_MIME_TYPES } from "../refined/metadata";

/**
 * Document Domain Business Rules and Guards
 */

/**
 * Check if user is the document owner
 */
export const isDocumentOwner = (
  document: DocumentEntity,
  userId: UserId
): boolean => document.uploadedBy === userId;

/**
 * Check if file size is valid
 */
export const isValidFileSize = (size: number): boolean =>
  size >= MIN_FILE_SIZE && size <= MAX_FILE_SIZE;

/**
 * Check if MIME type is allowed
 * Normalizes MIME type by removing charset and other parameters
 */
export const isAllowedMimeType = (mimeType: string): boolean => {
  // Extract base MIME type (before any semicolon/parameters)
  const baseMimeType = mimeType.split(";")[0].trim().toLowerCase();
  return ALLOWED_MIME_TYPES.includes(baseMimeType as any);
};

/**
 * Guard: File size must be within allowed range
 */
export const guardFileSize = (size: number): Effect.Effect<void, Error> =>
  isValidFileSize(size)
    ? Effect.void
    : Effect.fail(
        new Error(
          `File size ${size} bytes is invalid. Must be between ${MIN_FILE_SIZE} and ${MAX_FILE_SIZE} bytes (100 MB)`
        )
      );

/**
 * Guard: MIME type must be in allowed list
 */
export const guardMimeType = (mimeType: string): Effect.Effect<void, Error> =>
  isAllowedMimeType(mimeType)
    ? Effect.void
    : Effect.fail(
        new Error(
          `MIME type '${mimeType}' is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(
            ", "
          )}`
        )
      );

/**
 * Guard: User must be document owner or admin
 */
export const guardDocumentOwnership = (
  document: DocumentEntity,
  userId: UserId,
  userRole?: string
): Effect.Effect<void, Error> =>
  isDocumentOwner(document, userId) || userRole === "ADMIN"
    ? Effect.void
    : Effect.fail(new Error("User is not authorized to access this document"));

/**
 * Validate that filename doesn't contain path traversal characters
 */
export const isSafeFilename = (filename: string): boolean =>
  !/[\/\\]|\.\./.test(filename);

/**
 * Guard: Filename must be safe
 */
export const guardSafeFilename = (
  filename: string
): Effect.Effect<void, Error> =>
  isSafeFilename(filename)
    ? Effect.void
    : Effect.fail(
        new Error("Filename contains invalid path traversal characters")
      );
