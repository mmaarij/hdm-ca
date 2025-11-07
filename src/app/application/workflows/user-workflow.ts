/**
 * User Workflow - Functional Pattern
 *
 * Functional workflows using currying pattern.
 * No Effect.gen usage - pure monadic composition with pipe.
 */

import { Effect, Option, pipe } from "effect";
import { v4 as uuidv4 } from "uuid";
import type { UserRepository } from "../../domain/user/repository";
import { UserEntity as User } from "../../domain/user/entity";
import {
  UserNotFoundError,
  UserAlreadyExistsError,
} from "../../domain/user/errors";
import { NotFoundError, ForbiddenError } from "../../domain/shared/base.errors";
import { InvalidCredentialsError } from "../utils/errors";
import type { PasswordHasherPort } from "../ports/password-hasher.port";
import type { JwtPort } from "../ports/jwt.port";
import { makePassword, HashedPassword } from "../../domain/refined/password";
import { loadEntity } from "../utils/effect-helpers";
import type {
  RegisterUserCommand,
  LoginUserCommand,
  UpdateUserProfileCommand,
  GetUserQuery,
  ListUsersQuery,
  DeleteUserCommand,
} from "../dtos/user/request.dto";
import type {
  UserResponse,
  LoginResponse,
  RegisterResponse,
  ListUsersResponse,
} from "../dtos/user/response.dto";
import type { UserId } from "../../domain/refined/uuid";
import { UserResponseMapper } from "../mappers/user.mapper";

// Re-export WorkflowTag from bootstrap for route compatibility
export { UserWorkflowTag } from "../../bootstrap";

/**
 * Dependencies for user workflows
 */
export interface UserWorkflowDeps {
  readonly userRepo: UserRepository;
  readonly passwordHasher: PasswordHasherPort;
  readonly jwtService: JwtPort;
}

/**
 * Register a new user
 */
export const registerUser =
  (deps: UserWorkflowDeps) =>
  (
    command: RegisterUserCommand
  ): Effect.Effect<RegisterResponse, UserAlreadyExistsError | Error> =>
    pipe(
      deps.userRepo.findByEmail(command.email),
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.succeed(undefined),
          onSome: () =>
            Effect.fail(
              new UserAlreadyExistsError({
                email: command.email,
                message: `User with email ${command.email} already exists`,
              })
            ),
        })
      ),
      Effect.flatMap(() => makePassword(command.password)),
      Effect.flatMap((password) => deps.passwordHasher.hash(password)),
      Effect.flatMap((hashedPassword) => {
        const now = new Date().toISOString();
        return pipe(
          User.create({
            id: uuidv4() as any,
            email: command.email,
            password: hashedPassword as HashedPassword,
            role: command.role ?? ("USER" as any),
            createdAt: now as any,
            updatedAt: now as any,
          }),
          Effect.flatMap((newUser) => deps.userRepo.save(newUser))
        );
      }),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e)))),
      Effect.map((user) => UserResponseMapper.toRegisterResponse(user))
    );

/**
 * Login user and generate authentication token
 */
export const loginUser =
  (deps: UserWorkflowDeps) =>
  (
    command: LoginUserCommand
  ): Effect.Effect<LoginResponse, InvalidCredentialsError | Error> =>
    pipe(
      deps.userRepo.findByEmail(command.email),
      Effect.flatMap(
        Option.match({
          onNone: () =>
            Effect.fail(
              new InvalidCredentialsError({
                message: "Invalid email or password",
              })
            ),
          onSome: (user: User) => Effect.succeed(user),
        })
      ),
      Effect.flatMap((user) =>
        pipe(
          makePassword(command.password),
          Effect.flatMap((password) =>
            deps.passwordHasher.verify(password, user.password)
          ),
          Effect.flatMap((isValid) =>
            isValid
              ? Effect.succeed(user)
              : Effect.fail(
                  new InvalidCredentialsError({
                    message: "Invalid email or password",
                  })
                )
          )
        )
      ),
      Effect.flatMap((user) =>
        pipe(
          deps.jwtService.sign({
            userId: user.id,
            email: user.email,
            role: user.role,
          }),
          Effect.map(({ token, expiresIn }) => ({
            user,
            token,
            expiresIn,
          }))
        )
      ),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e)))),
      Effect.map(({ user, token, expiresIn }) =>
        UserResponseMapper.toLoginResponse(user, token, expiresIn)
      )
    );

