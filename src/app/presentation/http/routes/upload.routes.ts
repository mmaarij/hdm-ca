/**
 * Upload Routes
 *
 * HTTP endpoints for direct file uploads to local storage
 */

import { Elysia } from "elysia";
import { Effect, pipe } from "effect";
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
        const effect = pipe(
          // Note: Elysia's body type is unknown at compile time for multipart/form-data
          // Runtime validation ensures file exists and is correct type
          Effect.sync(() => (body as { file?: File | Blob })?.file),
          // Validate file exists
          Effect.flatMap((file): Effect.Effect<File | Blob, never> => {
            if (!file) {
              set.status = 400;
              throw {
                status: 400,
                error: "Bad Request",
                message: "No file provided in request body",
              };
            }

            if (!(file instanceof File || file instanceof Blob)) {
              set.status = 400;
              throw {
                status: 400,
                error: "Bad Request",
                message: "Invalid file format",
              };
            }

            return Effect.succeed(file);
          }),
          // Get file metadata and create directory structure
          Effect.flatMap((file) => {
            const filename = (file as File).name || "uploaded-file";
            const targetDir = path.join(
              STORAGE_ROOT,
              params.documentId,
              params.versionId
            );

            return pipe(
              Effect.tryPromise({
                try: () => fs.mkdir(targetDir, { recursive: true }),
                catch: (error) =>
                  new Error(`Failed to create storage directory: ${error}`),
              }),
              Effect.map(() => ({ file, filename, targetDir }))
            );
          }),
          // Write file to disk
          Effect.flatMap(({ file, filename, targetDir }) => {
            const storagePath = path.join(
              params.documentId,
              params.versionId,
              filename
            );
            const fullPath = path.join(STORAGE_ROOT, storagePath);

            return pipe(
              Effect.tryPromise({
                try: () => file.arrayBuffer(),
                catch: (error) => new Error(`Failed to read file: ${error}`),
              }),
              Effect.flatMap((arrayBuffer) =>
                Effect.tryPromise({
                  try: () => fs.writeFile(fullPath, Buffer.from(arrayBuffer)),
                  catch: (error) => new Error(`Failed to write file: ${error}`),
                })
              ),
              Effect.map(() => ({
                message: "File uploaded successfully",
                storagePath,
                filename,
                size: file.size,
                documentId: params.documentId,
                versionId: params.versionId,
              }))
            );
          })
        );

        return Effect.runPromise(Effect.provide(effect, runtime));
      })
  );
};
