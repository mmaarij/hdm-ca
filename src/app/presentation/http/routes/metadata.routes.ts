/**
 * Metadata Routes
 *
 * HTTP endpoints for metadata management
 */

import { Elysia } from "elysia";
import { Effect } from "effect";
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
        const effect = Effect.gen(function* () {
          const metadataWorkflow = yield* MetadataWorkflowTag;
          const auth = yield* requireAuth();
          const command = yield* validateBody(MetadataDTOs.AddMetadataCommand, {
            ...(body as any),
            userId: auth.userId,
          });
          const result = yield* metadataWorkflow.addMetadata(command);
          return result;
        });

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
        const effect = Effect.gen(function* () {
          const metadataWorkflow = yield* MetadataWorkflowTag;
          const auth = yield* requireAuth();
          const command = yield* validateBody(
            MetadataDTOs.UpdateMetadataCommand,
            {
              metadataId: params.metadataId,
              userId: auth.userId,
              ...(body as any),
            }
          );
          const result = yield* metadataWorkflow.updateMetadata(command);
          return result;
        });

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
        const effect = Effect.gen(function* () {
          const metadataWorkflow = yield* MetadataWorkflowTag;
          const auth = yield* requireAuth();
          yield* metadataWorkflow.deleteMetadata({
            metadataId: params.metadataId as any,
            userId: auth.userId as any,
          });
          return { message: "Metadata deleted successfully" };
        });

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
        const effect = Effect.gen(function* () {
          const metadataWorkflow = yield* MetadataWorkflowTag;
          const auth = yield* requireAuth();
          const result = yield* metadataWorkflow.listMetadata({
            documentId: params.documentId as any,
            userId: auth.userId as any,
          });
          return result;
        });

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
        const effect = Effect.gen(function* () {
          const metadataWorkflow = yield* MetadataWorkflowTag;
          const auth = yield* requireAuth();
          const result = yield* metadataWorkflow.getMetadataByKey({
            documentId: params.documentId as any,
            key: params.key as any,
            userId: auth.userId as any,
          });
          return result;
        });

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime
        );
      })
  );
};
