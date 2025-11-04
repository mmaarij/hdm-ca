/**
 * Test Factories
 *
 * Deterministic factory functions for creating test entities
 */

import { Effect, Option } from "effect";
import { v4 as uuid } from "uuid";
import type { User } from "../app/domain/user/entity";
import type { Document, DocumentVersion } from "../app/domain/document/entity";
import type { DocumentPermission } from "../app/domain/permission/entity";
import type {
  UserId,
  DocumentId,
  DocumentVersionId,
} from "../app/domain/refined/uuid";
import type { PermissionId } from "../app/domain/permission/entity";

/**
 * Counter for deterministic IDs in tests
 */
let idCounter = 0;

/**
 * Reset ID counter (call in beforeEach)
 */
export function resetFactories(): void {
  idCounter = 0;
}

/**
 * Generate deterministic UUID for tests
 */
export function testUuid(prefix: string = "test"): string {
  idCounter++;
  return `${prefix}-${idCounter
    .toString()
    .padStart(8, "0")}-0000-0000-0000-000000000000`;
}

/**
 * Create a test user
 */
export function makeTestUser(overrides?: Partial<User>): User {
  const id = testUuid("user") as UserId;
  return {
    id,
    email: `user-${id}@example.com` as any,
    password: "$2a$10$abcdefghijklmnopqrstuv" as any, // Mock bcrypt hash
    role: "USER",
    createdAt: new Date() as any,
    updatedAt: new Date() as any,
    ...overrides,
  };
}

/**
 * Create a test admin user
 */
export function makeTestAdmin(overrides?: Partial<User>): User {
  return makeTestUser({
    role: "ADMIN",
    ...overrides,
  });
}

/**
 * Create a test document
 */
export function makeTestDocument(overrides?: Partial<Document>): Document {
  const id = testUuid("doc") as DocumentId;
  const userId = testUuid("user") as UserId;

  return {
    id,
    filename: `test-file-${id}.pdf` as any,
    originalName: `Test Document ${id}.pdf` as any,
    mimeType: "application/pdf" as any,
    size: 1024 as any,
    path: `/uploads/${id}.pdf` as any,
    status: "DRAFT" as any,
    uploadedBy: userId,
    createdAt: new Date() as any,
    updatedAt: new Date() as any,
    ...overrides,
  };
}

/**
 * Create a test document version
 */
export function makeTestDocumentVersion(
  overrides?: Partial<DocumentVersion>
): DocumentVersion {
  const id = testUuid("ver") as DocumentVersionId;
  const docId = testUuid("doc") as DocumentId;
  const userId = testUuid("user") as UserId;

  return {
    id,
    documentId: docId,
    filename: `test-file-v1.pdf` as any,
    originalName: `Test Document v1.pdf` as any,
    mimeType: "application/pdf" as any,
    size: 1024 as any,
    path: `/uploads/${id}.pdf` as any,
    versionNumber: 1 as any,
    uploadedBy: userId,
    createdAt: new Date() as any,
    ...overrides,
  };
}

/**
 * Create a test document permission
 */
export function makeTestPermission(
  overrides?: Partial<DocumentPermission>
): DocumentPermission {
  const id = testUuid("perm") as PermissionId;
  const docId = testUuid("doc") as DocumentId;
  const userId = testUuid("user") as UserId;
  const grantedBy = testUuid("admin") as UserId;

  return {
    id,
    documentId: docId,
    userId,
    permission: "READ",
    grantedBy,
    grantedAt: new Date() as any,
    ...overrides,
  };
}

/**
 * Create multiple test users
 */
export function makeTestUsers(count: number): User[] {
  return Array.from({ length: count }, () => makeTestUser());
}

/**
 * Create multiple test documents
 */
export function makeTestDocuments(
  count: number,
  uploadedBy: UserId
): Document[] {
  return Array.from({ length: count }, () => makeTestDocument({ uploadedBy }));
}

/**
 * Create test document with versions
 */
export function makeTestDocumentWithVersions(
  versionCount: number,
  uploadedBy: UserId
): { document: Document; versions: DocumentVersion[] } {
  const document = makeTestDocument({ uploadedBy });
  const versions = Array.from({ length: versionCount }, (_, i) =>
    makeTestDocumentVersion({
      documentId: document.id,
      versionNumber: (i + 1) as any,
      uploadedBy,
    })
  );

  return { document, versions };
}

/**
 * Raw database user (without transformations)
 */
export function makeRawDbUser(overrides?: Partial<any>): any {
  const id = testUuid("user");
  return {
    id,
    email: `user-${id}@example.com`,
    password: "$2a$10$abcdefghijklmnopqrstuv",
    role: "USER",
    created_at: Math.floor(Date.now() / 1000),
    updated_at: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

/**
 * Raw database document (without transformations)
 */
export function makeRawDbDocument(overrides?: Partial<any>): any {
  const id = testUuid("doc");
  const userId = testUuid("user");

  return {
    id,
    filename: `test-file-${id}.pdf`,
    original_name: `Test Document ${id}.pdf`,
    mime_type: "application/pdf",
    size: 1024,
    path: `/uploads/${id}.pdf`,
    uploaded_by: userId,
    created_at: Math.floor(Date.now() / 1000),
    updated_at: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

/**
 * Raw database document version (without transformations)
 */
export function makeRawDbVersion(overrides?: Partial<any>): any {
  const id = testUuid("ver");
  const docId = testUuid("doc");
  const userId = testUuid("user");

  return {
    id,
    document_id: docId,
    filename: `test-file-v1.pdf`,
    original_name: `Test Document v1.pdf`,
    mime_type: "application/pdf",
    size: 1024,
    path: `/uploads/${id}.pdf`,
    version_number: 1,
    uploaded_by: userId,
    created_at: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

/**
 * Raw database permission (without transformations)
 */
export function makeRawDbPermission(overrides?: Partial<any>): any {
  const id = testUuid("perm");
  const docId = testUuid("doc");
  const userId = testUuid("user");
  const grantedBy = testUuid("admin");

  return {
    id,
    document_id: docId,
    user_id: userId,
    permission: "READ",
    granted_by: grantedBy,
    granted_at: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}
