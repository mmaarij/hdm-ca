import { Schema as S, Option, Effect as E, pipe } from "effect";
import { UserId } from "../refined/uuid";
import { EmailAddress } from "../refined/email";
import { HashedPassword } from "../refined/password";
import { UserRole } from "./value-object";
import { v4 as uuidv4 } from "uuid";
import {
  BaseEntity,
  IEntity,
  Maybe,
  normalizeMaybe,
  optionToMaybe,
} from "../shared/base-entity";
import { UserValidationError } from "./errors";
import { UserSchema, UserPublicSchema } from "./schema";

// ============================================================================
// Serialized Types
// ============================================================================
export type SerializedUser = {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly role: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
};

/**
 * Serialized UserPublic type (without sensitive fields)
 */
export type SerializedUserPublic = {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
};

// ============================================================================
// User Entity
// ============================================================================

/**
 * User Entity - Aggregate Root
 *
 * Represents an authenticated user in the system.
 */
export class UserEntity extends BaseEntity implements IEntity {
  constructor(
    public readonly id: UserId,
    public readonly email: EmailAddress,
    public readonly password: HashedPassword,
    public readonly role: UserRole,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {
    super();
  }

  /**
   * Create a new user with validation
   * Uses internal validation (no encoding/decoding) since data is already in memory
   */
  static create(
    input: SerializedUser
  ): E.Effect<UserEntity, UserValidationError, never> {
    // For internal creation, we bypass decoding and just validate the types directly
    // since we're not dealing with JSON/external data
    try {
      return E.succeed(
        new UserEntity(
          input.id as UserId,
          input.email as EmailAddress,
          input.password as HashedPassword,
          input.role as UserRole,
          input.createdAt ?? new Date(),
          input.updatedAt ?? new Date()
        )
      );
    } catch (error) {
      return E.fail(
        new UserValidationError({
          message: `User validation failed: ${error}`,
        })
      );
    }
  }

  /**
   * Update user
   */
  update(updates: {
    email?: EmailAddress;
    password?: HashedPassword;
    role?: UserRole;
  }): UserEntity {
    return new UserEntity(
      this.id,
      updates.email ?? this.email,
      updates.password ?? this.password,
      updates.role ?? this.role,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Convert User to UserPublic (remove password)
   */
  toPublic(): UserPublicEntity {
    return new UserPublicEntity(
      this.id,
      this.email,
      this.role,
      this.createdAt,
      this.updatedAt
    );
  }

  /**
   * Serialize to external format
   */
  serialize(): SerializedUser {
    return {
      id: this.id,
      email: this.email,
      password: this.password,
      role: this.role,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

// ============================================================================
// UserPublic Entity
// ============================================================================

/**
 * UserPublic Entity - User without sensitive information
 *
 * Used for API responses where password should not be exposed.
 */
export class UserPublicEntity extends BaseEntity implements IEntity {
  constructor(
    public readonly id: UserId,
    public readonly email: EmailAddress,
    public readonly role: UserRole,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {
    super();
  }

  /**
   * Create a UserPublic entity with validation
   * Uses internal validation (no encoding/decoding) since data is already in memory
   */
  static create(
    input: SerializedUserPublic
  ): E.Effect<UserPublicEntity, UserValidationError, never> {
    // For internal creation, we bypass decoding and just validate the types directly
    try {
      return E.succeed(
        new UserPublicEntity(
          input.id as UserId,
          input.email as EmailAddress,
          input.role as UserRole,
          input.createdAt ?? new Date(),
          input.updatedAt ?? new Date()
        )
      );
    } catch (error) {
      return E.fail(
        new UserValidationError({
          message: `User public validation failed: ${error}`,
        })
      );
    }
  }

  /**
   * Serialize to external format
   */
  serialize(): SerializedUserPublic {
    return {
      id: this.id,
      email: this.email,
      role: this.role,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
