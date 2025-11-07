import { Effect, Option, Context } from "effect";
import { User } from "./entity";
import { UserDomainError } from "./errors";
import { UserId } from "../refined/uuid";
import { EmailAddress } from "../refined/email";

/**
 * User Repository Interface
 *
 * Defines the contract for user data persistence operations.
 * Implementations should be provided in the infrastructure layer.
 *
 * Repositories work with entities, not payloads.
 */
export interface UserRepository {
  /**
   * Save a user (create or update)
   */
  readonly save: (user: User) => Effect.Effect<User, UserDomainError>;

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
export const UserRepositoryTag = Context.GenericTag<UserRepository>(
  "@app/UserRepository"
);
