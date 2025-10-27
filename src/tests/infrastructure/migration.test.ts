/**
 * Database Migration Tests
 *
 * Tests for database schema creation and constraints
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  setupTestDatabase,
  cleanupTestDatabase,
  type TestDatabase,
} from "../setup";

describe("Database Migrations", () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = setupTestDatabase();
  });

  afterEach(() => {
    cleanupTestDatabase(db);
  });

  describe("Schema Creation", () => {
    test("should create users table", () => {
      const sqlite = db.$client;
      const result = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
        )
        .get();

      expect(result).toBeDefined();
      expect((result as any).name).toBe("users");
    });

    test("should create documents table", () => {
      const sqlite = db.$client;
      const result = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='documents'"
        )
        .get();

      expect(result).toBeDefined();
      expect((result as any).name).toBe("documents");
    });

    test("should create document_versions table", () => {
      const sqlite = db.$client;
      const result = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='document_versions'"
        )
        .get();

      expect(result).toBeDefined();
      expect((result as any).name).toBe("document_versions");
    });

    test("should create document_permissions table", () => {
      const sqlite = db.$client;
      const result = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='document_permissions'"
        )
        .get();

      expect(result).toBeDefined();
      expect((result as any).name).toBe("document_permissions");
    });

    test("should create document_audit table", () => {
      const sqlite = db.$client;
      const result = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='document_audit'"
        )
        .get();

      expect(result).toBeDefined();
      expect((result as any).name).toBe("document_audit");
    });
  });

  describe("Foreign Key Constraints", () => {
    test("should enforce FK from documents to users", () => {
      const sqlite = db.$client;

      // Try to insert document with non-existent user
      expect(() => {
        sqlite.run(`
          INSERT INTO documents (id, filename, original_name, mime_type, size, path, uploaded_by)
          VALUES ('doc-1', 'test.pdf', 'test.pdf', 'application/pdf', 1024, '/test.pdf', 'nonexistent-user')
        `);
      }).toThrow();
    });

    test("should cascade delete from users to documents", () => {
      const sqlite = db.$client;

      // Insert user and document
      sqlite.run(`
        INSERT INTO users (id, email, password, role)
        VALUES ('user-1', 'test@example.com', 'hash', 'USER')
      `);

      sqlite.run(`
        INSERT INTO documents (id, filename, original_name, mime_type, size, path, uploaded_by)
        VALUES ('doc-1', 'test.pdf', 'test.pdf', 'application/pdf', 1024, '/test.pdf', 'user-1')
      `);

      // Delete user
      sqlite.run("DELETE FROM users WHERE id = 'user-1'");

      // Document should be deleted
      const result = sqlite
        .prepare("SELECT * FROM documents WHERE id = 'doc-1'")
        .get();
      expect(result).toBeNull();
    });

    test("should enforce FK from document_versions to documents", () => {
      const sqlite = db.$client;

      // Try to insert version with non-existent document
      expect(() => {
        sqlite.run(`
          INSERT INTO document_versions (id, document_id, filename, original_name, mime_type, size, path, version_number, uploaded_by)
          VALUES ('ver-1', 'nonexistent-doc', 'test.pdf', 'test.pdf', 'application/pdf', 1024, '/test.pdf', 1, 'user-1')
        `);
      }).toThrow();
    });

    test("should cascade delete from documents to versions", () => {
      const sqlite = db.$client;

      // Insert user, document, and version
      sqlite.run(`
        INSERT INTO users (id, email, password, role)
        VALUES ('user-1', 'test@example.com', 'hash', 'USER')
      `);

      sqlite.run(`
        INSERT INTO documents (id, filename, original_name, mime_type, size, path, uploaded_by)
        VALUES ('doc-1', 'test.pdf', 'test.pdf', 'application/pdf', 1024, '/test.pdf', 'user-1')
      `);

      sqlite.run(`
        INSERT INTO document_versions (id, document_id, filename, original_name, mime_type, size, path, version_number, uploaded_by)
        VALUES ('ver-1', 'doc-1', 'test.pdf', 'test.pdf', 'application/pdf', 1024, '/test.pdf', 1, 'user-1')
      `);

      // Delete document
      sqlite.run("DELETE FROM documents WHERE id = 'doc-1'");

      // Version should be deleted
      const result = sqlite
        .prepare("SELECT * FROM document_versions WHERE id = 'ver-1'")
        .get();
      expect(result).toBeNull();
    });
  });

  describe("Unique Constraints", () => {
    test("should enforce unique email on users", () => {
      const sqlite = db.$client;

      sqlite.run(`
        INSERT INTO users (id, email, password, role)
        VALUES ('user-1', 'test@example.com', 'hash', 'USER')
      `);

      expect(() => {
        sqlite.run(`
          INSERT INTO users (id, email, password, role)
          VALUES ('user-2', 'test@example.com', 'hash', 'USER')
        `);
      }).toThrow();
    });

    test("should enforce unique (document_id, version_number) on versions", () => {
      const sqlite = db.$client;

      sqlite.run(`
        INSERT INTO users (id, email, password, role)
        VALUES ('user-1', 'test@example.com', 'hash', 'USER')
      `);

      sqlite.run(`
        INSERT INTO documents (id, filename, original_name, mime_type, size, path, uploaded_by)
        VALUES ('doc-1', 'test.pdf', 'test.pdf', 'application/pdf', 1024, '/test.pdf', 'user-1')
      `);

      sqlite.run(`
        INSERT INTO document_versions (id, document_id, filename, original_name, mime_type, size, path, version_number, uploaded_by)
        VALUES ('ver-1', 'doc-1', 'test.pdf', 'test.pdf', 'application/pdf', 1024, '/test.pdf', 1, 'user-1')
      `);

      expect(() => {
        sqlite.run(`
          INSERT INTO document_versions (id, document_id, filename, original_name, mime_type, size, path, version_number, uploaded_by)
          VALUES ('ver-2', 'doc-1', 'test.pdf', 'test.pdf', 'application/pdf', 1024, '/test.pdf', 1, 'user-1')
        `);
      }).toThrow();
    });

    test("should enforce unique (document_id, user_id) on permissions", () => {
      const sqlite = db.$client;

      sqlite.run(`
        INSERT INTO users (id, email, password, role)
        VALUES ('user-1', 'test@example.com', 'hash', 'USER'),
               ('user-2', 'admin@example.com', 'hash', 'ADMIN')
      `);

      sqlite.run(`
        INSERT INTO documents (id, filename, original_name, mime_type, size, path, uploaded_by)
        VALUES ('doc-1', 'test.pdf', 'test.pdf', 'application/pdf', 1024, '/test.pdf', 'user-1')
      `);

      sqlite.run(`
        INSERT INTO document_permissions (id, document_id, user_id, permission, granted_by)
        VALUES ('perm-1', 'doc-1', 'user-1', 'READ', 'user-2')
      `);

      expect(() => {
        sqlite.run(`
          INSERT INTO document_permissions (id, document_id, user_id, permission, granted_by)
          VALUES ('perm-2', 'doc-1', 'user-1', 'WRITE', 'user-2')
        `);
      }).toThrow();
    });
  });

  describe("Indexes", () => {
    test("should create index on documents.uploaded_by", () => {
      const sqlite = db.$client;
      const result = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_documents_uploaded_by'"
        )
        .get();

      expect(result).toBeDefined();
    });

    test("should create index on document_versions.document_id", () => {
      const sqlite = db.$client;
      const result = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_versions_document_id'"
        )
        .get();

      expect(result).toBeDefined();
    });

    test("should create index on document_permissions.document_id", () => {
      const sqlite = db.$client;
      const result = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_permissions_document_id'"
        )
        .get();

      expect(result).toBeDefined();
    });

    test("should create index on document_permissions.user_id", () => {
      const sqlite = db.$client;
      const result = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_permissions_user_id'"
        )
        .get();

      expect(result).toBeDefined();
    });
  });

  describe("Default Values", () => {
    test("should set default timestamps on insert", () => {
      const sqlite = db.$client;

      sqlite.run(`
        INSERT INTO users (id, email, password, role)
        VALUES ('user-1', 'test@example.com', 'hash', 'USER')
      `);

      const result: any = sqlite
        .prepare("SELECT created_at, updated_at FROM users WHERE id = 'user-1'")
        .get();

      expect(result.created_at).toBeGreaterThan(0);
      expect(result.updated_at).toBeGreaterThan(0);
    });

    test("should set default role to USER", () => {
      const sqlite = db.$client;

      sqlite.run(`
        INSERT INTO users (id, email, password)
        VALUES ('user-1', 'test@example.com', 'hash')
      `);

      const result: any = sqlite
        .prepare("SELECT role FROM users WHERE id = 'user-1'")
        .get();

      expect(result.role).toBe("USER");
    });
  });
});
