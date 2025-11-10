/**
 * Document Routes
 *
 * HTTP endpoints for document operations
 * Simplified single-step upload with automatic versioning and metadata extraction
 */

import { Elysia, t } from "elysia";
import { Effect, pipe } from "effect";
import type { Runtime } from "effect";
import { DocumentWorkflowTag } from "../../../application/workflows/document-workflow";
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
          const effect = pipe(
            DocumentWorkflowTag,
            Effect.flatMap((documentWorkflow) =>
              pipe(
                requireAuth(),
                Effect.flatMap((auth) => {
                  const formData = body as any;
                  const file = formData.file;

                  if (!file) {
                    return Effect.fail(new Error("File is required"));
                  }

                  const command = {
                    documentId: formData.documentId || undefined,
                    file: file,
                    uploadedBy: auth.userId,
                  };

                  return documentWorkflow.uploadDocument(command);
                })
              )
            )
          );

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
        const effect = pipe(
          DocumentWorkflowTag,
          Effect.flatMap((documentWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                documentWorkflow.getDocument({
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
       * GET /documents/:documentId/versions/:versionId
       * Get specific version of a document
       */
      .get("/:documentId/versions/:versionId", async ({ headers, params }) => {
        const effect = pipe(
          DocumentWorkflowTag,
          Effect.flatMap((documentWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                documentWorkflow.getDocumentVersion({
                  documentId: params.documentId,
                  versionId: params.versionId,
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
       * GET /documents/:documentId/versions
       * List all versions of a document
       */
      .get("/:documentId/versions", async ({ headers, params }) => {
        const effect = pipe(
          DocumentWorkflowTag,
          Effect.flatMap((documentWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                documentWorkflow.listDocumentVersions(
                  params.documentId as any,
                  auth.userId as any
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
       * GET /documents
       * List documents accessible to current user
       */
      .get("/", async ({ headers, query }) => {
        const effect = pipe(
          DocumentWorkflowTag,
          Effect.flatMap((documentWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                documentWorkflow.listDocuments({
                  ...query,
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
       * GET /documents/admin/all
       * List all documents (admin only)
       */
      .get("/admin/all", async ({ headers, query }) => {
        const effect = pipe(
          DocumentWorkflowTag,
          Effect.flatMap((documentWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                documentWorkflow.listAllDocuments({
                  ...query,
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
       * GET /documents/search
       * Search documents
       */
      .get("/search", async ({ headers, query }) => {
        const effect = pipe(
          DocumentWorkflowTag,
          Effect.flatMap((documentWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                documentWorkflow.searchDocuments({
                  query: (query as any).query,
                  page: (query as any).page,
                  limit: (query as any).limit,
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
       * DELETE /documents/:documentId
       * Delete document and all its versions
       */
      .delete("/:documentId", async ({ headers, params }) => {
        const effect = pipe(
          DocumentWorkflowTag,
          Effect.flatMap((documentWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                documentWorkflow.deleteDocument({
                  documentId: params.documentId,
                  userId: auth.userId,
                })
              ),
              Effect.map(() => ({ message: "Document deleted successfully" }))
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
