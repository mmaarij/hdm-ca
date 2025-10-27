import { Effect, Option, Context } from "effect";
import { BaseDomainError } from "./base.errors";

/**
 * Base Repository Interface
 *
 * Generic repository interface that all repositories can extend.
 */
export interface BaseRepository<
  Entity,
  Id,
  CreatePayload,
  UpdatePayload,
  DomainError extends BaseDomainError
> {
  /**
   * Create a new entity
   */
  readonly create: (
    payload: CreatePayload
  ) => Effect.Effect<Entity, DomainError>;

  /**
   * Find entity by ID
   */
  readonly findById: (
    id: Id
  ) => Effect.Effect<Option.Option<Entity>, DomainError>;

  /**
   * Update entity
   */
  readonly update: (
    id: Id,
    payload: UpdatePayload
  ) => Effect.Effect<Entity, DomainError>;

  /**
   * Delete entity
   */
  readonly delete: (id: Id) => Effect.Effect<void, DomainError>;

  /**
   * List all entities
   */
  readonly listAll: () => Effect.Effect<readonly Entity[], DomainError>;
}

/**
 * Helper to detect database constraint violations
 */
export type ConstraintType = "unique" | "foreign" | "check" | "unknown";

export const detectDbConstraint = (error: unknown): ConstraintType => {
  const message = String(error).toLowerCase();

  if (message.includes("unique") || message.includes("duplicate")) {
    return "unique";
  }
  if (message.includes("foreign key") || message.includes("fk_")) {
    return "foreign";
  }
  if (message.includes("check constraint")) {
    return "check";
  }
  return "unknown";
};
