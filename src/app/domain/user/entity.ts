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
   */
  static create(
    input: SerializedUser
  ): E.Effect<UserEntity, UserValidationError, never> {
    return pipe(
      S.decodeUnknown(UserSchema)(input),
      E.flatMap((data) => {
        return E.succeed(
          new UserEntity(
            data.id,
            data.email,
            data.password,
            data.role,
            data.createdAt ?? new Date(),
            data.updatedAt ?? new Date()
          )
        );
      }),
      E.mapError(
        (error) =>
          new UserValidationError({
            message: `User validation failed: ${error}`,
          })
      )
    );
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
   */
  static create(
    input: SerializedUserPublic
  ): E.Effect<UserPublicEntity, UserValidationError, never> {
    return pipe(
      S.decodeUnknown(UserPublicSchema)(input),
      E.flatMap((data) => {
        return E.succeed(
          new UserPublicEntity(
            data.id,
            data.email,
            data.role,
            data.createdAt ?? new Date(),
            data.updatedAt ?? new Date()
          )
        );
      }),
      E.mapError(
        (error) =>
          new UserValidationError({
            message: `User public validation failed: ${error}`,
          })
      )
    );
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
