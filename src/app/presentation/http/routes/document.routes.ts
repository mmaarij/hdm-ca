/**
 * Document Routes
 *
 * HTTP endpoints for document operations (upload, retrieve, publish, delete)
 */

import { Elysia } from "elysia";
import { Effect } from "effect";
import type { Runtime } from "effect";
import { DocumentWorkflowTag } from "../../../application/workflows/document-workflow";
import * as DocumentDTOs from "../../../application/dtos/document";
import { validateBody, validateQuery } from "../utils/schema-validation";
import { runEffect } from "../utils/handler";
import { withAuth, requireAuth } from "../middleware/auth.middleware";

/**
 * Create document routes
 */
export const createDocumentRoutes = <R>(runtime: Runtime.Runtime<R>) => {
  return (
    new Elysia({ prefix: "/documents" })
      /**
       * POST /documents/initiate-upload
       * Initiate two-phase upload (Phase 1)
       */
      .post("/initiate-upload", async ({ headers, body }) => {
        const effect = Effect.gen(function* () {
          const documentWorkflow = yield* DocumentWorkflowTag;
          const auth = yield* requireAuth();
          const command = yield* validateBody(
            DocumentDTOs.InitiateUploadCommand,
            {
              ...(body as any),
              uploadedBy: auth.userId,
            }
          );
          const result = yield* documentWorkflow.initiateUpload(command);
          return result;
        });

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime
        );
      })

      /**
       * POST /documents/confirm-upload
       * Confirm upload (Phase 2)
       */
      .post("/confirm-upload", async ({ headers, body }) => {
        const effect = Effect.gen(function* () {
          const documentWorkflow = yield* DocumentWorkflowTag;
          const auth = yield* requireAuth();
          const command = yield* validateBody(
            DocumentDTOs.ConfirmUploadCommand,
            {
              ...(body as any),
              userId: auth.userId,
            }
          );
          const result = yield* documentWorkflow.confirmUpload(command);
          return result;
        });

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime
        );
      })

      /**
       * POST /documents/metadata
       * Create document metadata without immediate file upload
       */
      .post("/metadata", async ({ headers, body }) => {
        const effect = Effect.gen(function* () {
          const documentWorkflow = yield* DocumentWorkflowTag;
          const auth = yield* requireAuth();
          const command = yield* validateBody(
            DocumentDTOs.CreateDocumentMetadataCommand,
            {
              ...(body as any),
              uploadedBy: auth.userId,
            }
          );
          const result = yield* documentWorkflow.createDocumentMetadata(
            command
          );
          return result;
        });

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime
        );
      })

      /**
       * POST /documents/:documentId/publish
       * Publish document
       */
      .post("/:documentId/publish", async ({ headers, params }) => {
        const effect = Effect.gen(function* () {
          const documentWorkflow = yield* DocumentWorkflowTag;
          const auth = yield* requireAuth();
          const result = yield* documentWorkflow.publishDocument({
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
       * POST /documents/:documentId/unpublish
       * Unpublish document
       */
      .post("/:documentId/unpublish", async ({ headers, params }) => {
        const effect = Effect.gen(function* () {
          const documentWorkflow = yield* DocumentWorkflowTag;
          const auth = yield* requireAuth();
          const result = yield* documentWorkflow.unpublishDocument({
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
       * GET /documents/:documentId
       * Get document by ID
       */
      .get("/:documentId", async ({ headers, params }) => {
        const effect = Effect.gen(function* () {
          const documentWorkflow = yield* DocumentWorkflowTag;
          const auth = yield* requireAuth();
          const result = yield* documentWorkflow.getDocument({
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
       * GET /documents
       * List documents accessible to current user
       */
      .get("/", async ({ headers, query }) => {
        const effect = Effect.gen(function* () {
          const documentWorkflow = yield* DocumentWorkflowTag;
          const auth = yield* requireAuth();
          const queryParams = yield* validateQuery(
            DocumentDTOs.ListDocumentsQuery,
            {
              ...query,
              userId: auth.userId,
            }
          );
          const result = yield* documentWorkflow.listDocuments(queryParams);
          return result;
        });

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime
        );
      })

      /**
       * GET /documents/admin/all
       * List all documents (admin only)
       */
      .get("/admin/all", async ({ headers, query }) => {
        const effect = Effect.gen(function* () {
          const documentWorkflow = yield* DocumentWorkflowTag;
          const auth = yield* requireAuth();
          const queryParams = yield* validateQuery(
            DocumentDTOs.ListAllDocumentsQuery,
            query
          );
          const result = yield* documentWorkflow.listAllDocuments(
            queryParams,
            auth.userId as any
          );
          return result;
        });

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime
        );
      })

      /**
       * GET /documents/search
       * Search documents
       */
      .get("/search", async ({ headers, query }) => {
        const effect = Effect.gen(function* () {
          const documentWorkflow = yield* DocumentWorkflowTag;
          const auth = yield* requireAuth();
          const queryParams = yield* validateQuery(
            DocumentDTOs.SearchDocumentsQuery,
            {
              ...query,
              userId: auth.userId,
            }
          );
          const result = yield* documentWorkflow.searchDocuments(queryParams);
          return result;
        });

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime
        );
      })

      /**
       * PUT /documents/:documentId
       * Update document
       */
      .put("/:documentId", async ({ headers, params, body }) => {
        const effect = Effect.gen(function* () {
          const documentWorkflow = yield* DocumentWorkflowTag;
          const auth = yield* requireAuth();
          const command = yield* validateBody(
            DocumentDTOs.UpdateDocumentCommand,
            {
              documentId: params.documentId,
              userId: auth.userId,
              ...(body as any),
            }
          );
          const result = yield* documentWorkflow.updateDocument(command);
          return result;
        });

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime
        );
      })

      /**
       * DELETE /documents/:documentId
       * Delete document
       */
      .delete("/:documentId", async ({ headers, params }) => {
        const effect = Effect.gen(function* () {
          const documentWorkflow = yield* DocumentWorkflowTag;
          const auth = yield* requireAuth();
          yield* documentWorkflow.deleteDocument({
            documentId: params.documentId as any,
            userId: auth.userId as any,
          });
          return { message: "Document deleted successfully" };
        });

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime
        );
      })
  );
};
