/**
 * Elysia HTTP Server
 *
 * Main server setup with all routes and middleware
 */

import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { Effect, Runtime, Layer } from "effect";
import { createUserRoutes } from "./routes/user.routes";
import { createDocumentRoutes } from "./routes/document.routes";
import { createPermissionRoutes } from "./routes/permission.routes";
import { createMetadataRoutes } from "./routes/metadata.routes";
import { createDownloadRoutes } from "./routes/download.routes";
import { createUploadRoutes } from "./routes/upload.routes";
import { mapErrorToStatus, type HttpErrorResponse } from "./utils/error-mapper";
import { HttpError } from "./utils/handler";
import {
  extractCorrelationIdFromHeaders,
  withNewCorrelationId,
} from "./middleware/correlation.middleware";

/**
 * Create Elysia server with all routes
 */
export const createServer = <R>(runtime: Runtime.Runtime<R>) => {
  const app = new Elysia()
    // Swagger documentation
    .use(
      swagger({
        documentation: {
          info: {
            title: "HDM API Documentation",
            version: "2.0.0",
            description: "Hierarchical Document Management System API",
          },
          tags: [
            { name: "users", description: "User management endpoints" },
            { name: "documents", description: "Document management endpoints" },
            {
              name: "permissions",
              description: "Permission management endpoints",
            },
            { name: "metadata", description: "Metadata management endpoints" },
            { name: "downloads", description: "Document download endpoints" },
          ],
        },
      })
    )

    // Correlation ID middleware (must be before routes)
    .onRequest(({ request, set }) => {
      // Extract correlation ID from headers or generate new one
      const headers = Object.fromEntries(request.headers.entries());
      const correlationId = extractCorrelationIdFromHeaders(headers);

      // Set response header for correlation tracking
      set.headers["x-correlation-id"] = correlationId;

      // Note: The actual Effect FiberRef will be set when running effects in routes
      // This just ensures the header is available
    })

    // Global error handler
    .onError(({ code, error, set, request }) => {
      // Get correlation ID from response headers (set in onRequest)
      const correlationId =
        set.headers["x-correlation-id"] || "unknown-correlation-id";

      console.error("[HTTP Error]", { code, error, correlationId });

      // Handle HttpError (our custom error type)
      if (error instanceof HttpError) {
        set.status = error.status;
        return error.toJSON();
      }

      // Handle HttpErrorResponse (from error mapper)
      if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        "error" in error
      ) {
        const httpError = error as HttpErrorResponse;
        set.status = httpError.status;
        return httpError;
      }

      // Handle generic errors
      if (error instanceof Error) {
        const httpError = mapErrorToStatus(error);
        set.status = httpError.status;
        return httpError;
      }

      // Fallback
      set.status = 500;
      return {
        status: 500,
        error: "Internal Server Error",
        message: "An unexpected error occurred",
      };
    })

    // Health check endpoint
    .get("/health", () => ({
      status: "healthy",
      timestamp: new Date().toISOString(),
    }))

    // API routes
    .use(createUserRoutes(runtime))
    .use(createDocumentRoutes(runtime))
    .use(createPermissionRoutes(runtime))
    .use(createMetadataRoutes(runtime))
    .use(createDownloadRoutes(runtime))
    .use(createUploadRoutes(runtime));

  return app;
};

/**
 * Start server
 */
export const startServer = <R>(
  runtime: Runtime.Runtime<R>,
  port: number = 3000
) => {
  const app = createServer(runtime);

  app.listen(port);

  console.log(`Server is running at http://localhost:${port}`);

  return app;
};
