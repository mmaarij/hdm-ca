/**
 * Test Assertion Helpers
 *
 * Custom assertions for common test patterns
 */

import { expect } from "bun:test";
import type { User } from "../../app/domain/user/entity";
import type {
  Document,
  DocumentVersion,
} from "../../app/domain/document/entity";
import type { DocumentPermission } from "../../app/domain/permission/entity";
import type { DocumentMetadata } from "../../app/domain/metedata/entity";

/**
 * Assert user properties match expected values
 */
export function assertUserMatches(
  actual: User,
  expected: Partial<User>,
  message?: string
) {
  const prefix = message ? `${message}: ` : "";

  if (expected.id !== undefined) {
    expect(actual.id).toBe(expected.id);
  }
  if (expected.email !== undefined) {
    expect(actual.email).toBe(expected.email);
  }
  if (expected.role !== undefined) {
    expect(actual.role).toBe(expected.role);
  }
}

/**
 * Assert document properties match expected values
 */
export function assertDocumentMatches(
  actual: Document,
  expected: Partial<Document>,
  message?: string
) {
  const prefix = message ? `${message}: ` : "";

  if (expected.id !== undefined) {
    expect(actual.id).toBe(expected.id);
  }
  if (expected.filename !== undefined) {
    expect(actual.filename).toBe(expected.filename);
  }
  if (expected.originalName !== undefined) {
    expect(actual.originalName).toBe(expected.originalName);
  }
  if (expected.mimeType !== undefined) {
    expect(actual.mimeType).toBe(expected.mimeType);
  }
  if (expected.size !== undefined) {
    expect(actual.size).toBe(expected.size);
  }
  if (expected.uploadedBy !== undefined) {
    expect(actual.uploadedBy).toBe(expected.uploadedBy);
  }
}

/**
 * Assert document version properties match expected values
 */
export function assertVersionMatches(
  actual: DocumentVersion,
  expected: Partial<DocumentVersion>,
  message?: string
) {
  const prefix = message ? `${message}: ` : "";

  if (expected.id !== undefined) {
    expect(actual.id).toBe(expected.id);
  }
  if (expected.documentId !== undefined) {
    expect(actual.documentId).toBe(expected.documentId);
  }
  if (expected.versionNumber !== undefined) {
    expect(actual.versionNumber).toBe(expected.versionNumber);
  }
  if (expected.uploadedBy !== undefined) {
    expect(actual.uploadedBy).toBe(expected.uploadedBy);
  }
}

/**
 * Assert permission properties match expected values
 */
export function assertPermissionMatches(
  actual: DocumentPermission,
  expected: Partial<DocumentPermission>,
  message?: string
) {
  const prefix = message ? `${message}: ` : "";

  if (expected.id !== undefined) {
    expect(actual.id).toBe(expected.id);
  }
  if (expected.documentId !== undefined) {
    expect(actual.documentId).toBe(expected.documentId);
  }
  if (expected.userId !== undefined) {
    expect(actual.userId).toBe(expected.userId);
  }
  if (expected.permission !== undefined) {
    expect(actual.permission).toBe(expected.permission);
  }
  if (expected.grantedBy !== undefined) {
    expect(actual.grantedBy).toBe(expected.grantedBy);
  }
}

/**
 * Assert metadata properties match expected values
 */
export function assertMetadataMatches(
  actual: DocumentMetadata,
  expected: Partial<DocumentMetadata>,
  message?: string
) {
  const prefix = message ? `${message}: ` : "";

  if (expected.id !== undefined) {
    expect(actual.id).toBe(expected.id);
  }
  if (expected.documentId !== undefined) {
    expect(actual.documentId).toBe(expected.documentId);
  }
  if (expected.key !== undefined) {
    expect(actual.key).toBe(expected.key);
  }
  if (expected.value !== undefined) {
    expect(actual.value).toBe(expected.value);
  }
}

/**
 * Assert array contains element matching predicate
 */
export function assertArrayContains<T>(
  array: T[],
  predicate: (item: T) => boolean,
  message?: string
) {
  const found = array.some(predicate);
  expect(found).toBe(true);
}

/**
 * Assert array does not contain element matching predicate
 */
export function assertArrayNotContains<T>(
  array: T[],
  predicate: (item: T) => boolean,
  message?: string
) {
  const found = array.some(predicate);
  expect(found).toBe(false);
}

/**
 * Assert Effect succeeds
 */
export async function assertEffectSucceeds<A, E>(
  effect: any,
  message?: string
): Promise<A> {
  try {
    const result = await effect.pipe((e: any) => e.runPromise());
    return result;
  } catch (error) {
    const msg = message || "Effect should succeed";
    throw new Error(`${msg}, but got error: ${error}`);
  }
}

/**
 * Assert Effect fails
 */
export async function assertEffectFails<A, E>(
  effect: any,
  message?: string
): Promise<E> {
  try {
    await effect.pipe((e: any) => e.runPromise());
    const msg = message || "Effect should fail";
    throw new Error(`${msg}, but it succeeded`);
  } catch (error) {
    return error as E;
  }
}

/**
 * Assert Effect fails with specific error type
 */
export async function assertEffectFailsWith<E>(
  effect: any,
  errorCheck: (error: E) => boolean,
  message?: string
): Promise<void> {
  try {
    await effect.pipe((e: any) => e.runPromise());
    const msg = message || "Effect should fail";
    throw new Error(`${msg}, but it succeeded`);
  } catch (error) {
    const matches = errorCheck(error as E);
    if (!matches) {
      throw new Error(
        `Effect failed but error doesn't match: ${JSON.stringify(error)}`
      );
    }
  }
}

/**
 * Assert object has required properties
 */
export function assertHasProperties<T extends Record<string, any>>(
  obj: T,
  properties: (keyof T)[],
  message?: string
) {
  properties.forEach((prop) => {
    expect(obj).toHaveProperty(String(prop));
  });
}

/**
 * Assert timestamp is recent (within last N seconds)
 */
export function assertTimestampRecent(
  timestamp: Date,
  withinSeconds: number = 5,
  message?: string
) {
  const now = Date.now();
  const timestampMs =
    timestamp instanceof Date ? timestamp.getTime() : Number(timestamp);
  const diff = Math.abs(now - timestampMs);
  const withinMs = withinSeconds * 1000;

  expect(diff).toBeLessThan(withinMs);
}
