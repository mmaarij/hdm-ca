/**
 * Test Factories
 *
 * Deterministic factory functions for creating test entities, DTOs, and test data
 */

import { Effect, Option } from "effect";
import { v4 as uuid } from "uuid";
import type { User } from "../app/domain/user/entity";
import type { Document, DocumentVersion } from "../app/domain/document/entity";
import type { DocumentPermission } from "../app/domain/permission/entity";
import type { DocumentMetadata } from "../app/domain/metedata/entity";
import type { DownloadToken } from "../app/domain/download-token/entity";
import type {
  UserId,
  DocumentId,
  DocumentVersionId,
  DownloadTokenId,
} from "../app/domain/refined/uuid";
import type { PermissionId } from "../app/domain/permission/entity";
import type { MetadataId } from "../app/domain/metedata/entity";
import type {
  RegisterUserCommand,
  LoginUserCommand,
} from "../app/application/dtos/user/request.dto";
import type { UploadDocumentCommand } from "../app/application/dtos/document/request.dto";
import type {
  GrantPermissionCommand,
  RevokePermissionCommand,
} from "../app/application/dtos/permission/request.dto";
import type {
  AddMetadataCommand,
  UpdateMetadataCommand,
} from "../app/application/dtos/metedata/request.dto";

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

/**
 * Raw database metadata (without transformations)
 */
