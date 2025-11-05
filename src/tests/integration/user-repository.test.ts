/**
 * User Repository Integration Tests
 *
 * Tests UserRepository implementation with real database operations
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Effect, Option, Layer } from "effect";
import {
  setupTestDatabase,
  cleanupTestDatabase,
  type TestDatabase,
} from "../setup";
import { resetFactories, makeTestUser } from "../factories";
import { seedUser, getUserById, countUsers } from "../helpers";
import { UserRepositoryTag } from "../../app/domain/user/repository";
import { UserRepositoryLive } from "../../app/infrastructure/repositories/user-repository.impl";
import { DrizzleService } from "../../app/infrastructure/services/drizzle-service";
import type { User } from "../../app/domain/user/entity";

describe("UserRepository Integration Tests", () => {
  let db: TestDatabase;
  let testLayer: Layer.Layer<any, never, never>;

  beforeEach(() => {
    resetFactories();
    db = setupTestDatabase();

    // Create test layer with database
    testLayer = Layer.provide(
      UserRepositoryLive,
      Layer.succeed(DrizzleService, { db })
    );
  });

  afterEach(() => {
    cleanupTestDatabase(db);
  });

  describe("create", () => {
    test("should create a new user", async () => {
      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;

        const user = yield* repo.create({
          email: "test@example.com" as any,
          password: "hashed-password" as any,
          role: "USER",
        });

        expect(user.id).toBeDefined();
        expect(String(user.email)).toBe("test@example.com");
        expect(user.role).toBe("USER");
        expect(user.createdAt).toBeDefined();
        expect(user.updatedAt).toBeDefined();

        // Verify in database
        const dbUser = getUserById(db, user.id);
        expect(dbUser).toBeDefined();
        expect(dbUser.email).toBe("test@example.com");

        return user;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should fail when creating user with duplicate email", async () => {
      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;

        // Create first user
        yield* repo.create({
          email: "duplicate@example.com" as any,
          password: "hashed-password" as any,
          role: "USER",
        });

        // Try to create second user with same email
        yield* repo.create({
          email: "duplicate@example.com" as any,
          password: "other-password" as any,
          role: "USER",
        });
      });

      try {
        await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("already exists");
      }
    });

    test("should create admin user", async () => {
      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;

        const user = yield* repo.create({
          email: "admin@example.com" as any,
          password: "hashed-password" as any,
          role: "ADMIN",
        });

        expect(user.role).toBe("ADMIN");
        return user;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });
  });

  describe("findById", () => {
    test("should find user by ID", async () => {
      const seededUser = seedUser(db, {
        email: "findme@example.com",
        role: "USER",
      });

      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;
        const userOpt = yield* repo.findById(seededUser.id);

        expect(Option.isSome(userOpt)).toBe(true);

        if (Option.isSome(userOpt)) {
          const user = userOpt.value;
          expect(user.id).toBe(seededUser.id);
          expect(String(user.email)).toBe("findme@example.com");
          expect(user.role).toBe("USER");
        }
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should return None for non-existent user", async () => {
      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;
        const userOpt = yield* repo.findById("nonexistent-id" as any);

        expect(Option.isNone(userOpt)).toBe(true);
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });
  });

  describe("findByEmail", () => {
    test("should find user by email", async () => {
      const seededUser = seedUser(db, {
        email: "search@example.com",
        role: "USER",
      });

      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;
        const userOpt = yield* repo.findByEmail("search@example.com" as any);

        expect(Option.isSome(userOpt)).toBe(true);

        if (Option.isSome(userOpt)) {
          const user = userOpt.value;
          expect(user.id).toBe(seededUser.id);
          expect(String(user.email)).toBe("search@example.com");
        }
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should return None for non-existent email", async () => {
      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;
        const userOpt = yield* repo.findByEmail(
          "nonexistent@example.com" as any
        );

        expect(Option.isNone(userOpt)).toBe(true);
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should be case-sensitive for email lookup", async () => {
      seedUser(db, {
        email: "CaseSensitive@example.com",
      });

      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;

        // Exact match should work
        const exactOpt = yield* repo.findByEmail(
          "CaseSensitive@example.com" as any
        );
        expect(Option.isSome(exactOpt)).toBe(true);

        // Different case should not match
        const differentCaseOpt = yield* repo.findByEmail(
          "casesensitive@example.com" as any
        );
        expect(Option.isNone(differentCaseOpt)).toBe(true);
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });
  });

  describe("update", () => {
    test("should update user email", async () => {
      const seededUser = seedUser(db, {
        email: "old@example.com",
        role: "USER",
      });

      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;

        const updated = yield* repo.update(seededUser.id, {
          email: "new@example.com" as any,
        });

        expect(String(updated.email)).toBe("new@example.com");
        expect(updated.id).toBe(seededUser.id);

        // Verify in database
        const dbUser = getUserById(db, seededUser.id);
        expect(dbUser.email).toBe("new@example.com");

        return updated;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should update user password", async () => {
      const seededUser = seedUser(db, {
        email: "user@example.com",
        password: "old-hash",
      });

      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;

        const updated = yield* repo.update(seededUser.id, {
          password: "new-hash" as any,
        });

        expect(String(updated.password)).toBe("new-hash");

        // Verify in database
        const dbUser = getUserById(db, seededUser.id);
        expect(dbUser.password).toBe("new-hash");

        return updated;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should fail when updating to duplicate email", async () => {
      const user1 = seedUser(db, { email: "user1@example.com" });
      const user2 = seedUser(db, { email: "user2@example.com" });

      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;

        // Try to update user2's email to user1's email
        yield* repo.update(user2.id, {
          email: "user1@example.com" as any,
        });
      });

      try {
        await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("already in use");
      }
    });

    test("should fail when updating non-existent user", async () => {
      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;

        yield* repo.update("nonexistent-id" as any, {
          email: "new@example.com" as any,
        });
      });

      try {
        await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("not found");
      }
    });
  });

  describe("delete", () => {
    test("should delete user", async () => {
      const seededUser = seedUser(db, {
        email: "delete@example.com",
      });

      const initialCount = countUsers(db);

      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;

        yield* repo.delete(seededUser.id);

        // Verify user is deleted
        const userOpt = yield* repo.findById(seededUser.id);
        expect(Option.isNone(userOpt)).toBe(true);

        // Verify count decreased
        const finalCount = countUsers(db);
        expect(finalCount).toBe(initialCount - 1);
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should fail when deleting non-existent user", async () => {
      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;
        yield* repo.delete("nonexistent-id" as any);
      });

      try {
        await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("not found");
      }
    });

    test("should cascade delete related documents", async () => {
      const user = seedUser(db);
      const { seedDocument } = await import("../helpers");

      // Seed document owned by user
      seedDocument(db, { uploaded_by: user.id });

      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;

        yield* repo.delete(user.id);
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));

      // Verify documents are also deleted (cascade)
      const { getDocumentsForUser } = await import("../helpers");
      const documents = getDocumentsForUser(db, user.id);
      expect(documents.length).toBe(0);
    });
  });

  describe("listAll", () => {
    test("should list all users", async () => {
      seedUser(db, { email: "user1@example.com" });
      seedUser(db, { email: "user2@example.com" });
      seedUser(db, { email: "user3@example.com" });

      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;
        const users = yield* repo.listAll();

        expect(users.length).toBe(3);
        expect(users.some((u) => String(u.email) === "user1@example.com")).toBe(
          true
        );
        expect(users.some((u) => String(u.email) === "user2@example.com")).toBe(
          true
        );
        expect(users.some((u) => String(u.email) === "user3@example.com")).toBe(
          true
        );

        return users;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should return empty array when no users", async () => {
      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;
        const users = yield* repo.listAll();

        expect(users.length).toBe(0);
        expect(Array.isArray(users)).toBe(true);

        return users;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });
  });

  describe("Data Integrity", () => {
    test("created users should have valid timestamps", async () => {
      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;

        const user = yield* repo.create({
          email: "timestamp@example.com" as any,
          password: "hashed-password" as any,
          role: "USER",
        });

        // SQLite returns timestamps as strings in ISO format
        expect(typeof user.createdAt).toBe("string");
        expect(typeof user.updatedAt).toBe("string");

        // Timestamps should be recent (within last 5 seconds)
        const now = Date.now();
        const createdAtMs = new Date(user.createdAt as any).getTime();
        const updatedAtMs = new Date(user.updatedAt as any).getTime();

        expect(now - createdAtMs).toBeLessThan(5000);
        expect(now - updatedAtMs).toBeLessThan(5000);

        return user;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("updated users should have updated timestamp", async () => {
      const seededUser = seedUser(db, {
        email: "original@example.com",
        updated_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (Unix timestamp in seconds)
      });

      // Wait a bit to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      const program = Effect.gen(function* () {
        const repo = yield* UserRepositoryTag;

        const updated = yield* repo.update(seededUser.id, {
          email: "updated@example.com" as any,
        });

        // Parse the timestamp returned from the database (SQLite returns Unix timestamps in seconds)
        // The updatedAt field from SQLite is in seconds, not milliseconds
        const newUpdatedAtSeconds =
          typeof updated.updatedAt === "number"
            ? updated.updatedAt
            : Math.floor(new Date(updated.updatedAt as any).getTime() / 1000);

        // Updated timestamp should be more recent than or equal to original
        expect(newUpdatedAtSeconds).toBeGreaterThanOrEqual(
          seededUser.updated_at
        );

        return updated;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });
  });
});
