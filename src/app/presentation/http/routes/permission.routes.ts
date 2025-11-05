/**
 * Permission Routes
 *
 * HTTP endpoints for permission management
 */

import { Elysia } from "elysia";
import { Effect } from "effect";
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
        const effect = Effect.gen(function* () {
          const permissionWorkflow = yield* PermissionWorkflowTag;
          const auth = yield* requireAuth();
          const command = yield* validateBody(
            PermissionDTOs.GrantPermissionCommand,
            {
              ...(body as any),
              grantedBy: auth.userId,
            }
          );
          const result = yield* permissionWorkflow.grantPermission(command);
          return result;
        });

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
        const effect = Effect.gen(function* () {
          const permissionWorkflow = yield* PermissionWorkflowTag;
          const auth = yield* requireAuth();
          const command = yield* validateBody(
            PermissionDTOs.UpdatePermissionCommand,
            {
              permissionId: params.permissionId,
              updatedBy: auth.userId,
              ...(body as any),
            }
          );
          const result = yield* permissionWorkflow.updatePermission(command);
          return result;
        });

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
        const effect = Effect.gen(function* () {
          const permissionWorkflow = yield* PermissionWorkflowTag;
          const auth = yield* requireAuth();
          yield* permissionWorkflow.revokePermission({
            permissionId: params.permissionId as any,
            revokedBy: auth.userId as any,
          });
          return { message: "Permission revoked successfully" };
        });

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
        const effect = Effect.gen(function* () {
          const permissionWorkflow = yield* PermissionWorkflowTag;
          const auth = yield* requireAuth();
          const result = yield* permissionWorkflow.listDocumentPermissions({
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
       * GET /permissions/user/:userId
       * List permissions for a user
       */
      .get("/user/:userId", async ({ headers, params }) => {
        const effect = Effect.gen(function* () {
          const permissionWorkflow = yield* PermissionWorkflowTag;
          yield* requireAuth();
          const result = yield* permissionWorkflow.listUserPermissions({
            userId: params.userId as any,
          });
          return result;
        });

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
        const effect = Effect.gen(function* () {
          const permissionWorkflow = yield* PermissionWorkflowTag;
          yield* requireAuth();
          const queryParams = yield* validateQuery(
            PermissionDTOs.CheckPermissionQuery,
            query
          );
          const result = yield* permissionWorkflow.checkPermission(queryParams);
          return result;
        });

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime
        );
      })
  );
};
