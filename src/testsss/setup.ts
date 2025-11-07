/**
 * Test Setup and Database Utilities
 *
 * Provides in-memory SQLite database setup for testing using Bun's built-in SQLite
 */

import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "../app/infrastructure/models";

export type TestDatabase = BunSQLiteDatabase<typeof schema> & {
  $client: Database;
};

/**
 * Create an in-memory SQLite database for testing
 */
export function createTestDatabase(): TestDatabase {
  const sqlite = new Database(":memory:");
  // Enable foreign key constraints
  sqlite.run("PRAGMA foreign_keys = ON");

  const db = drizzle(sqlite, { schema }) as TestDatabase;
  db.$client = sqlite;

  return db;
}

/**
 * Run migrations on test database
 */
export function migrateTestDatabase(db: TestDatabase): void {
  const sqlite = db.$client;

  // Create users table
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  //Create documents table
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'PUBLISHED')),
      uploaded_by TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  sqlite.run(`
    CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
  `);

  sqlite.run(`
    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
  `);

  // Create document_versions table
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS document_versions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT,
      content_ref TEXT,
      checksum TEXT,
      version_number INTEGER NOT NULL,
      uploaded_by TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(document_id, version_number)
    );
  `);

  sqlite.run(`
    CREATE INDEX IF NOT EXISTS idx_versions_document_id ON document_versions(document_id);
  `);

  sqlite.run(`
    CREATE INDEX IF NOT EXISTS idx_versions_uploaded_by ON document_versions(uploaded_by);
  `);

  sqlite.run(`
    CREATE INDEX IF NOT EXISTS idx_document_versions_checksum ON document_versions(checksum);
  `);

  sqlite.run(`
    CREATE INDEX IF NOT EXISTS idx_document_versions_content_ref ON document_versions(content_ref);
  `);

  // Create document_permissions table
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS document_permissions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      permission TEXT NOT NULL,
      granted_by TEXT NOT NULL,
      granted_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (granted_by) REFERENCES users(id),
      UNIQUE(document_id, user_id)
    );
  `);

  sqlite.run(`
    CREATE INDEX IF NOT EXISTS idx_permissions_document_id ON document_permissions(document_id);
  `);

  sqlite.run(`
    CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON document_permissions(user_id);
  `);

  // Create document_audit table
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS document_audit (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      action TEXT NOT NULL,
      performed_by TEXT NOT NULL,
      details TEXT DEFAULT '' NOT NULL,
      performed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (performed_by) REFERENCES users(id)
    );
  `);

  sqlite.run(`
    CREATE INDEX IF NOT EXISTS idx_audit_document_id ON document_audit(document_id);
  `);

  sqlite.run(`
    CREATE INDEX IF NOT EXISTS idx_audit_performed_at ON document_audit(performed_at);
  `);

  // Create metadata table
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS document_metadata (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      UNIQUE(document_id, key)
    );
  `);

  sqlite.run(`
    CREATE INDEX IF NOT EXISTS idx_metadata_document_id ON document_metadata(document_id);
  `);

  // Create download_tokens table
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS download_tokens (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
  `);

  sqlite.run(`
    CREATE INDEX IF NOT EXISTS idx_download_tokens_token ON download_tokens(token);
  `);

  sqlite.run(`
    CREATE INDEX IF NOT EXISTS idx_download_tokens_document_id ON download_tokens(document_id);
  `);
}

/**
 * Setup fresh test database with migrations
 */
export function setupTestDatabase(): TestDatabase {
  const db = createTestDatabase();
  migrateTestDatabase(db);
  return db;
}

/**
 * Clean up database (clear all tables)
 */
export function cleanupTestDatabase(db: TestDatabase): void {
  const sqlite = db.$client;

  // Delete in correct order due to foreign keys
  sqlite.run("DELETE FROM document_audit");
  sqlite.run("DELETE FROM download_tokens");
  sqlite.run("DELETE FROM document_metadata");
  sqlite.run("DELETE FROM document_permissions");
  sqlite.run("DELETE FROM document_versions");
  sqlite.run("DELETE FROM documents");
  sqlite.run("DELETE FROM users");
}
