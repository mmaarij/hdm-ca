import { Option } from "effect";
import { UserEntity, UserPublicEntity } from "../../domain/user/entity";
import { UserId } from "../../domain/refined/uuid";
import { EmailAddress } from "../../domain/refined/email";
import { HashedPassword } from "../../domain/refined/password";
import { UserRole } from "../../domain/user/value-object";

/**
 * Database row type for User (from Drizzle)
 */
export interface UserRow {
  id: string;
  email: string;
  password: string;
  role: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * User Mapper - Infrastructure ↔ Domain
 *
 * Converts between database representations and domain entities.
 * This is the anti-corruption layer that keeps domain pure.
 */
export const UserMapper = {
  /**
   * Database → Domain
   * Convert Drizzle row to domain entity
   */
  toDomain: (row: UserRow): UserEntity =>
    new UserEntity(
      row.id as UserId,
      row.email as EmailAddress,
      row.password as HashedPassword,
      row.role as UserRole,
      typeof row.createdAt === "string"
        ? new Date(row.createdAt)
        : row.createdAt,
      typeof row.updatedAt === "string"
        ? new Date(row.updatedAt)
        : row.updatedAt
    ),

  /**
   * Domain → Database Create Input
   * Convert domain entity to Drizzle insert input
   */
  toDbCreate: (user: UserEntity) => ({
    id: user.id,
    email: user.email,
    password: user.password,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }),

  /**
   * Domain → Database Update Input
   * Convert domain entity to Drizzle update input
   */
  toDbUpdate: (user: UserEntity) => ({
    email: user.email,
    password: user.password,
    role: user.role,
    updatedAt: new Date().toISOString(),
  }),

  /**
   * Convert to public representation (remove password)
   */
  toPublic: (user: UserEntity): UserPublicEntity => user.toPublic(),

  /**
   * Convert array of rows to domain entities
   */
  toDomainMany: (rows: UserRow[]): UserEntity[] =>
    rows.map(UserMapper.toDomain),
};
