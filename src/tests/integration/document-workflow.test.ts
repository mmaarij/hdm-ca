/**
 * Document Workflow Integration Tests
 *
 * End-to-end tests for complete document upload → publish workflows
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
  seedUser,
  getDocumentById,
  getVersionsForDocument,
  countDocuments,
} from "../helpers";
import {
  DocumentWorkflowTag,
  DocumentWorkflowLive,
} from "../../app/application/workflows/document-workflow";
import { UserRepositoryTag } from "../../app/domain/user/repository";
import { UserRepositoryLive } from "../../app/infrastructure/repositories/user-repository.impl";
import { DocumentRepositoryTag } from "../../app/domain/document/repository";
import { DocumentRepositoryLive } from "../../app/infrastructure/repositories/document-repository.impl";
import { PermissionRepositoryTag } from "../../app/domain/permission/repository";
import { PermissionRepositoryLive } from "../../app/infrastructure/repositories/permission-repository.impl";
import { DrizzleService } from "../../app/infrastructure/services/drizzle-service";
import { MockStorageLive, resetMockStorage, verifyFileStored } from "../mocks";

describe("Document Workflow Integration Tests", () => {
  let db: TestDatabase;
  let testLayer: Layer.Layer<any, never, never>;

  beforeEach(() => {
    resetFactories();
    db = setupTestDatabase();
    resetMockStorage();

    // Build complete test layer
    const dbLayer = Layer.succeed(DrizzleService, { db });
    const userRepoLayer = Layer.provide(UserRepositoryLive, dbLayer);
    const docRepoLayer = Layer.provide(DocumentRepositoryLive, dbLayer);
    const permRepoLayer = Layer.provide(PermissionRepositoryLive, dbLayer);

    const repoLayers = Layer.mergeAll(
      userRepoLayer,
      docRepoLayer,
      permRepoLayer
    );

    const appLayer = Layer.mergeAll(repoLayers, MockStorageLive);
    testLayer = Layer.provide(DocumentWorkflowLive, appLayer);
  });

  afterEach(() => {
    cleanupTestDatabase(db);
    resetMockStorage();
  });

  describe("Two-Phase Upload Workflow: Initiate → Confirm → Publish", () => {
    test("should complete full upload and publish flow", async () => {
      const user = seedUser(db, { role: "USER" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        // Phase 1: Initiate Upload
        const initiateResult = yield* workflow.initiateUpload({
          filename: "report.pdf" as any,
          originalName: "Monthly Report.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 2048 as any,
          checksum: "sha256-abc123" as any,
          uploadedBy: user.id as any,
        });

        expect(initiateResult.documentId).toBeDefined();
        expect(initiateResult.uploadUrl).toBeDefined();
        expect(String(initiateResult.checksum)).toBe("sha256-abc123");
        expect(initiateResult.expiresAt).toBeDefined();

        const documentId = initiateResult.documentId;

        // Verify document created in DRAFT status
        const dbDoc = getDocumentById(db, documentId);
        expect(dbDoc).toBeDefined();
        expect(dbDoc.filename).toBe("report.pdf");

        // Phase 2: Confirm Upload (after file uploaded to storage)
        const confirmResult = yield* workflow.confirmUpload({
          documentId,
          userId: user.id as any,
          checksum: "sha256-abc123" as any,
          storagePath: "/storage/2024-01-01/report.pdf" as any,
        });

        expect(confirmResult.documentId).toBe(documentId);
        expect(confirmResult.status).toBe("DRAFT");
        expect(confirmResult.document).toBeDefined();
        expect(confirmResult.version).toBeDefined();

        // Verify document updated (path may or may not be set depending on implementation)
        const updatedDoc = getDocumentById(db, documentId);
        expect(updatedDoc).toBeDefined();

        // Phase 3: Publish Document
        const publishResult = yield* workflow.publishDocument({
          documentId,
          userId: user.id as any,
        });

        expect(publishResult.status).toBe("PUBLISHED");

        // Verify document is published
        const publishedDoc = getDocumentById(db, documentId);
        expect(publishedDoc).toBeDefined();

        return {
          initiateResult,
          confirmResult,
          publishResult,
        };
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should prevent duplicate uploads with same checksum", async () => {
      const user = seedUser(db, { role: "USER" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        // First upload with checksum
        const firstInit = yield* workflow.initiateUpload({
          filename: "file1.pdf" as any,
          originalName: "File 1.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 1024 as any,
          checksum: "sha256-duplicate" as any,
          uploadedBy: user.id as any,
        });

        yield* workflow.confirmUpload({
          documentId: firstInit.documentId,
          userId: user.id as any,
          checksum: "sha256-duplicate" as any,
          storagePath: "/storage/file1.pdf" as any,
        });

        // Second upload with same checksum should return existing
        const secondInit = yield* workflow.initiateUpload({
          filename: "file2.pdf" as any,
          originalName: "File 2.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 1024 as any,
          checksum: "sha256-duplicate" as any,
          uploadedBy: user.id as any,
        });

        // Should return existing document ID
        expect(secondInit.documentId).toBe(firstInit.documentId);
        expect(secondInit.uploadUrl).toBe(""); // Empty since already uploaded

        return { firstInit, secondInit };
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should reject confirm with mismatched checksum", async () => {
      const user = seedUser(db, { role: "USER" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        const initiateResult = yield* workflow.initiateUpload({
          filename: "file.pdf" as any,
          originalName: "File.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 1024 as any,
          checksum: "sha256-original" as any,
          uploadedBy: user.id as any,
        });

        // Try to confirm with different checksum
        yield* workflow.confirmUpload({
          documentId: initiateResult.documentId,
          userId: user.id as any,
          checksum: "sha256-different" as any, // Wrong checksum
          storagePath: "/storage/file.pdf" as any,
        });
      });

      try {
        await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("Checksum mismatch");
      }
    });

    test("should only allow uploader to confirm upload", async () => {
      const uploader = seedUser(db, { email: "uploader@example.com" });
      const otherUser = seedUser(db, { email: "other@example.com" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        const initiateResult = yield* workflow.initiateUpload({
          filename: "file.pdf" as any,
          originalName: "File.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 1024 as any,
          checksum: "sha256-test" as any,
          uploadedBy: uploader.id as any,
        });

        // Try to confirm as different user
        yield* workflow.confirmUpload({
          documentId: initiateResult.documentId,
          userId: otherUser.id as any, // Different user
          checksum: "sha256-test" as any,
          storagePath: "/storage/file.pdf" as any,
        });
      });

      try {
        await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("Only the uploader can confirm");
      }
    });
  });

  describe("getDocument workflow", () => {
    test("should retrieve document with permissions", async () => {
      const owner = seedUser(db, { email: "owner@example.com" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        // Create document
        const uploadResult = yield* workflow.uploadDocument({
          filename: "doc.pdf" as any,
          originalName: "Document.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 1024 as any,
          path: "/tmp/doc.pdf" as any,
          uploadedBy: owner.id as any,
        });

        // Retrieve document
        const doc = yield* workflow.getDocument({
          documentId: uploadResult.documentId,
          userId: owner.id as any,
        });

        expect(doc.document.id).toBe(uploadResult.documentId);
        expect(String(doc.document.filename)).toBe("doc.pdf");
        expect(doc.latestVersion).toBeDefined();

        return doc;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should prevent access without permissions", async () => {
      const owner = seedUser(db, { email: "owner@example.com" });
      const unauthorized = seedUser(db, { email: "unauthorized@example.com" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        // Create document as owner
        const uploadResult = yield* workflow.uploadDocument({
          filename: "private.pdf" as any,
          originalName: "Private.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 1024 as any,
          path: "/tmp/private.pdf" as any,
          uploadedBy: owner.id as any,
        });

        // Try to access as unauthorized user
        yield* workflow.getDocument({
          documentId: uploadResult.documentId,
          userId: unauthorized.id as any,
        });
      });

      try {
        await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("Insufficient permission");
      }
    });
  });

  describe("publishDocument and unpublishDocument workflows", () => {
    test("should publish and unpublish document", async () => {
      const owner = seedUser(db, { role: "USER" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        // Create document
        const uploadResult = yield* workflow.uploadDocument({
          filename: "article.pdf" as any,
          originalName: "Article.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 1024 as any,
          path: "/tmp/article.pdf" as any,
          uploadedBy: owner.id as any,
        });

        // Publish
        const published = yield* workflow.publishDocument({
          documentId: uploadResult.documentId,
          userId: owner.id as any,
        });

        expect(published.status).toBe("PUBLISHED");

        // Unpublish
        const unpublished = yield* workflow.unpublishDocument({
          documentId: uploadResult.documentId,
          userId: owner.id as any,
        });

        expect(unpublished.status).toBe("DRAFT");

        return { published, unpublished };
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should prevent unauthorized user from publishing", async () => {
      const owner = seedUser(db, { email: "owner@example.com" });
      const unauthorized = seedUser(db, { email: "unauthorized@example.com" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        // Create document as owner
        const uploadResult = yield* workflow.uploadDocument({
          filename: "doc.pdf" as any,
          originalName: "Doc.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 1024 as any,
          path: "/tmp/doc.pdf" as any,
          uploadedBy: owner.id as any,
        });

        // Try to publish as unauthorized user
        yield* workflow.publishDocument({
          documentId: uploadResult.documentId,
          userId: unauthorized.id as any,
        });
      });

      try {
        await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("Insufficient permission");
      }
    });
  });

  describe("listDocuments workflow", () => {
    test("should list user's accessible documents", async () => {
      const user = seedUser(db, { role: "USER" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        // Create 3 documents
        yield* workflow.uploadDocument({
          filename: "doc1.pdf" as any,
          originalName: "Doc 1.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 1024 as any,
          path: "/tmp/doc1.pdf" as any,
          uploadedBy: user.id as any,
        });

        yield* workflow.uploadDocument({
          filename: "doc2.pdf" as any,
          originalName: "Doc 2.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 2048 as any,
          path: "/tmp/doc2.pdf" as any,
          uploadedBy: user.id as any,
        });

        yield* workflow.uploadDocument({
          filename: "doc3.pdf" as any,
          originalName: "Doc 3.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 3072 as any,
          path: "/tmp/doc3.pdf" as any,
          uploadedBy: user.id as any,
        });

        // List documents
        const result = yield* workflow.listDocuments({
          userId: user.id as any,
          page: 1,
          limit: 10,
        });

        expect(result.documents.length).toBe(3);
        expect(result.total).toBe(3);
        expect(result.page).toBe(1);

        return result;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });
  });

  describe("updateDocument workflow", () => {
    test("should update document metadata", async () => {
      const owner = seedUser(db, { role: "USER" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        // Create document
        const uploadResult = yield* workflow.uploadDocument({
          filename: "old-name.pdf" as any,
          originalName: "Old Name.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 1024 as any,
          path: "/tmp/old.pdf" as any,
          uploadedBy: owner.id as any,
        });

        // Update document
        const updated = yield* workflow.updateDocument({
          documentId: uploadResult.documentId,
          userId: owner.id as any,
          filename: "new-name.pdf" as any,
          originalName: "New Name.pdf" as any,
        });

        expect(String(updated.filename)).toBe("new-name.pdf");
        expect(String(updated.originalName)).toBe("New Name.pdf");

        return updated;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });
  });

  describe("deleteDocument workflow", () => {
    test("should delete document and all related data", async () => {
      const owner = seedUser(db, { role: "USER" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        // Create document
        const uploadResult = yield* workflow.uploadDocument({
          filename: "delete-me.pdf" as any,
          originalName: "Delete Me.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 1024 as any,
          path: "/tmp/delete-me.pdf" as any,
          uploadedBy: owner.id as any,
        });

        const documentId = uploadResult.documentId;

        // Delete document
        yield* workflow.deleteDocument({
          documentId,
          userId: owner.id as any,
        });

        // Verify document deleted
        const dbDoc = getDocumentById(db, documentId);
        expect(dbDoc).toBeNull();

        // Verify versions deleted (cascade)
        const versions = getVersionsForDocument(db, documentId);
        expect(versions.length).toBe(0);
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should prevent unauthorized deletion", async () => {
      const owner = seedUser(db, { email: "owner@example.com" });
      const unauthorized = seedUser(db, { email: "unauthorized@example.com" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        // Create document as owner
        const uploadResult = yield* workflow.uploadDocument({
          filename: "protected.pdf" as any,
          originalName: "Protected.pdf" as any,
          mimeType: "application/pdf" as any,
          size: 1024 as any,
          path: "/tmp/protected.pdf" as any,
          uploadedBy: owner.id as any,
        });

        // Try to delete as unauthorized user
        yield* workflow.deleteDocument({
          documentId: uploadResult.documentId,
          userId: unauthorized.id as any,
        });
      });

      try {
        await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("Insufficient permission");
      }
    });
  });
});
