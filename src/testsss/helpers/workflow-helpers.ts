/**
 * Workflow Test Helpers
 *
 * Helpers for testing application workflows with dependency injection
 */

import { Effect, Layer, Context } from "effect";
import type { TestDatabase } from "../setup";
import { UserRepositoryTag } from "../../app/domain/user/repository";
import { DocumentRepositoryTag } from "../../app/domain/document/repository";
import { PermissionRepositoryTag } from "../../app/domain/permission/repository";
import { MetadataRepositoryTag } from "../../app/domain/metedata/repository";
import { MockStorageLive, MockPasswordHasherLive, MockJwtLive } from "../mocks";

/**
 * Create a test layer with all dependencies for workflows
 */
export function createTestWorkflowLayer(db: TestDatabase) {
  // We'll need to import repository implementations
  // For now, this is a placeholder structure
  return Layer.mergeAll(
    MockStorageLive,
    MockPasswordHasherLive,
    MockJwtLive
    // Add repository layers here
  );
}

/**
 * Run a workflow effect with test dependencies
 */
export async function runWorkflowTest<A, E>(
  db: TestDatabase,
  workflowEffect: Effect.Effect<A, E, any>
): Promise<A> {
  const testLayer = createTestWorkflowLayer(db);

  return await Effect.runPromise(
    workflowEffect.pipe(Effect.provide(testLayer)) as any
  );
}

/**
 * Execute workflow and expect success
 */
export async function expectWorkflowSuccess<A>(
  db: TestDatabase,
  workflowEffect: Effect.Effect<A, any, any>
): Promise<A> {
  try {
    return await runWorkflowTest(db, workflowEffect);
  } catch (error) {
    throw new Error(`Workflow should succeed but failed: ${error}`);
  }
}

/**
 * Execute workflow and expect failure
 */
export async function expectWorkflowFailure<E>(
  db: TestDatabase,
  workflowEffect: Effect.Effect<any, E, any>
): Promise<E> {
  try {
    await runWorkflowTest(db, workflowEffect);
    throw new Error("Workflow should fail but succeeded");
  } catch (error) {
    return error as E;
  }
}

/**
 * Execute workflow and expect specific error type
 */
export async function expectWorkflowError<E>(
  db: TestDatabase,
  workflowEffect: Effect.Effect<any, E, any>,
  errorCheck: (error: E) => boolean
): Promise<void> {
  try {
    await runWorkflowTest(db, workflowEffect);
    throw new Error("Workflow should fail but succeeded");
  } catch (error) {
    const matches = errorCheck(error as E);
    if (!matches) {
      throw new Error(`Expected error type didn't match: ${error}`);
    }
  }
}
