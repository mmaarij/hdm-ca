/**
 * User Workflow
 *
 * Orchestrates user-related use cases.
 * Pure application logic - no HTTP, DB, or storage concerns.
 */

import { Effect, Option, Context, Layer, pipe } from "effect";
import { UserRepositoryTag } from "../../domain/user/repository";
import { User } from "../../domain/user/entity";
import {
  UserNotFoundError,
  UserAlreadyExistsError,
} from "../../domain/user/errors";
import { NotFoundError, ForbiddenError } from "../../domain/shared/base.errors";
import { InvalidCredentialsError } from "../utils/errors";
import { withUseCaseLogging } from "../utils/logging";
import { withPerformanceTracking } from "../utils/performance";
import {
  PasswordHasherPort,
  PasswordHasherPortTag,
} from "../ports/password-hasher.port";
import { JwtPort, JwtPortTag } from "../ports/jwt.port";
import { makePassword, HashedPassword } from "../../domain/refined/password";
import { EmailAddress } from "../../domain/refined/email";
import { UserRole } from "../../domain/user/value-object";
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
import { UserId } from "../../domain/refined/uuid";
import { loadEntity } from "../utils/effect-helpers";
import { UserResponseMapper, UserCommandMapper } from "../mappers/user.mapper";

/**
 * User Workflow Interface
 */
export interface UserWorkflow {
  /**
   * Register a new user
   */
  readonly registerUser: (
    command: RegisterUserCommand
  ) => Effect.Effect<RegisterResponse, UserAlreadyExistsError | Error>;

  /**
   * Login user and generate authentication token
   */
  readonly loginUser: (
    command: LoginUserCommand
  ) => Effect.Effect<LoginResponse, InvalidCredentialsError | Error>;

  /**
   * Get user profile by ID
   */
  readonly getUserProfile: (
    query: GetUserQuery
  ) => Effect.Effect<UserResponse, NotFoundError | Error>;

  /**
   * Update user profile
   */
  readonly updateUserProfile: (
    userId: UserId,
    command: UpdateUserProfileCommand
  ) => Effect.Effect<UserResponse, NotFoundError | Error>;

  /**
   * List all users (admin only)
   */
  readonly listUsers: (
    query: ListUsersQuery
  ) => Effect.Effect<ListUsersResponse, Error>;

  /**
   * Delete user (admin only or self)
   */
  readonly deleteUser: (
    command: DeleteUserCommand,
    requestingUserId: UserId
  ) => Effect.Effect<void, NotFoundError | ForbiddenError | Error>;
}

export const UserWorkflowTag =
  Context.GenericTag<UserWorkflow>("@app/UserWorkflow");

/**
 * Live implementation of UserWorkflow
 */
