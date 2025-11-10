/**
 * User Routes
 *
 * HTTP endpoints for user operations (registration, login, profile management)
 */

import { Elysia } from "elysia";
import { Effect, pipe } from "effect";
import type { Runtime } from "effect";
import { UserWorkflowTag } from "../../../application/workflows/user-workflow";
import { runEffect } from "../utils/handler";
import { withAuth, requireAuth } from "../middleware/auth.middleware";
import {
  RegisterResponse,
  LoginResponse,
  UserProfileResponse,
  ListUsersResponse,
} from "../../../application/dtos/user/response.dto";

/**
 * Create user routes
 */
export const createUserRoutes = <R>(runtime: Runtime.Runtime<R>) => {
  return (
    new Elysia({ prefix: "/users" })
      /**
       * POST /users/register
       * Register a new user
       */
      .post("/register", async ({ body, request }) => {
        const headers = Object.fromEntries(request.headers.entries());
        const effect = pipe(
          UserWorkflowTag,
          Effect.flatMap((userWorkflow) =>
            // Elysia body is untyped, validated by workflow
            userWorkflow.registerUser(
              body as { email: string; password: string; role?: string }
            )
          )
        );

        return runEffect(
          effect as Effect.Effect<any, any, R>,
          runtime,
          headers,
          RegisterResponse
        );
      })

      /**
       * POST /users/login
       * Authenticate user and return JWT token
       */
      .post("/login", async ({ body, request }) => {
        const headers = Object.fromEntries(request.headers.entries());
        const effect = pipe(
          UserWorkflowTag,
          Effect.flatMap((userWorkflow) =>
            userWorkflow.loginUser(body as { email: string; password: string })
          )
        );

        return runEffect(
          effect as Effect.Effect<any, any, R>,
          runtime,
          headers
        );
      })

      /**
       * GET /users/me
       * Get current user profile (requires authentication)
       */
      .get("/me", async ({ headers, request }) => {
        const reqHeaders = Object.fromEntries(request.headers.entries());
        const effect = pipe(
          UserWorkflowTag,
          Effect.flatMap((userWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                userWorkflow.getUserProfile({
                  userId: auth.userId,
                })
              )
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as Effect.Effect<any, any, R>,
          runtime,
          reqHeaders
        );
      })

      /**
       * PUT /users/me
       * Update current user profile (requires authentication)
       */
      .put("/me", async ({ headers, body, request }) => {
        const reqHeaders = Object.fromEntries(request.headers.entries());
        const effect = pipe(
          UserWorkflowTag,
          Effect.flatMap((userWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                userWorkflow.updateUserProfile(
                  auth.userId,
                  body as { email?: string; password?: string }
                )
              )
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as Effect.Effect<any, any, R>,
          runtime,
          reqHeaders
        );
      })

      /**
       * DELETE /users/me
       * Delete current user account (requires authentication)
       */
      .delete("/me", async ({ headers, request }) => {
        const reqHeaders = Object.fromEntries(request.headers.entries());
        const effect = pipe(
          UserWorkflowTag,
          Effect.flatMap((userWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                userWorkflow.deleteUser({ userId: auth.userId }, auth.userId)
              ),
              Effect.map(() => ({ message: "User deleted successfully" }))
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as Effect.Effect<any, any, R>,
          runtime,
          reqHeaders
        );
      })

      /**
       * GET /users/:userId
       * Get user by ID (requires authentication)
       */
      .get("/:userId", async ({ headers, params, request }) => {
        const reqHeaders = Object.fromEntries(request.headers.entries());
        const effect = pipe(
          UserWorkflowTag,
          Effect.flatMap((userWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap(() =>
                userWorkflow.getUserProfile({
                  userId: params.userId,
                })
              )
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as Effect.Effect<any, any, R>,
          runtime,
          reqHeaders
        );
      })

      /**
       * GET /users
       * List all users (requires authentication)
       */
      .get("/", async ({ headers, query, request }) => {
        const reqHeaders = Object.fromEntries(request.headers.entries());
        const effect = pipe(
          UserWorkflowTag,
          Effect.flatMap((userWorkflow) =>
            pipe(
              requireAuth(),
              Effect.flatMap((auth) =>
                userWorkflow.listUsers({
                  ...query,
                  userId: auth.userId,
                } as { page?: number; limit?: number; userId: string })
              )
            )
          )
        );

        return runEffect(
          withAuth(effect, headers.authorization) as Effect.Effect<any, any, R>,
          runtime,
          reqHeaders
        );
      })
  );
};
