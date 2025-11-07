/**
 * Download Routes
 *
 * HTTP endpoints for document download operations
 */

import { Elysia } from "elysia";
import { Effect, pipe } from "effect";
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
        const effect = pipe(
          DownloadTokenWorkflowTag,
          Effect.flatMap((downloadWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) => {
                const requestBody = body as any;
                const commandData = {
                  documentId: requestBody.documentId,
                  versionId: requestBody.versionId,
                  ttlMs: requestBody.ttlMs,
                  userId: auth.userId,
                };

                return pipe(
                  validateBody(
                    DownloadDTOs.GenerateDownloadLinkCommand,
                    commandData
                  ),
                  Effect.flatMap((command) => {
                    const protocol = reqHeaders["x-forwarded-proto"] || "http";
                    const host = reqHeaders["host"] || "localhost:3000";
                    const baseUrl = `${protocol}://${host}`;

                    return downloadWorkflow.generateDownloadLink(
                      command,
                      baseUrl
                    );
                  })
                );
              })
            )
          )
        );

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
        const effect = pipe(
          DownloadTokenWorkflowTag,
          Effect.flatMap((downloadWorkflow) =>
            pipe(
              validateParams(DownloadDTOs.ValidateDownloadTokenQuery, params),
              Effect.flatMap((query) => downloadWorkflow.validateToken(query))
            )
          )
        );

        return runEffect(effect as any, runtime, reqHeaders);
      })

      /**
       * GET /downloads/:token
       * Download a file using a download token
       * This endpoint streams the actual file
       */
      .get("/:token", async ({ params, set, request }) => {
        const reqHeaders = Object.fromEntries(request.headers.entries());
        const effect = pipe(
          DownloadTokenWorkflowTag,
          Effect.flatMap((downloadWorkflow) =>
            pipe(
              validateParams(DownloadDTOs.DownloadFileQuery, params),
              Effect.flatMap((query) => downloadWorkflow.downloadFile(query)),
              // Check if file exists
              Effect.flatMap((fileInfo) =>
                pipe(
                  Effect.tryPromise({
                    try: () =>
                      fs
                        .access(fileInfo.path)
                        .then(() => true)
                        .catch(() => false),
                    catch: () => new Error("Failed to check file existence"),
                  }),
                  Effect.flatMap((fileExists) =>
                    fileExists
                      ? Effect.succeed(fileInfo)
                      : Effect.fail(
                          new Error(`File not found at path: ${fileInfo.path}`)
                        )
                  )
                )
              ),
              // Read file
              Effect.flatMap((fileInfo) =>
                pipe(
                  Effect.tryPromise({
                    try: () => fs.readFile(fileInfo.path),
                    catch: (error) =>
                      new Error(`Failed to read file: ${error}`),
                  }),
                  Effect.map((fileBuffer) => ({ fileInfo, fileBuffer }))
                )
              ),
              // Set headers and return buffer
              Effect.map(({ fileInfo, fileBuffer }) => {
                set.headers["Content-Type"] = fileInfo.mimeType;
                set.headers[
                  "Content-Disposition"
                ] = `attachment; filename="${fileInfo.filename}"`;
                set.headers["Content-Length"] = fileInfo.size.toString();
                return fileBuffer;
              })
            )
          )
        );

        return runEffect(effect as any, runtime, reqHeaders);
      })

      /**
       * DELETE /downloads/cleanup
       * Cleanup expired download tokens (admin only)
       */
      .delete("/cleanup", async ({ headers, request }) => {
        const reqHeaders = Object.fromEntries(request.headers.entries());
        const effect = pipe(
          DownloadTokenWorkflowTag,
          Effect.flatMap((downloadWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                downloadWorkflow.cleanupExpiredTokens({
                  userId: auth.userId as any,
                })
              )
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime,
          reqHeaders
        );
      })
  );
};
