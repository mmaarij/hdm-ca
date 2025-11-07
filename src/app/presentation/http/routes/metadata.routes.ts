/**
 * Metadata Routes
 *
 * HTTP endpoints for metadata management
 */

import { Elysia } from "elysia";
import { Effect, pipe } from "effect";
import type { Runtime } from "effect";
import { MetadataWorkflowTag } from "../../../application/workflows/metadata-workflow";
import * as MetadataDTOs from "../../../application/dtos/metedata";
import { validateBody } from "../utils/schema-validation";
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
                pipe(
                  validateBody(MetadataDTOs.AddMetadataCommand, {
                    ...(body as any),
                    userId: auth.userId,
                  }),
                  Effect.flatMap((command) =>
                    metadataWorkflow.addMetadata(command)
                  )
                )
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
                pipe(
                  validateBody(MetadataDTOs.UpdateMetadataCommand, {
                    metadataId: params.metadataId,
                    userId: auth.userId,
                    ...(body as any),
                  }),
                  Effect.flatMap((command) =>
                    metadataWorkflow.updateMetadata(command)
                  )
                )
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
                  metadataId: params.metadataId as any,
                  userId: auth.userId as any,
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
                  documentId: params.documentId as any,
                  userId: auth.userId as any,
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
                  documentId: params.documentId as any,
                  key: params.key as any,
                  userId: auth.userId as any,
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