/**
 * Get user profile by ID
 */
export const getUserProfile =
  (deps: UserWorkflowDeps) =>
  (query: GetUserQuery): Effect.Effect<UserResponse, NotFoundError | Error> =>
    pipe(
      deps.userRepo.findById(query.userId),
      Effect.flatMap(
        Option.match({
          onNone: () =>
            Effect.fail(
              new NotFoundError({
                entityType: "User",
                id: query.userId,
              })
            ),
          onSome: Effect.succeed,
        })
      ),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e)))),
      Effect.map((user) => UserResponseMapper.toUserProfileResponse(user))
    );

/**
 * Update user profile
 */
export const updateUserProfile =
  (deps: UserWorkflowDeps) =>
  (
    userId: UserId,
    command: UpdateUserProfileCommand
  ): Effect.Effect<UserResponse, NotFoundError | Error> =>
    pipe(
      deps.userRepo.findById(userId),
      Effect.flatMap(
        Option.match({
          onNone: () =>
            Effect.fail(
              new NotFoundError({
                entityType: "User",
                id: userId,
              })
            ),
          onSome: Effect.succeed,
        })
      ),
      Effect.flatMap((user) =>
        command.email
          ? pipe(
              deps.userRepo.findByEmail(command.email),
              Effect.flatMap(
                Option.match({
                  onNone: () => Effect.succeed(user),
                  onSome: (existingUser) =>
                    existingUser.id === userId
                      ? Effect.succeed(user)
                      : Effect.fail(
                          new UserAlreadyExistsError({
                            email: command.email!,
                            message: `Email ${command.email} is already in use`,
                          })
                        ),
                })
              )
            )
          : Effect.succeed(user)
      ),
      Effect.flatMap((user) =>
        command.password
          ? pipe(
              makePassword(command.password),
              Effect.flatMap((password) => deps.passwordHasher.hash(password)),
              Effect.map((hashedPassword) => ({
                user,
                updates: {
                  email: command.email,
                  password: hashedPassword as HashedPassword,
                },
              }))
            )
          : Effect.succeed({
              user,
              updates: {
                email: command.email,
              },
            })
      ),
      Effect.flatMap(({ user, updates }) => {
        const updatedUser = user.update(updates);
        return deps.userRepo.save(updatedUser);
      }),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e)))),
      Effect.map((user) => UserResponseMapper.toUserProfileResponse(user))
    );

/**
 * List all users (admin only)
 */
export const listUsers =
  (deps: UserWorkflowDeps) =>
  (
    query: ListUsersQuery
  ): Effect.Effect<ListUsersResponse, NotFoundError | ForbiddenError | Error> =>
    pipe(
      loadEntity(deps.userRepo.findById(query.userId), "User", query.userId),
      Effect.flatMap((requestingUser) =>
        requestingUser.role === "ADMIN"
          ? Effect.succeed(requestingUser)
          : Effect.fail(
              new ForbiddenError({
                message: "Only administrators can list all users",
                resource: "Users",
              })
            )
      ),
      Effect.flatMap(() => deps.userRepo.listAll()),
      Effect.map((users) => {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedUsers = users.slice(startIndex, endIndex);

        return UserResponseMapper.toListUsersResponse(
          paginatedUsers,
          users.length,
          page,
          limit
        );
      }),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e))))
    );

/**
 * Delete user (admin only or self)
 */
export const deleteUser =
  (deps: UserWorkflowDeps) =>
  (
    command: DeleteUserCommand,
    requestingUserId: UserId
  ): Effect.Effect<void, NotFoundError | ForbiddenError | Error> =>
    pipe(
      Effect.all({
        targetUser: loadEntity(
          deps.userRepo.findById(command.userId),
          "User",
          command.userId
        ),
        requestingUser: loadEntity(
          deps.userRepo.findById(requestingUserId),
          "User",
          requestingUserId
        ),
      }),
      Effect.flatMap(({ targetUser, requestingUser }) => {
        const isAdmin = requestingUser.role === "ADMIN";
        const isSelf = requestingUserId === command.userId;

        if (!isAdmin && !isSelf) {
          return Effect.fail(
            new ForbiddenError({
              message: "Only admins or the user themselves can delete a user",
              resource: `User:${command.userId}`,
            })
          );
        }

        return Effect.succeed(targetUser);
      }),
      Effect.flatMap(() => deps.userRepo.delete(command.userId)),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e))))
    );
