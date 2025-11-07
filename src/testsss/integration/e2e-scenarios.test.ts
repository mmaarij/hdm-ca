/**
 * End-to-End Scenario Tests
 *
 * Complete multi-workflow scenarios testing the entire system
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Effect, Layer } from "effect";
import {
  setupTestDatabase,
  cleanupTestDatabase,
  type TestDatabase,
} from "../setup";
import { resetFactories } from "../factories";
import {
  countUsers,
  countDocuments,
  getPermissionsForDocument,
} from "../helpers";
import {
  UserWorkflowTag,
  UserWorkflowLive,
} from "../../app/application/workflows/user-workflow";
import {
  DocumentWorkflowTag,
  DocumentWorkflowLive,
} from "../../app/application/workflows/document-workflow";
import {
  PermissionWorkflowTag,
  PermissionWorkflowLive,
} from "../../app/application/workflows/permission-workflow";
import {
  MetadataWorkflowTag,
  MetadataWorkflowLive,
} from "../../app/application/workflows/metadata-workflow";
import { UserRepositoryLive } from "../../app/infrastructure/repositories/user-repository.impl";
import { DocumentRepositoryLive } from "../../app/infrastructure/repositories/document-repository.impl";
import { PermissionRepositoryLive } from "../../app/infrastructure/repositories/permission-repository.impl";
import { MetadataRepositoryLive } from "../../app/infrastructure/repositories/metadata-repository.impl";
import { DrizzleService } from "../../app/infrastructure/services/drizzle-service";
import {
  MockStorageLive,
  MockPasswordHasherLive,
  MockJwtLive,
  resetMockStorage,
  createMockUploadedFile,
} from "../mocks";

describe("End-to-End Scenario Tests", () => {
  let db: TestDatabase;
  let testLayer: Layer.Layer<any, never, never>;

  beforeEach(() => {
    resetFactories();
    db = setupTestDatabase();
    resetMockStorage();

    // Build complete application layer with all workflows
    const dbLayer = Layer.succeed(DrizzleService, { db });

    const repositoryLayers = Layer.mergeAll(
      Layer.provide(UserRepositoryLive, dbLayer),
      Layer.provide(DocumentRepositoryLive, dbLayer),
      Layer.provide(PermissionRepositoryLive, dbLayer),
      Layer.provide(MetadataRepositoryLive, dbLayer)
    );

    const portLayers = Layer.mergeAll(
      MockStorageLive,
      MockPasswordHasherLive,
      MockJwtLive
    );

    const workflowLayers = Layer.mergeAll(
      Layer.provide(
        UserWorkflowLive,
        Layer.mergeAll(repositoryLayers, portLayers)
      ),
      Layer.provide(
        DocumentWorkflowLive,
        Layer.mergeAll(repositoryLayers, portLayers)
      ),
      Layer.provide(PermissionWorkflowLive, repositoryLayers),
      Layer.provide(MetadataWorkflowLive, repositoryLayers)
    );

    testLayer = workflowLayers;
  });

  afterEach(() => {
    cleanupTestDatabase(db);
    resetMockStorage();
  });

  describe("Complete Document Sharing Scenario", () => {
    test("Owner creates account → uploads document → grants permission → collaborator accesses", async () => {
      const program = Effect.gen(function* () {
        const userWorkflow = yield* UserWorkflowTag;
        const documentWorkflow = yield* DocumentWorkflowTag;
        const permissionWorkflow = yield* PermissionWorkflowTag;

        // Step 1: Owner registers
        const ownerRegister = yield* userWorkflow.registerUser({
          email: "owner@example.com" as any,
          password: "OwnerPass123!" as any,
          role: "USER",
        });

        const ownerId = ownerRegister.user.id;
        console.log("✓ Owner registered:", String(ownerRegister.user.email));

        // Step 2: Collaborator registers
        const collaboratorRegister = yield* userWorkflow.registerUser({
          email: "collaborator@example.com" as any,
          password: "CollabPass123!" as any,
          role: "USER",
        });

        const collaboratorId = collaboratorRegister.user.id;
        console.log(
          "✓ Collaborator registered:",
          String(collaboratorRegister.user.email)
        );

        // Step 3: Owner uploads document (Single-step upload)
        const uploadResult = yield* documentWorkflow.uploadDocument({
          file: createMockUploadedFile("project-plan.pdf", 5120),
          uploadedBy: ownerId,
        });

        const documentId = uploadResult.documentId;
        console.log("✓ Document uploaded:", documentId);

        // Step 4: Verify collaborator cannot access yet
        const accessAttempt = yield* Effect.either(
          documentWorkflow.getDocument({
            documentId,
            userId: collaboratorId,
          })
        );

        expect(accessAttempt._tag).toBe("Left"); // Should fail
        console.log("✓ Collaborator correctly denied access");

        // Step 5: Owner grants READ permission to collaborator
        const grantResult = yield* permissionWorkflow.grantPermission({
          documentId,
          userId: collaboratorId,
          permission: "READ",
          grantedBy: ownerId,
        });

        expect(grantResult.permission.permission).toBe("READ");
        console.log("✓ Permission granted to collaborator");

        // Step 6: Collaborator can now access document
        const collaboratorView = yield* documentWorkflow.getDocument({
          documentId,
          userId: collaboratorId,
        });

        expect(collaboratorView.document.id).toBe(documentId);
        expect(String(collaboratorView.document.filename)).toBe(
          "project-plan.pdf"
        );
        console.log("✓ Collaborator successfully accessed document");

        // Step 7: Verify collaborator cannot upload new version (no WRITE permission)
        const uploadAttempt = yield* Effect.either(
          documentWorkflow.uploadDocument({
            file: createMockUploadedFile("project-plan-v2.pdf", 6144),
            documentId,
            uploadedBy: collaboratorId,
          })
        );

        expect(uploadAttempt._tag).toBe("Left"); // Should fail
        console.log("✓ Collaborator correctly denied upload access");

        // Step 8: Owner upgrades collaborator to WRITE permission
        const updatePermResult = yield* permissionWorkflow.grantPermission({
          documentId,
          userId: collaboratorId,
          permission: "WRITE",
          grantedBy: ownerId,
        });

        expect(updatePermResult.permission.permission).toBe("WRITE");
        console.log("✓ Permission upgraded to WRITE");

        // Step 9: Collaborator can now upload new version
        const newVersionResult = yield* documentWorkflow.uploadDocument({
          file: createMockUploadedFile("project-plan-v2.pdf", 6144),
          documentId,
          uploadedBy: collaboratorId,
        });

        expect(newVersionResult.documentId).toBe(documentId);
        expect(Number(newVersionResult.version.versionNumber)).toBe(2);
        console.log("✓ Collaborator successfully uploaded new version");

        return {
          owner: ownerRegister.user,
          collaborator: collaboratorRegister.user,
          document: collaboratorView.document,
          permission: updatePermResult.permission,
          newVersion: newVersionResult.version,
        };
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      );

      // Final verifications
      expect(result.owner.id).toBeDefined();
      expect(result.collaborator.id).toBeDefined();
      expect(result.document.id).toBeDefined();
      expect(result.permission.permission).toBe("WRITE");
      expect(Number(result.newVersion.versionNumber)).toBe(2);
    });
  });

  describe("Document with Metadata Scenario", () => {
    test("User creates document → adds metadata → updates → searches", async () => {
      const program = Effect.gen(function* () {
        const userWorkflow = yield* UserWorkflowTag;
        const documentWorkflow = yield* DocumentWorkflowTag;
        const metadataWorkflow = yield* MetadataWorkflowTag;

        // Register user
        const userRegister = yield* userWorkflow.registerUser({
          email: "metadata-user@example.com" as any,
          password: "Password123!" as any,
          role: "USER",
        });

        const userId = userRegister.user.id;

        // Upload document
        const uploadResult = yield* documentWorkflow.uploadDocument({
          file: createMockUploadedFile("research-paper.pdf", 10240),
          uploadedBy: userId,
        });

        const documentId = uploadResult.documentId;

        // Add metadata
        const meta1 = yield* metadataWorkflow.addMetadata({
          documentId,
          userId,
          key: "author" as any,
          value: "Dr. Jane Smith" as any,
        });

        const meta2 = yield* metadataWorkflow.addMetadata({
          documentId,
          userId,
          key: "category" as any,
          value: "Research" as any,
        });

        const meta3 = yield* metadataWorkflow.addMetadata({
          documentId,
          userId,
          key: "year" as any,
          value: "2024" as any,
        });

        console.log("✓ Added 3 metadata entries");

        // List all metadata
        const allMetadata = yield* metadataWorkflow.listMetadata({
          documentId,
          userId,
        });

        expect(allMetadata.total).toBe(3);
        expect(
          allMetadata.metadata.some((m) => String(m.key) === "author")
        ).toBe(true);
        expect(
          allMetadata.metadata.some((m) => String(m.key) === "category")
        ).toBe(true);
        expect(allMetadata.metadata.some((m) => String(m.key) === "year")).toBe(
          true
        );

        console.log("✓ Listed all metadata");

        // Update metadata
        const updatedMeta = yield* metadataWorkflow.updateMetadata({
          metadataId: meta1.id,
          userId,
          value: "Dr. Jane Smith, PhD" as any,
        });

        expect(String(updatedMeta.value)).toBe("Dr. Jane Smith, PhD");
        console.log("✓ Updated metadata");

        // Get specific metadata by key
        const authorMeta = yield* metadataWorkflow.getMetadataByKey({
          documentId,
          userId,
          key: "author" as any,
        });

        expect(String(authorMeta.value)).toBe("Dr. Jane Smith, PhD");
        console.log("✓ Retrieved metadata by key");

        return {
          document: uploadResult.document,
          metadata: allMetadata.metadata,
        };
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      );
      expect(result.metadata.length).toBe(3);
    });
  });

  describe("Multi-User Multi-Document Scenario", () => {
    test("Multiple users with multiple documents and cross-permissions", async () => {
      const program = Effect.gen(function* () {
        const userWorkflow = yield* UserWorkflowTag;
        const documentWorkflow = yield* DocumentWorkflowTag;
        const permissionWorkflow = yield* PermissionWorkflowTag;

        // Create 3 users
        const user1 = yield* userWorkflow.registerUser({
          email: "user1@example.com" as any,
          password: "Password123!" as any,
          role: "USER",
        });

        const user2 = yield* userWorkflow.registerUser({
          email: "user2@example.com" as any,
          password: "Password123!" as any,
          role: "USER",
        });

        const user3 = yield* userWorkflow.registerUser({
          email: "user3@example.com" as any,
          password: "Password123!" as any,
          role: "USER",
        });

        console.log("✓ Created 3 users");

        // User1 uploads 2 documents
        const user1Doc1 = yield* documentWorkflow.uploadDocument({
          file: createMockUploadedFile("user1-doc1.pdf"),
          uploadedBy: user1.user.id,
        });

        const user1Doc2 = yield* documentWorkflow.uploadDocument({
          file: createMockUploadedFile("user1-doc2.pdf", 2048),
          uploadedBy: user1.user.id,
        });

        // User2 uploads 1 document
        const user2Doc1 = yield* documentWorkflow.uploadDocument({
          file: createMockUploadedFile("user2-doc1.pdf", 3072),
          uploadedBy: user2.user.id,
        });

        console.log("✓ Created 3 documents");
        expect(countDocuments(db)).toBe(3);

        // User1 grants READ to User2 on Doc1
        yield* permissionWorkflow.grantPermission({
          documentId: user1Doc1.documentId,
          userId: user2.user.id,
          permission: "READ",
          grantedBy: user1.user.id,
        });

        // User1 grants WRITE to User3 on Doc2
        yield* permissionWorkflow.grantPermission({
          documentId: user1Doc2.documentId,
          userId: user3.user.id,
          permission: "WRITE",
          grantedBy: user1.user.id,
        });

        // User2 grants READ to User3 on their doc
        yield* permissionWorkflow.grantPermission({
          documentId: user2Doc1.documentId,
          userId: user3.user.id,
          permission: "READ",
          grantedBy: user2.user.id,
        });

        console.log("✓ Granted cross-permissions");

        // Verify User3 can access both shared documents
        const user3Access1 = yield* documentWorkflow.getDocument({
          documentId: user1Doc2.documentId,
          userId: user3.user.id,
        });

        const user3Access2 = yield* documentWorkflow.getDocument({
          documentId: user2Doc1.documentId,
          userId: user3.user.id,
        });

        expect(user3Access1.document.id).toBe(user1Doc2.documentId);
        expect(user3Access2.document.id).toBe(user2Doc1.documentId);

        console.log("✓ User3 successfully accessed shared documents");

        // Verify User2 can access User1's Doc1 but not Doc2
        const user2Access = yield* documentWorkflow.getDocument({
          documentId: user1Doc1.documentId,
          userId: user2.user.id,
        });

        expect(user2Access.document.id).toBe(user1Doc1.documentId);

        // User2 should not be able to access User1's Doc2
        const user2FailedAccess = yield* Effect.either(
          documentWorkflow.getDocument({
            documentId: user1Doc2.documentId,
            userId: user2.user.id,
          })
        );

        expect(user2FailedAccess._tag).toBe("Left"); // Should fail
        console.log("✓ User2 correctly denied access to User1's Doc2");

        return {
          users: [user1.user, user2.user, user3.user],
          documentCount: countDocuments(db),
          userCount: countUsers(db),
        };
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      );

      expect(result.users.length).toBe(3);
      expect(result.documentCount).toBe(3);
      expect(result.userCount).toBe(3);
    });
  });

  describe("Complete Lifecycle Test", () => {
    test("Document creation → collaboration → version control → metadata", async () => {
      const program = Effect.gen(function* () {
        const userWorkflow = yield* UserWorkflowTag;
        const documentWorkflow = yield* DocumentWorkflowTag;
        const permissionWorkflow = yield* PermissionWorkflowTag;
        const metadataWorkflow = yield* MetadataWorkflowTag;

        // Setup: Create owner and editor
        const owner = yield* userWorkflow.registerUser({
          email: "project-owner@example.com" as any,
          password: "OwnerPass123!" as any,
          role: "USER",
        });

        const editor = yield* userWorkflow.registerUser({
          email: "project-editor@example.com" as any,
          password: "EditorPass123!" as any,
          role: "USER",
        });

        // Phase 1: Document Creation (version 1)
        const createResult = yield* documentWorkflow.uploadDocument({
          file: createMockUploadedFile("project-v1.pdf", 8192),
          uploadedBy: owner.user.id,
        });

        const documentId = createResult.documentId;
        expect(Number(createResult.version.versionNumber)).toBe(1);
        console.log("✓ Phase 1: Document created (version 1)");

        // Phase 2: Add initial metadata
        yield* metadataWorkflow.addMetadata({
          documentId,
          userId: owner.user.id,
          key: "status" as any,
          value: "draft" as any,
        });

        yield* metadataWorkflow.addMetadata({
          documentId,
          userId: owner.user.id,
          key: "version" as any,
          value: "1.0" as any,
        });

        console.log("✓ Phase 2: Metadata added");

        // Phase 3: Grant edit access to editor
        yield* permissionWorkflow.grantPermission({
          documentId,
          userId: editor.user.id,
          permission: "WRITE",
          grantedBy: owner.user.id,
        });

        console.log("✓ Phase 3: Editor granted WRITE access");

        // Phase 4: Editor updates document metadata
        const metadata = yield* metadataWorkflow.listMetadata({
          documentId,
          userId: editor.user.id,
        });

        const statusMetadata = metadata.metadata.find(
          (m) => String(m.key) === "status"
        );

        if (statusMetadata) {
          yield* metadataWorkflow.updateMetadata({
            metadataId: statusMetadata.id,
            userId: editor.user.id,
            value: "reviewed" as any,
          });
        }

        console.log("✓ Phase 4: Metadata updated by editor");

        // Phase 5: Editor uploads new version (version 2)
        const v2Result = yield* documentWorkflow.uploadDocument({
          file: createMockUploadedFile("project-v2.pdf", 9216),
          documentId,
          uploadedBy: editor.user.id,
        });

        expect(Number(v2Result.version.versionNumber)).toBe(2);
        console.log("✓ Phase 5: New version uploaded by editor (version 2)");

        // Phase 6: Update metadata to reflect new version
        const versionMetadata = metadata.metadata.find(
          (m) => String(m.key) === "version"
        );

        if (versionMetadata) {
          yield* metadataWorkflow.updateMetadata({
            metadataId: versionMetadata.id,
            userId: editor.user.id,
            value: "2.0" as any,
          });
        }

        if (statusMetadata) {
          yield* metadataWorkflow.updateMetadata({
            metadataId: statusMetadata.id,
            userId: owner.user.id,
            value: "published" as any,
          });
        }

        console.log("✓ Phase 6: Metadata reflects published status");

        // Phase 7: Owner uploads final version (version 3)
        const v3Result = yield* documentWorkflow.uploadDocument({
          file: createMockUploadedFile("project-final.pdf", 10240),
          documentId,
          uploadedBy: owner.user.id,
        });

        expect(Number(v3Result.version.versionNumber)).toBe(3);
        console.log("✓ Phase 7: Final version uploaded (version 3)");

        // Verify final state
        const finalDoc = yield* documentWorkflow.getDocument({
          documentId,
          userId: owner.user.id,
        });

        const finalMetadata = yield* metadataWorkflow.listMetadata({
          documentId,
          userId: owner.user.id,
        });

        expect(finalDoc.document.id).toBe(documentId);
        expect(finalDoc.latestVersion).toBeDefined();
        expect(Number(finalDoc.latestVersion!.versionNumber)).toBe(3);
        expect(finalMetadata.total).toBe(2);

        console.log("✓ Complete lifecycle test passed");

        return {
          document: finalDoc.document,
          metadata: finalMetadata.metadata,
          latestVersion: finalDoc.latestVersion!,
        };
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      );

      expect(Number(result.latestVersion.versionNumber)).toBe(3);
      expect(result.metadata.length).toBe(2);
    });
  });
});
