/**
 * User Workflow Integration Tests
 *
 * End-to-end tests for user registration, login, and profile management workflows
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Effect, Layer } from "effect";
import {
  setupTestDatabase,
  cleanupTestDatabase,
  type TestDatabase,
} from "../setup";
import { resetFactories } from "../factories";
import { countUsers, getUserById, seedUser } from "../helpers";
import {
  UserWorkflowTag,
  UserWorkflowLive,
} from "../../app/application/workflows/user-workflow";
import { UserRepositoryTag } from "../../app/domain/user/repository";
import { UserRepositoryLive } from "../../app/infrastructure/repositories/user-repository.impl";
import { DrizzleService } from "../../app/infrastructure/services/drizzle-service";
import {
  MockPasswordHasherLive,
  MockJwtLive,
  mockHashedPassword,
  decodeMockJwtToken,
} from "../mocks";

describe("User Workflow Integration Tests", () => {
  let db: TestDatabase;
  let testLayer: Layer.Layer<any, never, never>;

  beforeEach(() => {
    resetFactories();
    db = setupTestDatabase();

    // Build complete test layer with all dependencies
    const dbLayer = Layer.succeed(DrizzleService, { db });
    const repoLayer = Layer.provide(UserRepositoryLive, dbLayer);
    const appLayer = Layer.mergeAll(
      repoLayer,
      MockPasswordHasherLive,
      MockJwtLive
    );
    testLayer = Layer.provide(UserWorkflowLive, appLayer);
  });

  afterEach(() => {
    cleanupTestDatabase(db);
  });

  describe("registerUser workflow", () => {
    test("should successfully register a new user", async () => {
      const program = Effect.gen(function* () {
        const workflow = yield* UserWorkflowTag;

        const result = yield* workflow.registerUser({
          email: "newuser@example.com" as any,
          password: "SecurePassword123!" as any,
          role: "USER",
        });

        // Verify response structure
        expect(result.user).toBeDefined();
        expect(String(result.user.email)).toBe("newuser@example.com");
        expect(result.user.role).toBe("USER");
        expect(result.user.id).toBeDefined();
        expect(result.user.createdAt).toBeDefined();

        // Password should not be in response
        expect((result.user as any).password).toBeUndefined();

        // Verify user was persisted
        const dbUser = getUserById(db, result.user.id);
        expect(dbUser).toBeDefined();
        expect(dbUser.email).toBe("newuser@example.com");

        // Verify password was hashed
        expect(dbUser.password).toBe(mockHashedPassword("SecurePassword123!"));

        return result;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should register user with ADMIN role", async () => {
      const program = Effect.gen(function* () {
        const workflow = yield* UserWorkflowTag;

        const result = yield* workflow.registerUser({
          email: "admin@example.com" as any,
          password: "AdminPass123!" as any,
          role: "ADMIN",
        });

        expect(result.user.role).toBe("ADMIN");

        return result;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should fail when registering with duplicate email", async () => {
      // Seed existing user
      seedUser(db, {
        email: "existing@example.com",
        password: mockHashedPassword("password"),
      });

      const program = Effect.gen(function* () {
        const workflow = yield* UserWorkflowTag;

        yield* workflow.registerUser({
          email: "existing@example.com" as any,
          password: "NewPassword123!" as any,
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

    test("should create user with proper timestamps", async () => {
      const program = Effect.gen(function* () {
        const workflow = yield* UserWorkflowTag;

        const result = yield* workflow.registerUser({
          email: "timestamps@example.com" as any,
          password: "Password123!" as any,
          role: "USER",
        });

        expect(result.user.createdAt).toBeDefined();
        expect(result.user.updatedAt).toBeDefined();

        // Timestamps should be recent (within last 5 seconds)
        const now = Date.now();
        const createdAtMs = new Date(result.user.createdAt as any).getTime();
        const updatedAtMs = new Date(result.user.updatedAt as any).getTime();

        expect(now - createdAtMs).toBeLessThan(5000);
        expect(now - updatedAtMs).toBeLessThan(5000);

        return result;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });
  });

  describe("loginUser workflow", () => {
    test("should successfully login with correct credentials", async () => {
      // Seed user with known credentials
      const user = seedUser(db, {
        email: "login@example.com",
        password: mockHashedPassword("CorrectPassword123!"),
        role: "USER",
      });

      const program = Effect.gen(function* () {
        const workflow = yield* UserWorkflowTag;

        const result = yield* workflow.loginUser({
          email: "login@example.com" as any,
          password: "CorrectPassword123!" as any,
        });

        // Verify response structure
        expect(result.user).toBeDefined();
        expect(String(result.user.email)).toBe("login@example.com");
        expect(result.user.id).toBe(user.id);
        expect(result.token).toBeDefined();
        expect(result.expiresIn).toBe(3600);

        // Password should not be in response
        expect((result.user as any).password).toBeUndefined();

        // Verify JWT token contains correct payload
        const payload = decodeMockJwtToken(result.token);
        expect(payload).toBeDefined();
        expect(payload?.userId).toBe(user.id);
        expect(String(payload?.email)).toBe("login@example.com");
        expect(payload?.role).toBe("USER");

        return result;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should fail with incorrect password", async () => {
      seedUser(db, {
        email: "user@example.com",
        password: mockHashedPassword("CorrectPassword123!"),
      });

      const program = Effect.gen(function* () {
        const workflow = yield* UserWorkflowTag;

        yield* workflow.loginUser({
          email: "user@example.com" as any,
          password: "WrongPassword123!" as any,
        });
      });

      try {
        await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("Invalid");
      }
    });

    test("should fail with non-existent email", async () => {
      const program = Effect.gen(function* () {
        const workflow = yield* UserWorkflowTag;

        yield* workflow.loginUser({
          email: "nonexistent@example.com" as any,
          password: "AnyPassword" as any,
        });
      });

      try {
        await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("Invalid");
      }
    });

    test("should login admin user and include role in token", async () => {
      const admin = seedUser(db, {
        email: "admin@example.com",
        password: mockHashedPassword("AdminPass123!"),
        role: "ADMIN",
      });

      const program = Effect.gen(function* () {
        const workflow = yield* UserWorkflowTag;

        const result = yield* workflow.loginUser({
          email: "admin@example.com" as any,
          password: "AdminPass123!" as any,
        });

        expect(result.user.role).toBe("ADMIN");

        const payload = decodeMockJwtToken(result.token);
        expect(payload?.role).toBe("ADMIN");

        return result;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });
  });

  describe("getUserProfile workflow", () => {
    test("should retrieve user profile by ID", async () => {
      const user = seedUser(db, {
        email: "profile@example.com",
        role: "USER",
      });

      const program = Effect.gen(function* () {
        const workflow = yield* UserWorkflowTag;

        const profile = yield* workflow.getUserProfile({
          userId: user.id as any,
        });

        expect(profile.id).toBe(user.id);
        expect(String(profile.email)).toBe("profile@example.com");
        expect(profile.role).toBe("USER");

        // Password should not be included
        expect((profile as any).password).toBeUndefined();

        return profile;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should fail for non-existent user ID", async () => {
      const program = Effect.gen(function* () {
        const workflow = yield* UserWorkflowTag;

        yield* workflow.getUserProfile({
          userId: "nonexistent-id" as any,
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

  describe("updateUserProfile workflow", () => {
    test("should update user email", async () => {
      const user = seedUser(db, {
        email: "old@example.com",
        role: "USER",
      });

      const program = Effect.gen(function* () {
        const workflow = yield* UserWorkflowTag;

        const updated = yield* workflow.updateUserProfile(user.id as any, {
          email: "new@example.com" as any,
        });

        expect(String(updated.email)).toBe("new@example.com");
        expect(updated.id).toBe(user.id);

        // Verify in database
        const dbUser = getUserById(db, user.id);
        expect(dbUser.email).toBe("new@example.com");

        return updated;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should update user password", async () => {
      const user = seedUser(db, {
        email: "user@example.com",
        password: mockHashedPassword("OldPassword"),
        role: "USER",
      });

      const program = Effect.gen(function* () {
        const workflow = yield* UserWorkflowTag;

        const updated = yield* workflow.updateUserProfile(user.id as any, {
          password: "NewPassword123!" as any,
        });

        // Verify password was hashed
        const dbUser = getUserById(db, user.id);
        expect(dbUser.password).toBe(mockHashedPassword("NewPassword123!"));

        return updated;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });

    test("should fail when updating to duplicate email", async () => {
      const user1 = seedUser(db, { email: "user1@example.com" });
      const user2 = seedUser(db, { email: "user2@example.com" });

      const program = Effect.gen(function* () {
        const workflow = yield* UserWorkflowTag;

        yield* workflow.updateUserProfile(user2.id as any, {
          email: "user1@example.com" as any,
        });
      });

      try {
        await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("already exists");
      }
    });
  });

  describe("Complete Registration → Login Flow", () => {
    test("should register user and then login successfully", async () => {
      const program = Effect.gen(function* () {
        const workflow = yield* UserWorkflowTag;

        // Step 1: Register
        const registerResult = yield* workflow.registerUser({
          email: "fullflow@example.com" as any,
          password: "MyPassword123!" as any,
          role: "USER",
        });

        expect(registerResult.user).toBeDefined();
        const userId = registerResult.user.id;

        // Step 2: Login with same credentials
        const loginResult = yield* workflow.loginUser({
          email: "fullflow@example.com" as any,
          password: "MyPassword123!" as any,
        });

        expect(loginResult.user.id).toBe(userId);
        expect(loginResult.token).toBeDefined();

        // Step 3: Use token to get profile
        const profile = yield* workflow.getUserProfile({
          userId: loginResult.user.id,
        });

        expect(profile.id).toBe(userId);
        expect(String(profile.email)).toBe("fullflow@example.com");

        return { registerResult, loginResult, profile };
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });
  });

  describe("Multi-User Scenarios", () => {
    test("should handle multiple concurrent user registrations", async () => {
      const program = Effect.gen(function* () {
        const workflow = yield* UserWorkflowTag;

        // Register 3 users concurrently
        const results = yield* Effect.all([
          workflow.registerUser({
            email: "user1@example.com" as any,
            password: "Password123!" as any,
            role: "USER",
          }),
          workflow.registerUser({
            email: "user2@example.com" as any,
            password: "Password123!" as any,
            role: "USER",
          }),
          workflow.registerUser({
            email: "user3@example.com" as any,
            password: "Password123!" as any,
            role: "USER",
          }),
        ]);

        expect(results.length).toBe(3);
        expect(results[0].user.id).not.toBe(results[1].user.id);
        expect(results[1].user.id).not.toBe(results[2].user.id);

        // Verify all users in database
        expect(countUsers(db)).toBe(3);

        return results;
      });

      await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
    });
  });
});
