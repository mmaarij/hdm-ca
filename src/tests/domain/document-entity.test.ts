/**
 * Document Entity Tests
 *
 * Tests for Document and DocumentVersion entities with validation
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { Effect } from "effect";
import {
  makeFilename,
  makeMimeType,
  makeFileSize,
  makeVersionNumber,
  makeFilePath,
} from "../../app/domain/document/value-object";
import {
  resetFactories,
  makeTestDocument,
  makeTestDocumentVersion,
  makeTestDocumentWithVersions,
} from "../factories";

import { DocumentAggregate } from "../../app/domain";

describe("Document Value Objects", () => {
  beforeEach(() => {
    resetFactories();
  });

  describe("Filename", () => {
    test("should create valid filename", async () => {
      const result = await Effect.runPromise(makeFilename("test.pdf"));
      expect(String(result)).toBe("test.pdf");
    });

    test("should reject empty filename", async () => {
      try {
        await Effect.runPromise(makeFilename(""));
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test("should reject filename exceeding 255 characters", async () => {
      try {
        await Effect.runPromise(makeFilename("a".repeat(300)));
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test("should accept filename at 255 characters", async () => {
      const longName = "a".repeat(255);
      const result = await Effect.runPromise(makeFilename(longName));
      expect(String(result)).toBe(longName);
    });
  });

  describe("MimeType", () => {
    test("should create valid MIME type", async () => {
      const result = await Effect.runPromise(makeMimeType("application/pdf"));
      expect(String(result)).toBe("application/pdf");
    });

    test("should accept MIME types with parameters", async () => {
      const result = await Effect.runPromise(
        makeMimeType("text/html;charset=utf-8")
      );
      expect(String(result)).toBe("text/html;charset=utf-8");
    });

    test("should accept various valid MIME types", async () => {
      const validTypes = [
        "text/plain",
        "image/jpeg",
        "application/json",
        "video/mp4",
        "audio/mpeg",
      ];

      for (const mimeType of validTypes) {
        const result = await Effect.runPromise(makeMimeType(mimeType));
        expect(String(result)).toBe(mimeType);
      }
    });

    test("should reject invalid MIME type", async () => {
      try {
        await Effect.runPromise(makeMimeType("invalid"));
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test("should reject empty MIME type", async () => {
      try {
        await Effect.runPromise(makeMimeType(""));
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("FileSize", () => {
    test("should create valid file size", async () => {
      const result = await Effect.runPromise(makeFileSize(1024));
      expect(Number(result)).toBe(1024);
    });

    test("should accept minimum file size (1 byte)", async () => {
      const result = await Effect.runPromise(makeFileSize(1));
      expect(Number(result)).toBe(1);
    });

    test("should accept maximum file size (100 MB)", async () => {
      const MAX_SIZE = 100 * 1024 * 1024;
      const result = await Effect.runPromise(makeFileSize(MAX_SIZE));
      expect(Number(result)).toBe(MAX_SIZE);
    });

    test("should reject zero file size", async () => {
      try {
        await Effect.runPromise(makeFileSize(0));
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test("should reject negative file size", async () => {
      try {
        await Effect.runPromise(makeFileSize(-1));
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test("should reject file size exceeding maximum", async () => {
      const MAX_SIZE = 100 * 1024 * 1024 + 1;
      try {
        await Effect.runPromise(makeFileSize(MAX_SIZE));
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test("should reject non-integer file size", async () => {
      try {
        await Effect.runPromise(makeFileSize(1024.5));
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("VersionNumber", () => {
    test("should create valid version number", async () => {
      const result = await Effect.runPromise(makeVersionNumber(1));
      expect(Number(result)).toBe(1);
    });

    test("should accept various valid version numbers", async () => {
      const versions = [1, 2, 10, 100, 1000];

      for (const version of versions) {
        const result = await Effect.runPromise(makeVersionNumber(version));
        expect(Number(result)).toBe(version);
      }
    });

    test("should reject zero version number", async () => {
      try {
        await Effect.runPromise(makeVersionNumber(0));
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test("should reject negative version number", async () => {
      try {
        await Effect.runPromise(makeVersionNumber(-1));
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test("should reject non-integer version number", async () => {
      try {
        await Effect.runPromise(makeVersionNumber(1.5));
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("FilePath", () => {
    test("should create valid file path", async () => {
      const result = await Effect.runPromise(makeFilePath("/uploads/test.pdf"));
      expect(String(result)).toBe("/uploads/test.pdf");
    });

    test("should accept various path formats", async () => {
      const paths = [
        "/uploads/file.pdf",
        "relative/path/to/file.txt",
        "/path/with/spaces/file name.doc",
        "/path/with-dashes/and_underscores.pdf",
      ];

      for (const path of paths) {
        const result = await Effect.runPromise(makeFilePath(path));
        expect(String(result)).toBe(path);
      }
    });

    test("should reject empty file path", async () => {
      try {
        await Effect.runPromise(makeFilePath(""));
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test("should reject whitespace-only file path", async () => {
      try {
        await Effect.runPromise(makeFilePath("   "));
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("Entity Factories", () => {
    test("should create test document with valid values", () => {
      const doc = makeTestDocument();

      expect(doc.id).toBeDefined();
      expect(doc.filename).toBeDefined();
      expect(doc.originalName).toBeDefined();
      expect(doc.mimeType).toBeDefined();
      expect(doc.size).toBeDefined();
      expect(doc.path).toBeDefined();
      expect(doc.uploadedBy).toBeDefined();
    });

    test("should create test document version with valid values", () => {
      const version = makeTestDocumentVersion();

      expect(version.id).toBeDefined();
      expect(version.documentId).toBeDefined();
      expect(version.filename).toBeDefined();
      expect(typeof version.versionNumber).toBe("number");
    });

    test("should respect overrides in factory", () => {
      const customFilename = "custom.pdf" as any;
      const doc = makeTestDocument({ filename: customFilename });

      expect(doc.filename).toBe(customFilename);
    });
  });

  describe("DocumentAggregate", () => {
    test("prepareAddVersion sets versionNumber to 1 when no versions exist", () => {
      const doc = makeTestDocument();
      const agg = DocumentAggregate.from(doc, []);

      const payload = agg.prepareAddVersion({
        filename: doc.filename,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        size: doc.size,
        path: doc.path,
        uploadedBy: doc.uploadedBy,
      } as any);

      expect(payload.documentId).toBe(doc.id);
      expect(payload.versionNumber as any).toBe(1);
    });

    test("prepareAddVersion increments based on existing versions", () => {
      const { document, versions } = makeTestDocumentWithVersions(
        2,
        makeTestDocument().uploadedBy
      );
      const agg = DocumentAggregate.from(document, versions);

      const payload = agg.prepareAddVersion({
        filename: document.filename,
        originalName: document.originalName,
        mimeType: document.mimeType,
        size: document.size,
        path: document.path,
        uploadedBy: document.uploadedBy,
      } as any);

      expect(payload.versionNumber as any).toBe(3);
    });

    test("attachVersion is idempotent and adds persisted version", () => {
      const { document, versions } = makeTestDocumentWithVersions(
        1,
        makeTestDocument().uploadedBy
      );
      const agg = DocumentAggregate.from(document, versions);

      const newVersion = makeTestDocumentVersion({
        documentId: document.id,
        versionNumber: 2 as any,
      });

      const withAttached = agg.attachVersion(newVersion);
      expect(withAttached.allVersions.length).toBe(2);

      const attachedAgain = withAttached.attachVersion(newVersion);
      expect(attachedAgain.allVersions.length).toBe(2);
    });

    test("removeVersionById removes a version from aggregate", () => {
      const { document, versions } = makeTestDocumentWithVersions(
        2,
        makeTestDocument().uploadedBy
      );
      const agg = DocumentAggregate.from(document, versions);

      const idToRemove = versions[0].id;
      const afterRemoval = agg.removeVersionById(idToRemove);

      expect(afterRemoval.allVersions.length).toBe(1);
      expect(afterRemoval.allVersions.some((v) => v.id === idToRemove)).toBe(
        false
      );
    });
  });
});
