/**
 * Application Entry Point
 *
 * Starts the Elysia HTTP server with all dependencies wired together
 */

import { Effect, Runtime, Layer, ConfigProvider, ManagedRuntime } from "effect";
import { AppLayer } from "./app/bootstrap";
import { startServer } from "./app/presentation/http/server";
import { loadServerConfig } from "./app/infrastructure/config/server.config";

/**
 * Load configuration
 */
const config = loadServerConfig();

console.log("Starting Application...\n");
console.log("Config loaded:", {
  port: config.port,
  environment: config.environment,
});

/**
 * Create managed runtime with full application layer
 */
const managedRuntime = ManagedRuntime.make(AppLayer as any);

/**
 * Build and start the server
 */
const program = Effect.promise(async () => {
  // Get the runtime
  const runtime = await managedRuntime.runtime();

  // Start HTTP server
  startServer(runtime, config.port);

  // Keep the process alive - block forever
  await new Promise(() => {});
});

/**
 * Run the application
 */
Effect.runPromise(program).catch((error) => {
  console.error("❌ Application failed to start:", error);
  process.exit(1);
});
