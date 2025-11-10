import { Effect, Option, Layer, pipe } from "effect";
import { eq } from "drizzle-orm";
import {
  UserRepository,
  UserRepositoryTag,
} from "../../domain/user/repository";
import { UserEntity as User } from "../../domain/user/entity";
import {
  UserNotFoundError,
  UserAlreadyExistsError,
  UserConstraintError,
} from "../../domain/user/errors";
import { DrizzleService, hasAffectedRows } from "../services/drizzle-service";
import { users } from "../models";
import { UserMapper } from "../mappers/user.mapper";
import { detectDbConstraint } from "../../domain/shared/base.repository";

/**
 * User Repository Implementation using Drizzle ORM
 */
export const UserRepositoryLive = Layer.effect(
  UserRepositoryTag,
  Effect.gen(function* () {
    const { db } = yield* DrizzleService;

    const save: UserRepository["save"] = (user) =>
      pipe(
        // Check if user exists
        Effect.tryPromise({
          try: () => db.query.users.findFirst({ where: eq(users.id, user.id) }),
          catch: () => new UserConstraintError({ message: "Database error" }),
        }),
        Effect.flatMap((existingUserRow) => {
          if (existingUserRow) {
            // Update existing user
            const updateData = UserMapper.toDbUpdate(user);

            return Effect.tryPromise({
              try: () =>
                db.update(users).set(updateData).where(eq(users.id, user.id)),
              catch: (error) => {
                const constraintType = detectDbConstraint(error);
                if (constraintType === "unique") {
                  return new UserAlreadyExistsError({
                    email: user.email,
                    message: "Email already in use",
                  });
                }
                return new UserConstraintError({
                  message: "Database constraint violation",
                });
              },
            });
          } else {
            // Create new user
            const createData = UserMapper.toDbCreate(user);

            return Effect.tryPromise({
              try: () => db.insert(users).values(createData),
              catch: (error) => {
                const constraintType = detectDbConstraint(error);
                if (constraintType === "unique") {
                  return new UserAlreadyExistsError({
                    email: user.email,
                    message: "User with this email already exists",
                  });
                }
                return new UserConstraintError({
                  message: "Database constraint violation",
                });
              },
            });
          }
        }),
        // Fetch the saved user
        Effect.flatMap(() =>
          Effect.tryPromise({
            try: () =>
              db.query.users.findFirst({ where: eq(users.id, user.id) }),
            catch: () =>
              new UserNotFoundError({
                userId: user.id,
                message: "User not found after save",
              }),
          })
        ),
        Effect.flatMap((savedUserRow) =>
          savedUserRow
            ? Effect.succeed(UserMapper.toDomain(savedUserRow))
            : Effect.fail(
                new UserNotFoundError({
                  userId: user.id,
                  message: "User not found after save",
                })
              )
        )
      );

    const findById: UserRepository["findById"] = (id) =>
      pipe(
        Effect.tryPromise({
          try: () => db.query.users.findFirst({ where: eq(users.id, id) }),
          catch: () => new UserConstraintError({ message: "Database error" }),
        }),
        Effect.map((userRow) =>
          pipe(Option.fromNullable(userRow), Option.map(UserMapper.toDomain))
        )
      );

    const findByEmail: UserRepository["findByEmail"] = (email) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db.query.users.findFirst({ where: eq(users.email, email) }),
          catch: () => new UserConstraintError({ message: "Database error" }),
        }),
        Effect.map((userRow) =>
          pipe(Option.fromNullable(userRow), Option.map(UserMapper.toDomain))
        )
      );

    const deleteUser: UserRepository["delete"] = (id) =>
      pipe(
        Effect.tryPromise({
          try: () => db.delete(users).where(eq(users.id, id)),
          catch: () => new UserConstraintError({ message: "Database error" }),
        }),
        Effect.flatMap((result) => {
          // Check if any rows were affected (Bun SQLite returns result with changes)
          if (!hasAffectedRows(result)) {
            return Effect.fail(
              new UserNotFoundError({ userId: id, message: "User not found" })
            );
          }
          return Effect.succeed(undefined);
        })
      );

    const listAll: UserRepository["listAll"] = () =>
      pipe(
        Effect.tryPromise({
          try: () => db.query.users.findMany(),
          catch: () => new UserConstraintError({ message: "Database error" }),
        }),
        Effect.map(UserMapper.toDomainMany)
      );

    const existsByEmail: UserRepository["existsByEmail"] = (email) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db.query.users.findFirst({ where: eq(users.email, email) }),
          catch: () => new UserConstraintError({ message: "Database error" }),
        }),
        Effect.map((userRow) => userRow !== undefined && userRow !== null)
      );

    return {
      save,
      findById,
      findByEmail,
      delete: deleteUser,
      listAll,
      existsByEmail,
    } satisfies UserRepository;
  })
);
