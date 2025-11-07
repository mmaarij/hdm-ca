/**
 * Application Bootstrap
 *
 * Creates the full application runtime with all dependencies wired together
 */

import { Effect, Layer, Runtime, Context } from "effect";

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

// Domain - Repository Tags
import { UserRepositoryTag } from "./domain/user/repository";
import { DocumentRepositoryTag } from "./domain/document/repository";
import { PermissionRepositoryTag } from "./domain/permission/repository";
import { MetadataRepositoryTag } from "./domain/metedata/repository";
import { DownloadTokenRepositoryTag } from "./domain/download-token/repository";

// Application - Port Tags
import { PasswordHasherPortTag } from "./application/ports/password-hasher.port";
import { JwtPortTag } from "./application/ports/jwt.port";
import { StoragePortTag } from "./application/ports/storage.port";

// Application - Workflow Functions
import * as UserWorkflows from "./application/workflows/user-workflow";
import * as DocumentWorkflows from "./application/workflows/document-workflow";
import * as PermissionWorkflows from "./application/workflows/permission-workflow";
import * as MetadataWorkflows from "./application/workflows/metadata-workflow";
import * as DownloadTokenWorkflows from "./application/workflows/download-token-workflow";

/**
 * Workflow Interfaces (for compatibility with existing routes)
 */
export interface UserWorkflow {
  readonly registerUser: typeof UserWorkflows.registerUser extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly loginUser: typeof UserWorkflows.loginUser extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly getUserProfile: typeof UserWorkflows.getUserProfile extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly updateUserProfile: typeof UserWorkflows.updateUserProfile extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly listUsers: typeof UserWorkflows.listUsers extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly deleteUser: typeof UserWorkflows.deleteUser extends (
    deps: any
  ) => infer R
    ? R
    : never;
}

export interface DocumentWorkflow {
  readonly uploadDocument: typeof DocumentWorkflows.uploadDocument extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly getDocument: typeof DocumentWorkflows.getDocument extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly getDocumentVersion: typeof DocumentWorkflows.getDocumentVersion extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly listDocumentVersions: typeof DocumentWorkflows.listDocumentVersions extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly listDocuments: typeof DocumentWorkflows.listDocuments extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly listAllDocuments: typeof DocumentWorkflows.listAllDocuments extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly searchDocuments: typeof DocumentWorkflows.searchDocuments extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly deleteDocument: typeof DocumentWorkflows.deleteDocument extends (
    deps: any
  ) => infer R
    ? R
    : never;
}

export interface PermissionWorkflow {
  readonly grantPermission: typeof PermissionWorkflows.grantPermission extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly updatePermission: typeof PermissionWorkflows.updatePermission extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly revokePermission: typeof PermissionWorkflows.revokePermission extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly listDocumentPermissions: typeof PermissionWorkflows.listDocumentPermissions extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly listUserPermissions: typeof PermissionWorkflows.listUserPermissions extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly checkPermission: typeof PermissionWorkflows.checkPermission extends (
    deps: any
  ) => infer R
    ? R
    : never;
}

export interface MetadataWorkflow {
  readonly addMetadata: typeof MetadataWorkflows.addMetadata extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly updateMetadata: typeof MetadataWorkflows.updateMetadata extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly deleteMetadata: typeof MetadataWorkflows.deleteMetadata extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly listMetadata: typeof MetadataWorkflows.listMetadata extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly getMetadataByKey: typeof MetadataWorkflows.getMetadataByKey extends (
    deps: any
  ) => infer R
    ? R
    : never;
}

export interface DownloadTokenWorkflow {
  readonly generateDownloadLink: typeof DownloadTokenWorkflows.generateDownloadLink extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly validateToken: typeof DownloadTokenWorkflows.validateToken extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly downloadFile: typeof DownloadTokenWorkflows.downloadFile extends (
    deps: any
  ) => infer R
    ? R
    : never;
  readonly cleanupExpiredTokens: typeof DownloadTokenWorkflows.cleanupExpiredTokens extends (
    deps: any
  ) => infer R
    ? R
    : never;
}

// Workflow Context Tags
export const UserWorkflowTag =
  Context.GenericTag<UserWorkflow>("@app/UserWorkflow");
export const DocumentWorkflowTag = Context.GenericTag<DocumentWorkflow>(
  "@app/DocumentWorkflow"
);
export const PermissionWorkflowTag = Context.GenericTag<PermissionWorkflow>(
  "@app/PermissionWorkflow"
);
export const MetadataWorkflowTag = Context.GenericTag<MetadataWorkflow>(
  "@app/MetadataWorkflow"
);
export const DownloadTokenWorkflowTag =
  Context.GenericTag<DownloadTokenWorkflow>("@app/DownloadTokenWorkflow");

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

