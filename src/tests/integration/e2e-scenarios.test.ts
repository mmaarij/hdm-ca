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

        // Step 3: Owner uploads document (Two-phase upload)
        const initiateResult = yield* documentWorkflow.initiateUpload({
          filename: "project-plan.pdf" as any,
          originalName: "Project Plan.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 5120 as any,
          checksum: "sha256-scenario-test" as any,
          uploadedBy: ownerId,
        });

        console.log("✓ Upload initiated:", initiateResult.documentId);

        const confirmResult = yield* documentWorkflow.confirmUpload({
          documentId: initiateResult.documentId,
          userId: ownerId,
          checksum: "sha256-scenario-test" as any,
          storagePath: "/storage/project-plan.pdf" as any,
        });

        const documentId = confirmResult.documentId;
        console.log("✓ Upload confirmed:", documentId);

        // Step 4: Owner publishes document
        const publishResult = yield* documentWorkflow.publishDocument({
          documentId,
          userId: ownerId,
        });

        expect(publishResult.status).toBe("PUBLISHED");
        console.log("✓ Document published");

        // Step 5: Verify collaborator cannot access yet
        const accessAttempt = yield* Effect.either(
          documentWorkflow.getDocument({
            documentId,
            userId: collaboratorId,
          })
        );

        expect(accessAttempt._tag).toBe("Left"); // Should fail
        console.log("✓ Collaborator correctly denied access");

        // Step 6: Owner grants READ permission to collaborator
        const grantResult = yield* permissionWorkflow.grantPermission({
          documentId,
          userId: collaboratorId,
          permission: "READ",
          grantedBy: ownerId,
        });

        expect(grantResult.permission.permission).toBe("READ");
        console.log("✓ Permission granted to collaborator");

        // Step 7: Collaborator can now access document
        const collaboratorView = yield* documentWorkflow.getDocument({
          documentId,
          userId: collaboratorId,
        });

        expect(collaboratorView.document.id).toBe(documentId);
        expect(String(collaboratorView.document.filename)).toBe(
          "project-plan.pdf"
        );
        console.log("✓ Collaborator successfully accessed document");

        // Step 8: Verify collaborator cannot publish (no WRITE permission)
        const publishAttempt = yield* Effect.either(
          documentWorkflow.unpublishDocument({
            documentId,
            userId: collaboratorId,
          })
        );

        expect(publishAttempt._tag).toBe("Left"); // Should fail
        console.log("✓ Collaborator correctly denied publish access");

        // Step 9: Owner upgrades collaborator to WRITE permission
        const updatePermResult = yield* permissionWorkflow.grantPermission({
          documentId,
          userId: collaboratorId,
          permission: "WRITE",
          grantedBy: ownerId,
        });

        expect(updatePermResult.permission.permission).toBe("WRITE");
        console.log("✓ Permission upgraded to WRITE");

        // Step 10: Collaborator can now unpublish
        const unpublishResult = yield* documentWorkflow.unpublishDocument({
          documentId,
          userId: collaboratorId,
        });

        expect(unpublishResult.status).toBe("DRAFT");
        console.log("✓ Collaborator successfully unpublished document");

        return {
          owner: ownerRegister.user,
          collaborator: collaboratorRegister.user,
          document: collaboratorView.document,
          permission: updatePermResult.permission,
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
          filename: "research-paper.pdf" as any,
          originalName: "Research Paper.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 10240 as any,
          path: "/tmp/research.pdf" as any,
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
          filename: "user1-doc1.pdf" as any,
          originalName: "User1 Doc1.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 1024 as any,
          path: "/tmp/u1d1.pdf" as any,
          uploadedBy: user1.user.id,
        });

        const user1Doc2 = yield* documentWorkflow.uploadDocument({
          filename: "user1-doc2.pdf" as any,
          originalName: "User1 Doc2.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 2048 as any,
          path: "/tmp/u1d2.pdf" as any,
          uploadedBy: user1.user.id,
        });

        // User2 uploads 1 document
        const user2Doc1 = yield* documentWorkflow.uploadDocument({
          filename: "user2-doc1.pdf" as any,
          originalName: "User2 Doc1.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 3072 as any,
          path: "/tmp/u2d1.pdf" as any,
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
    test("Document creation → collaboration → version control → archive", async () => {
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

        // Phase 1: Document Creation
        const createResult = yield* documentWorkflow.uploadDocument({
          filename: "project-v1.pdf" as any,
          originalName: "Project Plan v1.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 8192 as any,
          path: "/tmp/project-v1.pdf" as any,
          uploadedBy: owner.user.id,
        });

        const documentId = createResult.documentId;
        console.log("✓ Phase 1: Document created");

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

        // Phase 5: Owner publishes
        yield* documentWorkflow.publishDocument({
          documentId,
          userId: owner.user.id,
        });

        console.log("✓ Phase 5: Document published");

        // Phase 6: Update metadata to published
        if (statusMetadata) {
          yield* metadataWorkflow.updateMetadata({
            metadataId: statusMetadata.id,
            userId: owner.user.id,
            value: "published" as any,
          });
        }

        console.log("✓ Phase 6: Metadata reflects published status");

        // Verify final state
        const finalDoc = yield* documentWorkflow.getDocument({
          documentId,
          userId: owner.user.id,
        });

        const finalMetadata = yield* metadataWorkflow.listMetadata({
          documentId,
          userId: owner.user.id,
        });

        expect(finalDoc.document.status).toBe("PUBLISHED");
        expect(finalMetadata.total).toBe(2);

        console.log("✓ Complete lifecycle test passed");

        return {
          document: finalDoc.document,
          metadata: finalMetadata.metadata,
        };
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });
  });
});
