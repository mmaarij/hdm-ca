/**
 * User Workflow
 *
 * Orchestrates user-related use cases.
 * Pure application logic - no HTTP, DB, or storage concerns.
 */

import { Effect, Option, Context, Layer } from "effect";
import { UserRepositoryTag } from "../../domain/user/repository";
import {
  UserNotFoundError,
  UserAlreadyExistsError,
} from "../../domain/user/errors";
import { NotFoundError, ForbiddenError } from "../../domain/shared/base.errors";
import { InvalidCredentialsError } from "../utils/errors";
import { withUseCaseLogging } from "../utils/logging";
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
 * Password Hashing Service Interface
 *
 * Abstraction for password hashing (implementation in infrastructure)
 */
export interface PasswordHasher {
  readonly hash: (password: string) => Effect.Effect<string, Error>;
  readonly verify: (
    password: string,
    hash: string
  ) => Effect.Effect<boolean, Error>;
}

export const PasswordHasherTag = Context.GenericTag<PasswordHasher>(
  "@app/PasswordHasher"
);

/**
 * JWT Token Service Interface
 *
 * Abstraction for JWT operations (implementation in infrastructure)
 */
export interface JWTService {
  readonly sign: (payload: {
    userId: string;
    email: string;
    role: string;
  }) => Effect.Effect<{ token: string; expiresIn: number }, Error>;
  readonly verify: (
    token: string
  ) => Effect.Effect<{ userId: string; email: string; role: string }, Error>;
}

export const JWTServiceTag = Context.GenericTag<JWTService>("@app/JWTService");

/**
 * Live implementation of UserWorkflow
 */
export const UserWorkflowLive = Layer.effect(
  UserWorkflowTag,
  Effect.gen(function* () {
    const userRepo = yield* UserRepositoryTag;
    const passwordHasher = yield* PasswordHasherTag;
    const jwtService = yield* JWTServiceTag;

    const registerUser: UserWorkflow["registerUser"] = (command) =>
      withUseCaseLogging(
        "RegisterUser",
        Effect.gen(function* () {
          // Check if user already exists
          const existingUser = yield* userRepo.findByEmail(command.email);
          if (Option.isSome(existingUser)) {
            return yield* Effect.fail(
              new UserAlreadyExistsError({
                email: command.email,
                message: `User with email ${command.email} already exists`,
              })
            );
          }

          // Hash password
          const hashedPassword = yield* passwordHasher.hash(command.password);

          // Create user
          const user = yield* userRepo.create({
            email: command.email,
            password: hashedPassword,
            role: command.role,
          });

          const { password: _, ...userResponse } = user;
          return {
            user: userResponse,
          };
        }),
        { email: command.email }
      );

    const loginUser: UserWorkflow["loginUser"] = (command) =>
      withUseCaseLogging(
        "LoginUser",
        Effect.gen(function* () {
          // Find user by email
          const userOpt = yield* userRepo.findByEmail(command.email);
          if (Option.isNone(userOpt)) {
            return yield* Effect.fail(
              new InvalidCredentialsError({
                message: "Invalid email or password",
              })
            );
          }

          const user = userOpt.value;

          // Verify password
          const isValidPassword = yield* passwordHasher.verify(
            command.password,
            user.password
          );

          if (!isValidPassword) {
            return yield* Effect.fail(
              new InvalidCredentialsError({
                message: "Invalid email or password",
              })
            );
          }

          // Generate JWT token
          const { token, expiresIn } = yield* jwtService.sign({
            userId: user.id,
            email: user.email,
            role: user.role,
          });

          const { password: _, ...userResponse } = user;
          return {
            user: userResponse,
            token,
            expiresIn,
          };
        }),
        { email: command.email }
      );

    const getUserProfile: UserWorkflow["getUserProfile"] = (query) =>
      withUseCaseLogging(
        "GetUserProfile",
        Effect.gen(function* () {
          const userOpt = yield* userRepo.findById(query.userId);
          if (Option.isNone(userOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "User",
                id: query.userId,
                message: `User with ID ${query.userId} not found`,
              })
            );
          }

          const { password: _, ...userResponse } = userOpt.value;
          return userResponse;
        }),
        { userId: query.userId }
      );

    const updateUserProfile: UserWorkflow["updateUserProfile"] = (
      userId,
      command
    ) =>
      withUseCaseLogging(
        "UpdateUserProfile",
        Effect.gen(function* () {
          // Check if user exists
          const userOpt = yield* userRepo.findById(userId);
          if (Option.isNone(userOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "User",
                id: userId,
                message: `User with ID ${userId} not found`,
              })
            );
          }

          // Prepare update payload
          const updatePayload: any = {};

          if (command.email) {
            // Check if new email already exists
            const existingUser = yield* userRepo.findByEmail(command.email);
            if (
              Option.isSome(existingUser) &&
              existingUser.value.id !== userId
            ) {
              return yield* Effect.fail(
                new UserAlreadyExistsError({
                  email: command.email,
                  message: `User with email ${command.email} already exists`,
                })
              );
            }
            updatePayload.email = command.email;
          }

          if (command.password) {
            updatePayload.password = yield* passwordHasher.hash(
              command.password
            );
          }

          // Update user
          const updatedUser = yield* userRepo.update(userId, updatePayload);

          const { password: _, ...userResponse } = updatedUser;
          return userResponse;
        }),
        { userId }
      );

    const listUsers: UserWorkflow["listUsers"] = (query) =>
      withUseCaseLogging(
        "ListUsers",
        Effect.gen(function* () {
          const users = yield* userRepo.listAll();

          // Simple pagination (in-memory)
          const page = query.page ?? 1;
          const limit = query.limit ?? 10;
          const startIndex = (page - 1) * limit;
          const endIndex = startIndex + limit;

          const paginatedUsers = users.slice(startIndex, endIndex);
          const totalPages = Math.ceil(users.length / limit);

          return {
            users: paginatedUsers.map(({ password: _, ...user }) => user),
            total: users.length,
            page,
            limit,
            totalPages,
          };
        })
      );

    const deleteUser: UserWorkflow["deleteUser"] = (
      command,
      requestingUserId
    ) =>
      withUseCaseLogging(
        "DeleteUser",
        Effect.gen(function* () {
          // Check if user exists
          const userOpt = yield* userRepo.findById(command.userId);
          if (Option.isNone(userOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "User",
                id: command.userId,
                message: `User with ID ${command.userId} not found`,
              })
            );
          }

          const user = userOpt.value;

          // Check authorization: only admin or self can delete
          const requestingUserOpt = yield* userRepo.findById(requestingUserId);
          if (Option.isNone(requestingUserOpt)) {
            return yield* Effect.fail(
              new ForbiddenError({
                message: "Unauthorized to delete user",
                resource: `User:${command.userId}`,
              })
            );
          }

          const requestingUser = requestingUserOpt.value;
          const isAdmin = requestingUser.role === "ADMIN";
          const isSelf = requestingUserId === command.userId;

          if (!isAdmin && !isSelf) {
            return yield* Effect.fail(
              new ForbiddenError({
                message: "Only admins or the user themselves can delete a user",
                resource: `User:${command.userId}`,
              })
            );
          }

          // Delete user
          yield* userRepo.delete(command.userId);
        }),
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
