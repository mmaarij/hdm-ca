import { Schema as S, Option } from "effect";

/**
 * Maybe<T> - Utility type for flexible external data
 *
 * Represents data that might arrive in various formats from external systems:
 * - The actual value (T)
 * - null (explicit absence)
 * - undefined (not provided)
 *
 * This type is used for data coming FROM external systems (deserialization).
 * Internally, we use Option<T> for consistency.
 */
export type Maybe<T> = T | null | undefined;

/**
 * SerializedEntity - Base type for serialized entity data
 *
 * This represents the shape of data when entities travel to/from external systems.
 */
export type SerializedEntity = Record<string, unknown>;

/**
 * normalizeMaybe - Convert Maybe<T> to Option<T>
 *
 * Converts flexible external data formats into our internal Option<T> representation.
 * This ensures consistent handling of optional values throughout the domain.
 *
 * @param value - The potentially nullable/undefined value from external source
 * @returns Option.some(value) if value exists, Option.none() otherwise
 *
 * @example
 * normalizeMaybe("hello")     // Option.some("hello")
 * normalizeMaybe(null)        // Option.none()
 * normalizeMaybe(undefined)   // Option.none()
 */
export const normalizeMaybe = <T>(value: Maybe<T>): Option.Option<T> => {
  return value !== null && value !== undefined
    ? Option.some(value)
    : Option.none();
};

/**
 * optionToMaybe - Convert Option<T> to Maybe<T>
 *
 * Converts internal Option<T> representation back to external-friendly format.
 * This is used during serialization for API responses, database storage, etc.
 *
 * @param option - The Option value to convert
 * @returns The unwrapped value or undefined if None
 *
 * @example
 * optionToMaybe(Option.some("hello"))  // "hello"
 * optionToMaybe(Option.none())         // undefined
 */
export const optionToMaybe = <T>(option: Option.Option<T>): Maybe<T> => {
  return Option.isSome(option) ? option.value : undefined;
};

/**
 * IEntity - Base interface for all domain entities
 *
 * Defines the contract that all entities in the domain must follow.
 * Entities represent objects with identity and lifecycle.
 */
export interface IEntity {
  /**
   * Unique identifier for the entity
   */
  readonly id: string;

  /**
   * Serialize the entity to external format
   *
   * Converts the domain entity to a plain object suitable for:
   * - API responses
   * - Database storage
   * - Message passing
   *
   * @returns Plain object representation of the entity
   */
  serialize(): SerializedEntity;
}

/**
 * BaseEntity - Abstract base class for all domain entities
 *
 * Provides common functionality and enforces the entity contract.
 * All concrete entities should extend this class.
 *
 * Benefits:
 * - Consistent entity structure across the domain
 * - Shared behavior and utilities
 * - Type-safe serialization patterns
 * - Enforced identity management
 *
 * @example
 * ```typescript
 * export class User extends BaseEntity implements IEntity {
 *   constructor(
 *     public readonly id: UserId,
 *     public readonly email: EmailAddress,
 *     public readonly role: UserRole
 *   ) {
 *     super();
 *   }
 *
 *   serialize(): SerializedEntity {
 *     return {
 *       id: this.id,
 *       email: this.email,
 *       role: this.role
 *     };
 *   }
 * }
 * ```
 */
export abstract class BaseEntity implements IEntity {
  /**
   * Unique identifier for the entity
   * Must be implemented by concrete entity classes
   */
  abstract readonly id: string;

  /**
   * Serialize the entity to external format
   * Must be implemented by concrete entity classes
   */
  abstract serialize(): SerializedEntity;

  /**
   * Check equality based on entity ID
   *
   * Two entities are considered equal if they have the same ID,
   * regardless of other property values (identity equality).
   *
   * @param other - The entity to compare with
   * @returns true if entities have the same ID
   */
  equals(other: BaseEntity): boolean {
    if (!other) return false;
    return this.id === other.id;
  }

  /**
   * Get a hash code for the entity
   *
   * Uses the entity ID as the hash for consistency with equals().
   * Useful for collections and caching.
   *
   * @returns The entity's ID as its hash
   */
  hashCode(): string {
    return this.id;
  }
}

/**
 * EntitySchema - Base schema configuration for entities
 *
 * Provides common schema patterns for entity validation.
 * Can be extended with entity-specific validation rules.
 */
export const EntitySchema = {
  /**
   * Create a base entity schema with common fields
   */
  base: <T extends S.Struct.Fields>(fields: T) =>
    S.Struct({
      ...fields,
    }),
};

/**
 * Helper to create Option fields in schemas
 *
 * Simplifies creation of optional fields that use Option<T> internally
 * but accept Maybe<T> from external sources.
 *
 * @example
 * const UserSchema = S.Struct({
 *   id: UserId,
 *   email: EmailAddress,
 *   phoneNumber: optionalField(PhoneNumber)
 * });
 */
export const optionalField = <A, I, R>(schema: S.Schema<A, I, R>) =>
  S.optional(schema);

/**
 * Type guard to check if an object is an entity
 */
export const isEntity = (obj: unknown): obj is IEntity => {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "id" in obj &&
    "serialize" in obj &&
    typeof (obj as IEntity).serialize === "function"
  );
};