export function makeRawDbMetadata(overrides?: Partial<any>): any {
  const id = testUuid("meta");
  const docId = testUuid("doc");

  return {
    id,
    document_id: docId,
    key: "test-key",
    value: "test-value",
    created_at: Math.floor(Date.now() / 1000),
    updated_at: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

/**
 * Create test metadata entity
 */
export function makeTestMetadata(
  overrides?: Partial<DocumentMetadata>
): DocumentMetadata {
  const id = testUuid("meta") as MetadataId;
  const docId = testUuid("doc") as DocumentId;

  return {
    id,
    documentId: docId,
    key: "test-key" as any,
    value: "test-value" as any,
    createdAt: new Date() as any,
    ...overrides,
  };
}

/**
 * Create test download token
 */
export function makeTestDownloadToken(
  overrides?: Partial<DownloadToken>
): DownloadToken {
  const id = testUuid("token") as DownloadTokenId;
  const docId = testUuid("doc") as DocumentId;
  const userId = testUuid("user") as UserId;

  return {
    id,
    documentId: docId,
    token: `test-token-${id}` as any,
    expiresAt: new Date(Date.now() + 3600000) as any, // 1 hour from now
    createdBy: userId,
    createdAt: new Date() as any,
    ...overrides,
  };
}

// ========================================
// DTO Factories (Commands & Queries)
// ========================================

/**
 * Create RegisterUserCommand
 */
export function makeRegisterUserCommand(
  overrides?: Partial<RegisterUserCommand>
): RegisterUserCommand {
  const id = testUuid("user");
  return {
    email: `user-${id}@example.com` as any,
    password: "TestPassword123!" as any,
    role: "USER",
    ...overrides,
  } as RegisterUserCommand;
}

/**
 * Create LoginUserCommand
 */
export function makeLoginUserCommand(
  overrides?: Partial<LoginUserCommand>
): LoginUserCommand {
  const id = testUuid("user");
  return {
    email: `user-${id}@example.com` as any,
    password: "TestPassword123!" as any,
    ...overrides,
  } as LoginUserCommand;
}

/**
 * Create UploadDocumentCommand
 */
export function makeUploadDocumentCommand(
  overrides?: Partial<UploadDocumentCommand>
): UploadDocumentCommand {
  const userId = testUuid("user") as UserId;
  const id = testUuid("file");

  // Create a mock UploadedFile
  const mockFile = {
    name: `test-file-${id}.pdf`,
    size: 1024,
    type: "application/pdf",
    arrayBuffer: async () => new ArrayBuffer(1024),
  };

  return {
    file: mockFile,
    uploadedBy: userId,
    ...overrides,
  } as UploadDocumentCommand;
}

/**
 * Create GrantPermissionCommand
 */
export function makeGrantPermissionCommand(
  overrides?: Partial<GrantPermissionCommand>
): GrantPermissionCommand {
  const docId = testUuid("doc") as DocumentId;
  const userId = testUuid("user") as UserId;
  const grantedBy = testUuid("admin") as UserId;

  return {
    documentId: docId,
    userId,
    permission: "READ",
    grantedBy,
    ...overrides,
  } as GrantPermissionCommand;
}

/**
 * Create RevokePermissionCommand
 */
export function makeRevokePermissionCommand(
  overrides?: Partial<RevokePermissionCommand>
): RevokePermissionCommand {
  const permId = testUuid("perm") as PermissionId;
  const userId = testUuid("user") as UserId;

  return {
    permissionId: permId,
    revokedBy: userId,
    ...overrides,
  } as RevokePermissionCommand;
}

/**
 * Create AddMetadataCommand
 */
export function makeAddMetadataCommand(
  overrides?: Partial<AddMetadataCommand>
): AddMetadataCommand {
  const docId = testUuid("doc") as DocumentId;
  const userId = testUuid("user") as UserId;

  return {
    documentId: docId,
    userId,
    key: "test-key" as any,
    value: "test-value" as any,
    ...overrides,
  } as AddMetadataCommand;
}

/**
 * Create UpdateMetadataCommand
 */
export function makeUpdateMetadataCommand(
  overrides?: Partial<UpdateMetadataCommand>
): UpdateMetadataCommand {
  const metaId = testUuid("meta") as MetadataId;
  const userId = testUuid("user") as UserId;

  return {
    metadataId: metaId,
    userId,
    value: "updated-value" as any,
    ...overrides,
  } as UpdateMetadataCommand;
}

// ========================================
// Test Data Builders (Fluent API)
// ========================================

/**
 * User Builder for complex test scenarios
 */
export class UserBuilder {
  private overrides: any = {};

  static create(): UserBuilder {
    return new UserBuilder();
  }

  withEmail(email: string): this {
    this.overrides.email = email;
    return this;
  }

  withRole(role: "USER" | "ADMIN"): this {
    this.overrides.role = role;
    return this;
  }

  asAdmin(): this {
    this.overrides.role = "ADMIN";
    return this;
  }

  asUser(): this {
    this.overrides.role = "USER";
    return this;
  }

  withId(id: UserId): this {
    this.overrides.id = id;
    return this;
  }

  build(): User {
    return makeTestUser(this.overrides);
  }
}

/**
 * Document Builder for complex test scenarios
 */
export class DocumentBuilder {
  private overrides: any = {};

  static create(): DocumentBuilder {
    return new DocumentBuilder();
  }

  withId(id: DocumentId): this {
    this.overrides.id = id;
    return this;
  }

  withFilename(filename: string): this {
    this.overrides.filename = filename;
    return this;
  }

  withMimeType(mimeType: string): this {
    this.overrides.mimeType = mimeType;
    return this;
  }

  withSize(size: number): this {
    this.overrides.size = size;
    return this;
  }

  withStatus(status: "DRAFT" | "PUBLISHED" | "ARCHIVED"): this {
    this.overrides.status = status;
    return this;
  }

  asDraft(): this {
    this.overrides.status = "DRAFT";
    return this;
  }

  asPublished(): this {
    this.overrides.status = "PUBLISHED";
    return this;
  }

  uploadedBy(userId: UserId): this {
    this.overrides.uploadedBy = userId;
    return this;
  }

  withPath(path: string): this {
    this.overrides.path = path;
    return this;
  }

  build(): Document {
    return makeTestDocument(this.overrides);
  }
}

/**
 * Test Scenario Builder
 *
 * Builds complex multi-entity test scenarios
 */
export class TestScenarioBuilder {
  private users: User[] = [];
  private documents: Document[] = [];
  private permissions: DocumentPermission[] = [];
  private metadata: DocumentMetadata[] = [];

  static create(): TestScenarioBuilder {
    return new TestScenarioBuilder();
  }

  addUser(user?: Partial<User>): this {
    this.users.push(makeTestUser(user));
    return this;
  }

  addAdmin(user?: Partial<User>): this {
    this.users.push(makeTestAdmin(user));
    return this;
  }

  addDocument(document?: Partial<Document>): this {
    this.documents.push(makeTestDocument(document));
    return this;
  }

  addPermission(permission?: Partial<DocumentPermission>): this {
    this.permissions.push(makeTestPermission(permission));
    return this;
  }

  addMetadata(metadata?: Partial<DocumentMetadata>): this {
    this.metadata.push(makeTestMetadata(metadata));
    return this;
  }

  /**
   * Create a complete user-document-permission scenario
   */
  withUserAndDocument(): {
    user: User;
    document: Document;
    scenario: TestScenarioBuilder;
  } {
    const user = makeTestUser();
    const document = makeTestDocument({ uploadedBy: user.id });

    this.users.push(user);
    this.documents.push(document);

    return { user, document, scenario: this };
  }

  /**
   * Create a sharing scenario: owner + document + collaborator + permission
   */
  withDocumentSharing(): {
    owner: User;
    collaborator: User;
    document: Document;
    permission: DocumentPermission;
    scenario: TestScenarioBuilder;
  } {
    const owner = makeTestUser();
    const collaborator = makeTestUser();
    const document = makeTestDocument({ uploadedBy: owner.id });
    const permission = makeTestPermission({
      documentId: document.id,
      userId: collaborator.id,
      grantedBy: owner.id,
      permission: "READ",
    });

    this.users.push(owner, collaborator);
    this.documents.push(document);
    this.permissions.push(permission);

    return { owner, collaborator, document, permission, scenario: this };
  }

  build() {
    return {
      users: this.users,
      documents: this.documents,
      permissions: this.permissions,
      metadata: this.metadata,
    };
  }
}
