/**
 * Upload Routes
 *
 * HTTP endpoints for direct file uploads to local storage
 */

import { Elysia } from "elysia";
import { Effect } from "effect";
import type { Runtime } from "effect";
import * as fs from "fs/promises";
import * as path from "path";

const STORAGE_ROOT = process.env.STORAGE_ROOT || "./data/uploads";

/**
 * Create upload routes
 */
export const createUploadRoutes = <R>(runtime: Runtime.Runtime<R>) => {
  return (
    new Elysia({ prefix: "/upload" })
      /**
       * POST /upload/:documentId/:versionId
       * Upload file to local storage organized by document and version
       */
      .post("/:documentId/:versionId", async ({ params, body, set }) => {
        const effect = Effect.gen(function* () {
          // Extract file from multipart body
          const file = (body as any)?.file;

          if (!file) {
            set.status = 400;
            return {
              status: 400,
              error: "Bad Request",
              message: "No file provided in request body",
            };
          }

          // Validate file
          if (!(file instanceof File || file instanceof Blob)) {
            set.status = 400;
            return {
              status: 400,
              error: "Bad Request",
              message: "Invalid file format",
            };
          }

          // Get file metadata
          const filename = (file as File).name || "uploaded-file";

          // Create directory structure: data/uploads/{documentId}/{versionId}/
          const targetDir = path.join(
            STORAGE_ROOT,
            params.documentId,
            params.versionId
          );

          // Create directory if it doesn't exist
          yield* Effect.tryPromise({
            try: () => fs.mkdir(targetDir, { recursive: true }),
            catch: (error) =>
              new Error(`Failed to create storage directory: ${error}`),
          });

          // Generate storage path: {documentId}/{versionId}/{filename}
          const storagePath = path.join(
            params.documentId,
            params.versionId,
            filename
          );
          const fullPath = path.join(STORAGE_ROOT, storagePath);

          // Write file to disk
          const arrayBuffer = yield* Effect.tryPromise({
            try: () => file.arrayBuffer(),
            catch: (error) => new Error(`Failed to read file: ${error}`),
          });

          yield* Effect.tryPromise({
            try: () => fs.writeFile(fullPath, Buffer.from(arrayBuffer)),
            catch: (error) => new Error(`Failed to write file: ${error}`),
          });

          // Return storage path for confirm upload step
          return {
            message: "File uploaded successfully",
            storagePath,
            filename,
            size: file.size,
            documentId: params.documentId,
            versionId: params.versionId,
          };
        });

        return Effect.runPromise(Effect.provide(effect, runtime));
      })
  );
};