// Layer 3: Workflow Layers - wrap functional workflows with Layer pattern
const UserWorkflowLive = Layer.effect(
  UserWorkflowTag,
  Effect.gen(function* () {
    const userRepo = yield* UserRepositoryTag;
    const passwordHasher = yield* PasswordHasherPortTag;
    const jwtService = yield* JwtPortTag;

    const deps: UserWorkflows.UserWorkflowDeps = {
      userRepo,
      passwordHasher,
      jwtService,
    };

    return {
      registerUser: UserWorkflows.registerUser(deps),
      loginUser: UserWorkflows.loginUser(deps),
      getUserProfile: UserWorkflows.getUserProfile(deps),
      updateUserProfile: UserWorkflows.updateUserProfile(deps),
      listUsers: UserWorkflows.listUsers(deps),
      deleteUser: UserWorkflows.deleteUser(deps),
    } satisfies UserWorkflow;
  })
);

const DocumentWorkflowLive = Layer.effect(
  DocumentWorkflowTag,
  Effect.gen(function* () {
    const documentRepo = yield* DocumentRepositoryTag;
    const userRepo = yield* UserRepositoryTag;
    const permissionRepo = yield* PermissionRepositoryTag;
    const storageService = yield* StoragePortTag;

    const deps: DocumentWorkflows.DocumentWorkflowDeps = {
      documentRepo,
      userRepo,
      permissionRepo,
      storageService,
    };

    return {
      uploadDocument: DocumentWorkflows.uploadDocument(deps),
      getDocument: DocumentWorkflows.getDocument(deps),
      getDocumentVersion: DocumentWorkflows.getDocumentVersion(deps),
      listDocumentVersions: DocumentWorkflows.listDocumentVersions(deps),
      listDocuments: DocumentWorkflows.listDocuments(deps),
      listAllDocuments: DocumentWorkflows.listAllDocuments(deps),
      searchDocuments: DocumentWorkflows.searchDocuments(deps),
      deleteDocument: DocumentWorkflows.deleteDocument(deps),
    } satisfies DocumentWorkflow;
  })
);

const PermissionWorkflowLive = Layer.effect(
  PermissionWorkflowTag,
  Effect.gen(function* () {
    const permissionRepo = yield* PermissionRepositoryTag;
    const documentRepo = yield* DocumentRepositoryTag;
    const userRepo = yield* UserRepositoryTag;

    const deps: PermissionWorkflows.PermissionWorkflowDeps = {
      permissionRepo,
      documentRepo,
      userRepo,
    };

    return {
      grantPermission: PermissionWorkflows.grantPermission(deps),
      updatePermission: PermissionWorkflows.updatePermission(deps),
      revokePermission: PermissionWorkflows.revokePermission(deps),
      listDocumentPermissions:
        PermissionWorkflows.listDocumentPermissions(deps),
      listUserPermissions: PermissionWorkflows.listUserPermissions(deps),
      checkPermission: PermissionWorkflows.checkPermission(deps),
    } satisfies PermissionWorkflow;
  })
);

const MetadataWorkflowLive = Layer.effect(
  MetadataWorkflowTag,
  Effect.gen(function* () {
    const metadataRepo = yield* MetadataRepositoryTag;
    const documentRepo = yield* DocumentRepositoryTag;
    const userRepo = yield* UserRepositoryTag;
    const permissionRepo = yield* PermissionRepositoryTag;

    const deps: MetadataWorkflows.MetadataWorkflowDeps = {
      metadataRepo,
      documentRepo,
      userRepo,
      permissionRepo,
    };

    return {
      addMetadata: MetadataWorkflows.addMetadata(deps),
      updateMetadata: MetadataWorkflows.updateMetadata(deps),
      deleteMetadata: MetadataWorkflows.deleteMetadata(deps),
      listMetadata: MetadataWorkflows.listMetadata(deps),
      getMetadataByKey: MetadataWorkflows.getMetadataByKey(deps),
    } satisfies MetadataWorkflow;
  })
);

const DownloadTokenWorkflowLive = Layer.effect(
  DownloadTokenWorkflowTag,
  Effect.gen(function* () {
    const tokenRepo = yield* DownloadTokenRepositoryTag;
    const documentRepo = yield* DocumentRepositoryTag;
    const userRepo = yield* UserRepositoryTag;
    const permissionRepo = yield* PermissionRepositoryTag;

    const deps: DownloadTokenWorkflows.DownloadTokenWorkflowDeps = {
      tokenRepo,
      documentRepo,
      userRepo,
      permissionRepo,
    };

    return {
      generateDownloadLink: DownloadTokenWorkflows.generateDownloadLink(deps),
      validateToken: DownloadTokenWorkflows.validateToken(deps),
      downloadFile: DownloadTokenWorkflows.downloadFile(deps),
      cleanupExpiredTokens: DownloadTokenWorkflows.cleanupExpiredTokens(deps),
    } satisfies DownloadTokenWorkflow;
  })
);

// Workflow Layer (depends on Repositories and Adapters)
const WorkflowLayer = Layer.provide(
  Layer.mergeAll(
    UserWorkflowLive,
    DocumentWorkflowLive,
    PermissionWorkflowLive,
    MetadataWorkflowLive,
    DownloadTokenWorkflowLive
  ),
  Layer.mergeAll(BaseLayer, RepositoryLayer)
);

// Final composed layer
export const AppLayer = Layer.mergeAll(
  BaseLayer,
  RepositoryLayer,
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
