/**
 * Metadata Routes
 *
 * HTTP endpoints for metadata management
 */

import { Elysia } from "elysia";
import { Effect, pipe } from "effect";
import type { Runtime } from "effect";
import { MetadataWorkflowTag } from "../../../application/workflows/metadata-workflow";
import { runEffect } from "../utils/handler";
import { withAuth, requireAuth } from "../middleware/auth.middleware";

/**
 * Create metadata routes
 */
export const createMetadataRoutes = <R>(runtime: Runtime.Runtime<R>) => {
  return (
    new Elysia({ prefix: "/metadata" })
      /**
       * POST /metadata
       * Add metadata to a document
       */
      .post("/", async ({ headers, body }) => {
        const effect = pipe(
          MetadataWorkflowTag,
          Effect.flatMap((metadataWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                metadataWorkflow.addMetadata({
                  ...(body as any),
                  userId: auth.userId,
                })
              )
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime
        );
      })

      /**
       * PUT /metadata/:metadataId
       * Update metadata
       */
      .put("/:metadataId", async ({ headers, params, body }) => {
        const effect = pipe(
          MetadataWorkflowTag,
          Effect.flatMap((metadataWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                metadataWorkflow.updateMetadata({
                  metadataId: params.metadataId,
                  userId: auth.userId,
                  ...(body as any),
                })
              )
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime
        );
      })

      /**
       * DELETE /metadata/:metadataId
       * Delete metadata
       */
      .delete("/:metadataId", async ({ headers, params }) => {
        const effect = pipe(
          MetadataWorkflowTag,
          Effect.flatMap((metadataWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                metadataWorkflow.deleteMetadata({
                  metadataId: params.metadataId,
                  userId: auth.userId,
                })
              ),
              Effect.map(() => ({ message: "Metadata deleted successfully" }))
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime
        );
      })

      /**
       * GET /metadata/document/:documentId
       * List all metadata for a document
       */
      .get("/document/:documentId", async ({ headers, params }) => {
        const effect = pipe(
          MetadataWorkflowTag,
          Effect.flatMap((metadataWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                metadataWorkflow.listMetadata({
                  documentId: params.documentId,
                  userId: auth.userId,
                })
              )
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime
        );
      })

      /**
       * GET /metadata/document/:documentId/key/:key
       * Get metadata by key
       */
      .get("/document/:documentId/key/:key", async ({ headers, params }) => {
        const effect = pipe(
          MetadataWorkflowTag,
          Effect.flatMap((metadataWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                metadataWorkflow.getMetadataByKey({
                  documentId: params.documentId,
                  key: params.key,
                  userId: auth.userId,
                })
              )
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime
        );
      })
  );
};
