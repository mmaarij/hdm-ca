import { Effect, Option, Layer, Context } from "effect";
import { eq } from "drizzle-orm";
import {
  UserRepository,
  UserRepositoryTag,
} from "../../domain/user/repository";
import {
  User,
  CreateUserPayload,
  UpdateUserPayload,
} from "../../domain/user/entity";
import {
  UserNotFoundError,
  UserAlreadyExistsError,
  UserConstraintError,
  UserDomainError,
} from "../../domain/user/errors";
import { DrizzleService } from "../services/drizzle-service";
import { users } from "../models";
import { v4 as uuid } from "uuid";
import { detectDbConstraint } from "../../domain/shared/base.repository";

/**
 * User Repository Implementation using Drizzle ORM
 */
export const UserRepositoryLive = Layer.effect(
  UserRepositoryTag,
  Effect.gen(function* () {
    const { db } = yield* DrizzleService;

    const create: UserRepository["create"] = (payload) =>
      Effect.gen(function* () {
        const id = uuid();

        yield* Effect.tryPromise({
          try: () =>
            db.insert(users).values({
              id,
              email: payload.email,
              password: payload.password, // Already hashed by workflow
              role: payload.role || "USER",
            }),
          catch: (error) => {
            const constraintType = detectDbConstraint(error);
            if (constraintType === "unique") {
              return new UserAlreadyExistsError({
                email: payload.email,
                message: "User with this email already exists",
              });
            }
            return new UserConstraintError({
              message: "Database constraint violation",
            });
          },
        });

        const user = yield* Effect.tryPromise({
          try: () => db.query.users.findFirst({ where: eq(users.id, id) }),
          catch: () =>
            new UserNotFoundError({
              userId: id,
              message: "User was created but could not be retrieved",
            }),
        });

        if (!user) {
          return yield* Effect.fail(
            new UserNotFoundError({
              userId: id,
              message: "User not found after creation",
            })
          );
        }

        return user as unknown as User;
      });

    const findById: UserRepository["findById"] = (id) =>
      Effect.gen(function* () {
        const user = yield* Effect.tryPromise({
          try: () => db.query.users.findFirst({ where: eq(users.id, id) }),
          catch: () => new UserConstraintError({ message: "Database error" }),
        });

        return Option.fromNullable(user as unknown as User);
      });

    const findByEmail: UserRepository["findByEmail"] = (email) =>
      Effect.gen(function* () {
        const user = yield* Effect.tryPromise({
          try: () =>
            db.query.users.findFirst({ where: eq(users.email, email) }),
          catch: () => new UserConstraintError({ message: "Database error" }),
        });

        return Option.fromNullable(user as unknown as User);
      });

    const update: UserRepository["update"] = (id, payload) =>
      Effect.gen(function* () {
        const updateData: any = {};

        if (payload.email) updateData.email = payload.email;
        if (payload.password) {
          updateData.password = payload.password; // Already hashed by workflow
        }
        if (payload.role) updateData.role = payload.role;

        yield* Effect.tryPromise({
          try: () => db.update(users).set(updateData).where(eq(users.id, id)),
          catch: (error) => {
            const constraintType = detectDbConstraint(error);
            if (constraintType === "unique") {
              return new UserAlreadyExistsError({
                email: payload.email || "",
                message: "Email already in use",
              });
            }
            return new UserConstraintError({
              message: "Database constraint violation",
            });
          },
        });

        const updated = yield* Effect.tryPromise({
          try: () => db.query.users.findFirst({ where: eq(users.id, id) }),
          catch: () =>
            new UserNotFoundError({ userId: id, message: "User not found" }),
        });

        if (!updated) {
          return yield* Effect.fail(
            new UserNotFoundError({ userId: id, message: "User not found" })
          );
        }

        return updated as unknown as User;
      });

    const deleteUser: UserRepository["delete"] = (id) =>
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise({
          try: () => db.delete(users).where(eq(users.id, id)),
          catch: () => new UserConstraintError({ message: "Database error" }),
        });

        // Check if any rows were affected (Bun SQLite returns result with changes)
        if (!(result as any).changes && !(result as any).rowCount) {
          return yield* Effect.fail(
            new UserNotFoundError({ userId: id, message: "User not found" })
          );
        }
      });

    const listAll: UserRepository["listAll"] = () =>
      Effect.gen(function* () {
        const allUsers = yield* Effect.tryPromise({
          try: () => db.query.users.findMany(),
          catch: () => new UserConstraintError({ message: "Database error" }),
        });

        return allUsers as unknown as readonly User[];
      });

    const existsByEmail: UserRepository["existsByEmail"] = (email) =>
      Effect.gen(function* () {
        const user = yield* Effect.tryPromise({
          try: () =>
            db.query.users.findFirst({ where: eq(users.email, email) }),
          catch: () => new UserConstraintError({ message: "Database error" }),
        });

        return user !== undefined && user !== null;
      });

    return {
      create,
      findById,
      findByEmail,
      update,
      delete: deleteUser,
      listAll,
      existsByEmail,
    } satisfies UserRepository;
  })
);
