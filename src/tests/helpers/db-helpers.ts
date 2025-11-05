/**
 * Database Test Helpers
 *
 * Helpers for seeding and querying test database
 */

import type { TestDatabase } from "../setup";
import {
  makeRawDbUser,
  makeRawDbDocument,
  makeRawDbVersion,
  makeRawDbPermission,
  makeRawDbMetadata,
} from "../factories";
import type { UserId, DocumentId } from "../../app/domain/refined/uuid";

/**
 * Seed a user into the database
 */
export function seedUser(db: TestDatabase, user?: Partial<any>): any {
  const rawUser = makeRawDbUser(user);
  const sqlite = db.$client;

  sqlite.run(
    `INSERT INTO users (id, email, password, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    rawUser.id,
    rawUser.email,
    rawUser.password,
    rawUser.role,
    rawUser.created_at,
    rawUser.updated_at
  );

  return rawUser;
}

/**
 * Seed multiple users into the database
 */
export function seedUsers(db: TestDatabase, count: number): any[] {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push(seedUser(db));
  }
  return users;
}

/**
 * Seed a document into the database
 */
export function seedDocument(db: TestDatabase, document?: Partial<any>): any {
  const rawDoc = makeRawDbDocument(document);
  const sqlite = db.$client;

  sqlite.run(
    `INSERT INTO documents (id, filename, original_name, mime_type, size, path, uploaded_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    rawDoc.id,
    rawDoc.filename,
    rawDoc.original_name,
    rawDoc.mime_type,
    rawDoc.size,
    rawDoc.path,
    rawDoc.uploaded_by,
    rawDoc.created_at,
    rawDoc.updated_at
  );

  return rawDoc;
}

/**
 * Seed a document version into the database
 */
export function seedVersion(db: TestDatabase, version?: Partial<any>): any {
  const rawVersion = makeRawDbVersion(version);
  const sqlite = db.$client;

  sqlite.run(
    `INSERT INTO document_versions (id, document_id, filename, original_name, mime_type, size, path, version_number, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    rawVersion.id,
    rawVersion.document_id,
    rawVersion.filename,
    rawVersion.original_name,
    rawVersion.mime_type,
    rawVersion.size,
    rawVersion.path,
    rawVersion.version_number,
    rawVersion.uploaded_by,
    rawVersion.created_at
  );

  return rawVersion;
}

/**
 * Seed a permission into the database
 */
export function seedPermission(
  db: TestDatabase,
  permission?: Partial<any>
): any {
  const rawPerm = makeRawDbPermission(permission);
  const sqlite = db.$client;

  sqlite.run(
    `INSERT INTO document_permissions (id, document_id, user_id, permission, granted_by, granted_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    rawPerm.id,
    rawPerm.document_id,
    rawPerm.user_id,
    rawPerm.permission,
    rawPerm.granted_by,
    rawPerm.granted_at
  );

  return rawPerm;
}

/**
 * Seed metadata into the database
 */
export function seedMetadata(db: TestDatabase, metadata?: Partial<any>): any {
  const rawMeta = makeRawDbMetadata(metadata);
  const sqlite = db.$client;

  sqlite.run(
    `INSERT INTO metadata (id, document_id, key, value, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    rawMeta.id,
    rawMeta.document_id,
    rawMeta.key,
    rawMeta.value,
    rawMeta.created_at,
    rawMeta.updated_at
  );

  return rawMeta;
}

/**
 * Seed a complete user with documents
 */
export function seedUserWithDocuments(
  db: TestDatabase,
  documentCount: number = 1
): { user: any; documents: any[] } {
  const user = seedUser(db);
  const documents = [];

  for (let i = 0; i < documentCount; i++) {
    const doc = seedDocument(db, { uploaded_by: user.id });
    documents.push(doc);
  }

  return { user, documents };
}

/**
 * Seed a document with versions
 */
export function seedDocumentWithVersions(
  db: TestDatabase,
  versionCount: number = 2
): { document: any; versions: any[] } {
  const user = seedUser(db);
  const document = seedDocument(db, { uploaded_by: user.id });
  const versions = [];

  for (let i = 0; i < versionCount; i++) {
    const version = seedVersion(db, {
      document_id: document.id,
      version_number: i + 1,
      uploaded_by: user.id,
    });
    versions.push(version);
  }

  return { document, versions };
}

/**
 * Seed a collaborative scenario: owner + collaborator + document + permission
 */
export function seedCollaborativeScenario(db: TestDatabase): {
  owner: any;
  collaborator: any;
  document: any;
  permission: any;
} {
  const owner = seedUser(db, { role: "USER" });
  const collaborator = seedUser(db, { role: "USER" });
  const document = seedDocument(db, { uploaded_by: owner.id });
  const permission = seedPermission(db, {
    document_id: document.id,
    user_id: collaborator.id,
    granted_by: owner.id,
    permission: "READ",
  });

  return { owner, collaborator, document, permission };
}

/**
 * Get user by ID
 */
export function getUserById(db: TestDatabase, userId: string): any {
  const sqlite = db.$client;
  return sqlite.prepare("SELECT * FROM users WHERE id = ?").get(userId);
}

/**
 * Get document by ID
 */
export function getDocumentById(db: TestDatabase, documentId: string): any {
  const sqlite = db.$client;
  return sqlite.prepare("SELECT * FROM documents WHERE id = ?").get(documentId);
}

/**
 * Get all documents for a user
 */
export function getDocumentsForUser(db: TestDatabase, userId: string): any[] {
  const sqlite = db.$client;
  return sqlite
    .prepare("SELECT * FROM documents WHERE uploaded_by = ?")
    .all(userId) as any[];
}

/**
 * Get all versions for a document
 */
export function getVersionsForDocument(
  db: TestDatabase,
  documentId: string
): any[] {
  const sqlite = db.$client;
  return sqlite
    .prepare(
      "SELECT * FROM document_versions WHERE document_id = ? ORDER BY version_number"
    )
    .all(documentId) as any[];
}

/**
 * Get all permissions for a document
 */
export function getPermissionsForDocument(
  db: TestDatabase,
  documentId: string
): any[] {
  const sqlite = db.$client;
  return sqlite
    .prepare("SELECT * FROM document_permissions WHERE document_id = ?")
    .all(documentId) as any[];
}

/**
 * Get all metadata for a document
 */
export function getMetadataForDocument(
  db: TestDatabase,
  documentId: string
): any[] {
  const sqlite = db.$client;
  return sqlite
    .prepare("SELECT * FROM metadata WHERE document_id = ?")
    .all(documentId) as any[];
}

/**
 * Count documents in database
 */
export function countDocuments(db: TestDatabase): number {
  const sqlite = db.$client;
  const result: any = sqlite
    .prepare("SELECT COUNT(*) as count FROM documents")
    .get();
  return result.count;
}

/**
 * Count users in database
 */
export function countUsers(db: TestDatabase): number {
  const sqlite = db.$client;
  const result: any = sqlite
    .prepare("SELECT COUNT(*) as count FROM users")
    .get();
  return result.count;
}

/**
 * Verify database is empty
 */
export function verifyDatabaseEmpty(db: TestDatabase): boolean {
  return countUsers(db) === 0 && countDocuments(db) === 0;
}
