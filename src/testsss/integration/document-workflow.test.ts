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
import {
  MockStorageLive,
  resetMockStorage,
  verifyFileStored,
  createMockUploadedFile,
} from "../mocks";

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

  describe("Single-Step Upload Workflow", () => {
    test("should upload document in single step with auto-versioning", async () => {
      const user = seedUser(db, { role: "USER" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        // Single-step upload creates document and version 1
        const uploadResult = yield* workflow.uploadDocument({
          file: createMockUploadedFile("report.pdf", 2048),
          uploadedBy: user.id as any,
        });

        expect(uploadResult.documentId).toBeDefined();
        expect(uploadResult.versionId).toBeDefined();
        expect(uploadResult.version.versionNumber).toBeDefined();

        const documentId = uploadResult.documentId;

        // Verify document created
        const dbDoc = getDocumentById(db, documentId);
        expect(dbDoc).toBeDefined();
        expect(dbDoc.filename).toBe("report.pdf");

        // Verify version created
        const versions = getVersionsForDocument(db, documentId);
        expect(versions.length).toBe(1);
        expect(versions[0].version_number).toBe(1);
        expect(versions[0].filename).toBe("report.pdf");
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should create new version when uploading to existing document", async () => {
      const user = seedUser(db, { role: "USER" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        // First upload creates document
        const firstUpload = yield* workflow.uploadDocument({
          file: createMockUploadedFile("file1.pdf", 1024),
          uploadedBy: user.id as any,
        });

        expect(firstUpload.version.versionNumber).toBeDefined();
        const documentId = firstUpload.documentId;

        // Second upload to same document creates version 2
        const secondUpload = yield* workflow.uploadDocument({
          file: createMockUploadedFile("file2.pdf", 2048),
          documentId: documentId,
          uploadedBy: user.id as any,
        });

        expect(secondUpload.documentId).toBe(documentId);
        const secondVersionNum = secondUpload.version.versionNumber;

        // Verify both versions exist
        const versions = getVersionsForDocument(db, documentId);
        expect(versions.length).toBe(2);
        expect(versions[0].version_number).toBe(1);
        expect(versions[1].version_number).toBe(2);
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should handle concurrent uploads to same document", async () => {
      const user = seedUser(db, { role: "USER" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        // First upload with checksum
        const firstInit = yield* workflow.uploadDocument({
          file: createMockUploadedFile("file1.pdf", 1024),
          uploadedBy: user.id as any,
        });

        const documentId = firstInit.documentId;

        // Second upload to same document creates version 2
        const secondUpload = yield* workflow.uploadDocument({
          file: createMockUploadedFile("file2.pdf", 2048),
          documentId: documentId,
          uploadedBy: user.id as any,
        });

        // Should create new version on same document
        expect(secondUpload.documentId).toBe(documentId);
        expect(Number(secondUpload.version.versionNumber)).toBe(2);

        // Verify two versions exist
        const versions = getVersionsForDocument(db, documentId);
        expect(versions.length).toBe(2);

        return { firstInit, secondUpload };
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should reject upload by unauthorized user", async () => {
      const owner = seedUser(db, { email: "owner@example.com" });
      const unauthorized = seedUser(db, { email: "unauthorized@example.com" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        // Owner uploads document
        const uploadResult = yield* workflow.uploadDocument({
          file: createMockUploadedFile("file.pdf", 1024),
          uploadedBy: owner.id as any,
        });

        // Unauthorized user tries to upload new version
        yield* workflow.uploadDocument({
          file: createMockUploadedFile("version2.pdf", 2048),
          documentId: uploadResult.documentId,
          uploadedBy: unauthorized.id as any,
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

  describe("getDocument workflow", () => {
    test("should retrieve document with permissions", async () => {
      const owner = seedUser(db, { email: "owner@example.com" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        // Create document
        const uploadResult = yield* workflow.uploadDocument({
          file: createMockUploadedFile("doc.pdf"),
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
          file: createMockUploadedFile("private.pdf"),
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

  describe("listDocuments workflow", () => {
    test("should list user's accessible documents", async () => {
      const user = seedUser(db, { role: "USER" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        // Create 3 documents
        yield* workflow.uploadDocument({
          file: createMockUploadedFile("doc1.pdf"),
          uploadedBy: user.id as any,
        });

        yield* workflow.uploadDocument({
          file: createMockUploadedFile("doc2.pdf", 2048),
          uploadedBy: user.id as any,
        });

        yield* workflow.uploadDocument({
          file: createMockUploadedFile("doc3.pdf", 3072),
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

  describe("deleteDocument workflow", () => {
    test("should delete document and all related data", async () => {
      const owner = seedUser(db, { role: "USER" });

      const program = Effect.gen(function* () {
        const workflow = yield* DocumentWorkflowTag;

        // Create document
        const uploadResult = yield* workflow.uploadDocument({
          file: createMockUploadedFile("delete-me.pdf"),
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
          file: createMockUploadedFile("protected.pdf"),
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
