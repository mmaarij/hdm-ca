/**
 * Permission Routes
 *
 * HTTP endpoints for permission management
 */

import { Elysia } from "elysia";
import { Effect, pipe } from "effect";
import type { Runtime } from "effect";
import { PermissionWorkflowTag } from "../../../application/workflows/permission-workflow";
import { runEffect } from "../utils/handler";
import { withAuth, requireAuth } from "../middleware/auth.middleware";

/**
 * Create permission routes
 */
export const createPermissionRoutes = <R>(runtime: Runtime.Runtime<R>) => {
  return (
    new Elysia({ prefix: "/permissions" })
      /**
       * POST /permissions/grant
       * Grant permission to a user
       */
      .post("/grant", async ({ headers, body }) => {
        const effect = pipe(
          PermissionWorkflowTag,
          Effect.flatMap((permissionWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                permissionWorkflow.grantPermission({
                  ...(body as {
                    documentId: string;
                    userId: string;
                    permission: string;
                  }),
                  grantedBy: auth.userId,
                })
              )
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as Effect.Effect<any, any, R>,
          runtime
        );
      })

      /**
       * PUT /permissions/:permissionId
       * Update permission
       */
      .put("/:permissionId", async ({ headers, params, body }) => {
        const effect = pipe(
          PermissionWorkflowTag,
          Effect.flatMap((permissionWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                permissionWorkflow.updatePermission({
                  permissionId: params.permissionId,
                  updatedBy: auth.userId,
                  ...(body as { permission: string }),
                })
              )
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as Effect.Effect<any, any, R>,
          runtime
        );
      })

      /**
       * DELETE /permissions/:permissionId
       * Revoke permission
       */
      .delete("/:permissionId", async ({ headers, params }) => {
        const effect = pipe(
          PermissionWorkflowTag,
          Effect.flatMap((permissionWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                permissionWorkflow.revokePermission({
                  permissionId: params.permissionId,
                  revokedBy: auth.userId,
                })
              ),
              Effect.map(() => ({ message: "Permission revoked successfully" }))
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as Effect.Effect<any, any, R>,
          runtime
        );
      })

      /**
       * GET /permissions/document/:documentId
       * List permissions for a document
       */
      .get("/document/:documentId", async ({ headers, params }) => {
        const effect = pipe(
          PermissionWorkflowTag,
          Effect.flatMap((permissionWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                permissionWorkflow.listDocumentPermissions({
                  documentId: params.documentId,
                  userId: auth.userId,
                })
              )
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as Effect.Effect<any, any, R>,
          runtime
        );
      })

      /**
       * GET /permissions/user/:userId
       * List permissions for a user
       */
      .get("/user/:userId", async ({ headers, params }) => {
        const effect = pipe(
          PermissionWorkflowTag,
          Effect.flatMap((permissionWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap(() =>
                permissionWorkflow.listUserPermissions({
                  userId: params.userId,
                })
              )
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as Effect.Effect<any, any, R>,
          runtime
        );
      })

      /**
       * GET /permissions/check
       * Check if user has permission
       */
      .get("/check", async ({ headers, query }) => {
        const effect = pipe(
          PermissionWorkflowTag,
          Effect.flatMap((permissionWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap(() =>
                permissionWorkflow.checkPermission(
                  query as {
                    documentId: string;
                    userId: string;
                    requiredPermission: string;
                  }
                )
              )
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as Effect.Effect<any, any, R>,
          runtime
        );
      })
  );
};
