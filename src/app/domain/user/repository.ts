import { Effect, Option } from "effect";
import { User, CreateUserPayload, UpdateUserPayload } from "./entity";
import { UserDomainError } from "./errors";
import { UserId } from "../refined/uuid";
import { EmailAddress } from "../refined/email";

/**
 * User Repository Interface
 *
 * Defines the contract for user data persistence operations.
 * Implementations should be provided in the infrastructure layer.
 */
export interface UserRepository {
  /**
   * Create a new user
   */
  readonly create: (
    payload: CreateUserPayload
  ) => Effect.Effect<User, UserDomainError>;

  /**
   * Find user by ID
   */
  readonly findById: (
    id: UserId
  ) => Effect.Effect<Option.Option<User>, UserDomainError>;

  /**
   * Find user by email
   */
  readonly findByEmail: (
    email: EmailAddress
  ) => Effect.Effect<Option.Option<User>, UserDomainError>;

  /**
   * Update user
   */
  readonly update: (
    id: UserId,
    payload: UpdateUserPayload
  ) => Effect.Effect<User, UserDomainError>;

  /**
   * Delete user
   */
  readonly delete: (id: UserId) => Effect.Effect<void, UserDomainError>;

  /**
   * List all users (for admin)
   */
  readonly listAll: () => Effect.Effect<readonly User[], UserDomainError>;

  /**
   * Check if user exists by email
   */
  readonly existsByEmail: (
    email: EmailAddress
  ) => Effect.Effect<boolean, UserDomainError>;
}

/**
 * Context tag for dependency injection
 */
import { Context } from "effect";
export const UserRepositoryTag = Context.GenericTag<UserRepository>(
  "@app/UserRepository"
);
