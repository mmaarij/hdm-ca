import { Schema as S } from "effect";
import { DateTime } from "../refined/date-time";
import { Uuid } from "../refined/uuid";

/**
 * Base entity interface with common fields
 *
 * All domain entities should extend this interface
 */
export interface BaseEntity {
  readonly id: Uuid;
  readonly createdAt?: DateTime;
  readonly updatedAt?: DateTime;
}

/**
 * Base entity schema (for composition)
 */
export const BaseEntityFields = {
  id: Uuid,
  createdAt: S.optional(DateTime),
  updatedAt: S.optional(DateTime),
};

/**
 * Immutable entity (no updatedAt)
 */
export interface ImmutableEntity {
  readonly id: Uuid;
  readonly createdAt?: DateTime;
}

/**
 * Immutable entity schema
 */
export const ImmutableEntityFields = {
  id: Uuid,
  createdAt: S.optional(DateTime),
};

/**
 * Timestamped interface (createdAt/updatedAt only)
 */
export interface Timestamped {
  readonly createdAt?: DateTime;
  readonly updatedAt?: DateTime;
}

/**
 * Timestamped schema
 */
export const TimestampedFields = {
  createdAt: S.optional(DateTime),
  updatedAt: S.optional(DateTime),
};