export const UserWorkflowLive = Layer.effect(
  UserWorkflowTag,
  Effect.gen(function* () {
    const userRepo = yield* UserRepositoryTag;
    const passwordHasher = yield* PasswordHasherPortTag;
    const jwtService = yield* JwtPortTag;

    const registerUser: UserWorkflow["registerUser"] = (command) =>
      withPerformanceTracking(
        "RegisterUser",
        withUseCaseLogging(
          "RegisterUser",
          pipe(
            // Check if user already exists
            userRepo.findByEmail(command.email),
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
            // Hash password
            Effect.flatMap(() => makePassword(command.password)),
            Effect.flatMap((password) => passwordHasher.hash(password)),
            // Create and save user
            Effect.flatMap((hashedPassword) => {
              const newUser = User.create({
                email: command.email,
                password: hashedPassword as HashedPassword,
                role: command.role,
              });
              return userRepo.save(newUser);
            }),
            // Map to response
            Effect.mapError((e) =>
              e instanceof Error ? e : new Error(String(e))
            ),
            Effect.map((user) => UserResponseMapper.toRegisterResponse(user))
          ),
          { email: command.email }
        )
      );

    const loginUser: UserWorkflow["loginUser"] = (command) =>
      withPerformanceTracking(
        "LoginUser",
        withUseCaseLogging(
          "LoginUser",
          pipe(
            // Find user by email
            userRepo.findByEmail(command.email),
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
            // Verify password
            Effect.flatMap((user) =>
              pipe(
                makePassword(command.password),
                Effect.flatMap((password) =>
                  passwordHasher.verify(password, user.password)
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
            // Generate JWT token
            Effect.flatMap((user) =>
              pipe(
                jwtService.sign({
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
            // Map to response
            Effect.mapError((e) =>
              e instanceof Error ? e : new Error(String(e))
            ),
            Effect.map(({ user, token, expiresIn }) =>
              UserResponseMapper.toLoginResponse(user, token, expiresIn)
            )
          ),
          { email: command.email }
        )
      );

    const getUserProfile: UserWorkflow["getUserProfile"] = (query) =>
      withUseCaseLogging(
        "GetUserProfile",
        pipe(
          // Load user
          loadEntity(userRepo.findById(query.userId), "User", query.userId),
          Effect.mapError((e) =>
            "_tag" in e && e._tag === "NotFoundError" ? new NotFoundError(e) : e
          ),
          // Map to response (exclude password)
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map((user) => UserResponseMapper.toUserProfileResponse(user))
        ),
        { userId: query.userId }
      );

    const updateUserProfile: UserWorkflow["updateUserProfile"] = (
      userId,
      command
    ) =>
      withUseCaseLogging(
        "UpdateUserProfile",
        pipe(
          // Load existing user
          loadEntity(userRepo.findById(userId), "User", userId),
          Effect.mapError((e) =>
            "_tag" in e && e._tag === "NotFoundError" ? new NotFoundError(e) : e
          ),
          // Check email uniqueness if updating email
          Effect.flatMap((user) =>
            command.email
              ? pipe(
                  userRepo.findByEmail(command.email),
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.succeed(user),
                      onSome: (existingUser: User) =>
                        existingUser.id !== userId
                          ? Effect.fail(
                              new UserAlreadyExistsError({
                                email: command.email!,
                                message: `User with email ${command.email} already exists`,
                              })
                            )
                          : Effect.succeed(user),
                    })
                  )
                )
              : Effect.succeed(user)
          ),
          // Hash password if updating
          Effect.flatMap((user) =>
            command.password
              ? pipe(
                  makePassword(command.password),
                  Effect.flatMap((password) => passwordHasher.hash(password)),
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
          // Update and save user
          Effect.flatMap(({ user, updates }) => {
            const updatedUser = User.update(user, updates);
            return userRepo.save(updatedUser);
          }),
          // Map to response
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map((savedUser) =>
            UserResponseMapper.toUserResponse(savedUser)
          )
        ),
        { userId }
      );

    const listUsers: UserWorkflow["listUsers"] = (query) =>
      withPerformanceTracking(
        "ListUsers",
        withUseCaseLogging(
          "ListUsers",
          pipe(
            // Verify requesting user is admin
            loadEntity(userRepo.findById(query.userId), "User", query.userId),
            Effect.mapError((e) =>
              "_tag" in e && e._tag === "NotFoundError"
                ? new NotFoundError(e)
                : e
            ),
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
            // Get all users
            Effect.flatMap(() => userRepo.listAll()),
            // Apply pagination
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
            // Map errors
            Effect.mapError((e) =>
              e instanceof Error ? e : new Error(String(e))
            )
          )
        )
      );

    const deleteUser: UserWorkflow["deleteUser"] = (
      command,
      requestingUserId
    ) =>
      withUseCaseLogging(
        "DeleteUser",
        pipe(
          // Load both users in parallel
          Effect.all({
            user: loadEntity(
              userRepo.findById(command.userId),
              "User",
              command.userId
            ),
            requestingUser: loadEntity(
              userRepo.findById(requestingUserId),
              "User",
              requestingUserId
            ),
          }),
          Effect.mapError((e) =>
            "_tag" in e && e._tag === "NotFoundError" ? new NotFoundError(e) : e
          ),
          // Check authorization
          Effect.flatMap(({ user, requestingUser }) => {
            const isAdmin = requestingUser.role === "ADMIN";
            const isSelf = requestingUserId === command.userId;

            if (!isAdmin && !isSelf) {
              return Effect.fail(
                new ForbiddenError({
                  message:
                    "Only admins or the user themselves can delete a user",
                  resource: `User:${command.userId}`,
                })
              );
            }

            return Effect.succeed(user);
          }),
          // Delete user
          Effect.flatMap(() => userRepo.delete(command.userId)),
          // Map errors
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          )
        ),
        { userId: command.userId, requestingUserId }
      );

    return {
      registerUser,
      loginUser,
      getUserProfile,
      updateUserProfile,
      listUsers,
      deleteUser,
    } satisfies UserWorkflow;
  })
);
