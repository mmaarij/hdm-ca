/**
 * Application Bootstrap
 *
 * Creates the full application runtime with all dependencies wired together
 */

import { Effect, Layer, Runtime } from "effect";

// Infrastructure - Database
import { DrizzleServiceLive } from "./infrastructure/services/drizzle-service";

// Infrastructure - Adapters
import { BcryptPasswordHasherLive } from "./infrastructure/adapters/bcrypt-password-hasher.adapter";
import { JwtServiceLive } from "./infrastructure/adapters/jwt-token.adapter";
import { LocalStorageLive } from "./infrastructure/adapters/local-storage.adapter";

// Infrastructure - Repositories
import { UserRepositoryLive } from "./infrastructure/repositories/user-repository.impl";
import { DocumentRepositoryLive } from "./infrastructure/repositories/document-repository.impl";
import { PermissionRepositoryLive } from "./infrastructure/repositories/permission-repository.impl";
import { MetadataRepositoryLive } from "./infrastructure/repositories/metadata-repository.impl";
import { DownloadTokenRepositoryLive } from "./infrastructure/repositories/download-token-repository.impl";

// Domain - Services
import { DocumentServiceLive } from "./domain/document/service";

// Application - Workflows
import { UserWorkflowLive } from "./application/workflows/user-workflow";
import { DocumentWorkflowLive } from "./application/workflows/document-workflow";
import { PermissionWorkflowLive } from "./application/workflows/permission-workflow";
import { MetadataWorkflowLive } from "./application/workflows/metadata-workflow";
import { DownloadTokenWorkflowLive } from "./application/workflows/download-token-workflow";
import { DocumentVersionWorkflowLive } from "./application/workflows/document-version-workflow";

/**
 * Application Layer
 *
 * Combines all infrastructure and application layers in dependency order
 */

// Layer 1: Base infrastructure (no dependencies)
const BaseLayer = Layer.mergeAll(
  DrizzleServiceLive,
  BcryptPasswordHasherLive,
  JwtServiceLive,
  LocalStorageLive
);

// Layer 2: Repositories (depend on DrizzleService)
const RepositoryLayer = Layer.provide(
  Layer.mergeAll(
    UserRepositoryLive,
    DocumentRepositoryLive,
    PermissionRepositoryLive,
    MetadataRepositoryLive,
    DownloadTokenRepositoryLive
  ),
  BaseLayer
);

// Layer 3: Domain Services (depend on Repositories)
const DomainServiceLayer = Layer.provide(
  DocumentServiceLive,
  Layer.merge(BaseLayer, RepositoryLayer)
);

// Layer 4: Application Workflows (depend on Repositories, Services, and Adapters)
const WorkflowLayer = Layer.provide(
  Layer.mergeAll(
    UserWorkflowLive,
    DocumentWorkflowLive,
    PermissionWorkflowLive,
    MetadataWorkflowLive,
    DownloadTokenWorkflowLive,
    DocumentVersionWorkflowLive
  ),
  Layer.mergeAll(BaseLayer, RepositoryLayer, DomainServiceLayer)
);

// Final composed layer
export const AppLayer = Layer.mergeAll(
  BaseLayer,
  RepositoryLayer,
  DomainServiceLayer,
  WorkflowLayer
);

/**
 * Create application runtime with all dependencies
 */
export const makeAppRuntime = Layer.toRuntime(AppLayer);

/**
 * Provide the application layer to an effect and run it
 */
export const runApp = <A, E>(effect: Effect.Effect<A, E, any>) => {
  return Effect.provide(effect, AppLayer);
};
