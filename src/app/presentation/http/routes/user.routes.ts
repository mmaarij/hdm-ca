/**
 * User Routes
 *
 * HTTP endpoints for user operations (registration, login, profile management)
 */

import { Elysia } from "elysia";
import { Effect } from "effect";
import type { Runtime } from "effect";
import { UserWorkflowTag } from "../../../application/workflows/user-workflow";
import * as UserDTOs from "../../../application/dtos/user";
import { validateBody, validateQuery } from "../utils/schema-validation";
import { runEffect } from "../utils/handler";
import { withAuth, requireAuth } from "../middleware/auth.middleware";

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
        const effect = Effect.gen(function* () {
          const userWorkflow = yield* UserWorkflowTag;
          const command = yield* validateBody(
            UserDTOs.RegisterUserCommand,
            body
          );
          const result = yield* userWorkflow.registerUser(command);
          return result;
        });

        return runEffect(effect as any, runtime, headers);
      })

      /**
       * POST /users/login
       * Authenticate user and return JWT token
       */
      .post("/login", async ({ body, request }) => {
        const headers = Object.fromEntries(request.headers.entries());
        const effect = Effect.gen(function* () {
          const userWorkflow = yield* UserWorkflowTag;
          const command = yield* validateBody(UserDTOs.LoginUserCommand, body);
          const result = yield* userWorkflow.loginUser(command);
          return result;
        });

        return runEffect(effect as any, runtime, headers);
      })

      /**
       * GET /users/me
       * Get current user profile (requires authentication)
       */
      .get("/me", async ({ headers, request }) => {
        const reqHeaders = Object.fromEntries(request.headers.entries());
        const effect = Effect.gen(function* () {
          const userWorkflow = yield* UserWorkflowTag;
          const auth = yield* requireAuth();
          const result = yield* userWorkflow.getUserProfile({
            userId: auth.userId as any,
          });
          return result;
        });

        return runEffect(
          withAuth(effect, headers.authorization) as any,
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
        const effect = Effect.gen(function* () {
          const userWorkflow = yield* UserWorkflowTag;
          const auth = yield* requireAuth();
          const command = yield* validateBody(
            UserDTOs.UpdateUserProfileCommand,
            body
          );
          const result = yield* userWorkflow.updateUserProfile(
            auth.userId as any,
            command
          );
          return result;
        });

        return runEffect(
          withAuth(effect, headers.authorization) as any,
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
        const effect = Effect.gen(function* () {
          const userWorkflow = yield* UserWorkflowTag;
          const auth = yield* requireAuth();
          yield* userWorkflow.deleteUser(
            { userId: auth.userId as any },
            auth.userId as any
          );
          return { message: "User deleted successfully" };
        });

        return runEffect(
          withAuth(effect, headers.authorization) as any,
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
        const effect = Effect.gen(function* () {
          const userWorkflow = yield* UserWorkflowTag;
          yield* requireAuth();
          const result = yield* userWorkflow.getUserProfile({
            userId: params.userId as any,
          });
          return result;
        });

        return runEffect(
          withAuth(effect, headers.authorization) as any,
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
        const effect = Effect.gen(function* () {
          const userWorkflow = yield* UserWorkflowTag;
          yield* requireAuth();
          const queryParams = yield* validateQuery(
            UserDTOs.ListUsersQuery,
            query
          );
          const result = yield* userWorkflow.listUsers(queryParams);
          return result;
        });

        return runEffect(
          withAuth(effect, headers.authorization) as any,
          runtime,
          reqHeaders
        );
      })
  );
};
