/**
 * Download Routes
 *
 * HTTP endpoints for document download operations
 */

import { Elysia } from "elysia";
import { Effect } from "effect";
import type { Runtime } from "effect";
import { DownloadTokenWorkflowTag } from "../../../application/workflows/download-token-workflow";
import * as DownloadDTOs from "../../../application/dtos/download-token";
import { validateBody, validateParams } from "../utils/schema-validation";
import { runEffect } from "../utils/handler";
import { withAuth, requireAuth } from "../middleware/auth.middleware";
import { StoragePortTag } from "../../../application/ports/storage.port";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Create download routes
 */
export const createDownloadRoutes = <R>(runtime: Runtime.Runtime<R>) => {
  return (
    new Elysia({ prefix: "/downloads" })
      /**
       * POST /downloads/generate
       * Generate a download link for a document
       * Requires authentication and read permission on the document
       */
      .post("/generate", async ({ headers, body, request }) => {
        const reqHeaders = Object.fromEntries(request.headers.entries());
        const effect = Effect.gen(function* () {
          const downloadWorkflow = yield* DownloadTokenWorkflowTag;
          const auth = yield* requireAuth();

          // Merge body with userId from auth
          const requestBody = body as any;
          const commandData = {
            documentId: requestBody.documentId,
            versionId: requestBody.versionId,
            ttlMs: requestBody.ttlMs,
            userId: auth.userId,
          };

          const command = yield* validateBody(
            DownloadDTOs.GenerateDownloadLinkCommand,
            commandData
          );

          // Get base URL from request
          const protocol = reqHeaders["x-forwarded-proto"] || "http";
          const host = reqHeaders["host"] || "localhost:3000";
          const baseUrl = `${protocol}://${host}`;

          const result = yield* downloadWorkflow.generateDownloadLink(
            command,
            baseUrl
          );
          return result;
        });

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime,
          reqHeaders
        );
      })

      /**
       * GET /downloads/validate/:token
       * Validate a download token without consuming it
       */
      .get("/validate/:token", async ({ params, request }) => {
        const reqHeaders = Object.fromEntries(request.headers.entries());
        const effect = Effect.gen(function* () {
          const downloadWorkflow = yield* DownloadTokenWorkflowTag;

          const query = yield* validateParams(
            DownloadDTOs.ValidateDownloadTokenQuery,
            params
          );

          const result = yield* downloadWorkflow.validateToken(query);
          return result;
        });

        return runEffect(effect as any, runtime, reqHeaders);
      })

      /**
       * GET /downloads/:token
       * Download a file using a download token
       * This endpoint streams the actual file
       */
      .get("/:token", async ({ params, set, request }) => {
        const reqHeaders = Object.fromEntries(request.headers.entries());
        const effect = Effect.gen(function* () {
          const downloadWorkflow = yield* DownloadTokenWorkflowTag;

          const query = yield* validateParams(
            DownloadDTOs.DownloadFileQuery,
            params
          );

          // Get file metadata from workflow
          const fileInfo = yield* downloadWorkflow.downloadFile(query);

          // Check if file exists
          const fileExists = yield* Effect.tryPromise({
            try: () =>
              fs
                .access(fileInfo.path)
                .then(() => true)
                .catch(() => false),
            catch: () => new Error("Failed to check file existence"),
          });

          if (!fileExists) {
            return yield* Effect.fail(
              new Error(`File not found at path: ${fileInfo.path}`)
            );
          }

          // Read file
          const fileBuffer = yield* Effect.tryPromise({
            try: () => fs.readFile(fileInfo.path),
            catch: (error) => new Error(`Failed to read file: ${error}`),
          });

          // Set headers for file download
          set.headers["Content-Type"] = fileInfo.mimeType;
          set.headers[
            "Content-Disposition"
          ] = `attachment; filename="${fileInfo.filename}"`;
          set.headers["Content-Length"] = fileInfo.size.toString();

          return fileBuffer;
        });

        return runEffect(effect as any, runtime, reqHeaders);
      })

      /**
       * DELETE /downloads/cleanup
       * Cleanup expired download tokens (admin only)
       */
      .delete("/cleanup", async ({ headers, request }) => {
        const reqHeaders = Object.fromEntries(request.headers.entries());
        const effect = Effect.gen(function* () {
          const downloadWorkflow = yield* DownloadTokenWorkflowTag;
          const auth = yield* requireAuth();

          const command: DownloadDTOs.CleanupExpiredTokensCommand = {
            userId: auth.userId as any,
          };

          const result = yield* downloadWorkflow.cleanupExpiredTokens(command);
          return result;
        });

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime,
          reqHeaders
        );
      })
  );
};
