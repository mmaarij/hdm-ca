/**
 * Document Routes
 *
 * HTTP endpoints for document operations
 * Simplified single-step upload with automatic versioning and metadata extraction
 */

import { Elysia, t } from "elysia";
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
       * POST /documents
       * Single-step upload - creates new document or adds version
       * Accepts multipart/form-data with:
       * - file: the actual file (required)
       * - documentId: optional, if provided creates new version
       */
      .post(
        "/",
        async ({ headers, body }) => {
          const effect = Effect.gen(function* () {
            const documentWorkflow = yield* DocumentWorkflowTag;
            const auth = yield* requireAuth();

            // Extract file and documentId from form data
            const formData = body as any;
            const file = formData.file;

            if (!file) {
              return yield* Effect.fail(new Error("File is required"));
            }

            // Build command - storage layer handles all file operations
            const command = {
              documentId: formData.documentId || undefined,
              file: file, // Pass raw file to workflow/storage layer
              uploadedBy: auth.userId,
            };

            const validatedCommand = yield* validateBody(
              DocumentDTOs.UploadDocumentCommand,
              command
            );

            const result = yield* documentWorkflow.uploadDocument(
              validatedCommand
            );

            return result;
          });

          return runEffect(
            withAuth(effect, headers.authorization) as any,
            runtime
          );
        },
        {
          body: t.Object({
            file: t.File(),
            documentId: t.Optional(t.String()),
          }),
        }
      )

      /**
       * GET /documents/:documentId
       * Get document by ID (returns latest version)
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
       * GET /documents/:documentId/versions/:versionId
       * Get specific version of a document
       */
      .get("/:documentId/versions/:versionId", async ({ headers, params }) => {
        const effect = Effect.gen(function* () {
          const documentWorkflow = yield* DocumentWorkflowTag;
          const auth = yield* requireAuth();
          const result = yield* documentWorkflow.getDocumentVersion({
            documentId: params.documentId as any,
            versionId: params.versionId as any,
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
       * GET /documents/:documentId/versions
       * List all versions of a document
       */
      .get("/:documentId/versions", async ({ headers, params }) => {
        const effect = Effect.gen(function* () {
          const documentWorkflow = yield* DocumentWorkflowTag;
          const auth = yield* requireAuth();
          const result = yield* documentWorkflow.listDocumentVersions(
            params.documentId as any,
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
       * DELETE /documents/:documentId
       * Delete document and all its versions
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
