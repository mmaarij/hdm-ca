/**
 * Permission Routes
 *
 * HTTP endpoints for permission management
 */

import { Elysia } from "elysia";
import { Effect, pipe } from "effect";
import type { Runtime } from "effect";
import { PermissionWorkflowTag } from "../../../application/workflows/permission-workflow";
import * as PermissionDTOs from "../../../application/dtos/permission";
import { validateBody, validateQuery } from "../utils/schema-validation";
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
                pipe(
                  validateBody(PermissionDTOs.GrantPermissionCommand, {
                    ...(body as any),
                    grantedBy: auth.userId,
                  }),
                  Effect.flatMap((command) =>
                    permissionWorkflow.grantPermission(command)
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
                pipe(
                  validateBody(PermissionDTOs.UpdatePermissionCommand, {
                    permissionId: params.permissionId,
                    updatedBy: auth.userId,
                    ...(body as any),
                  }),
                  Effect.flatMap((command) =>
                    permissionWorkflow.updatePermission(command)
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
                  permissionId: params.permissionId as any,
                  revokedBy: auth.userId as any,
                })
              ),
              Effect.map(() => ({ message: "Permission revoked successfully" }))
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as any,
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
                  userId: params.userId as any,
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
                pipe(
                  validateQuery(PermissionDTOs.CheckPermissionQuery, query),
                  Effect.flatMap((queryParams) =>
                    permissionWorkflow.checkPermission(queryParams)
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
  );
};
