import { Option } from "effect";
import {
  DocumentPermissionEntity,
  PermissionId,
} from "../../domain/permission/entity";
import { DocumentId, UserId } from "../../domain/refined/uuid";
import { PermissionType } from "../../domain/permission/value-object";

/**
 * Database row type for Permission (from Drizzle)
 */
export interface PermissionRow {
  id: string;
  documentId: string;
  userId: string;
  permission: string;
  grantedBy: string;
  grantedAt: Date | string;
}

/**
 * Permission Mapper - Infrastructure ↔ Domain
 */
export const PermissionMapper = {
  /**
   * Database → Domain
   */
  toDomain: (row: PermissionRow): DocumentPermissionEntity =>
    new DocumentPermissionEntity(
      row.id as PermissionId,
      row.documentId as DocumentId,
      row.userId as UserId,
      row.permission as PermissionType,
      row.grantedBy as UserId,
      typeof row.grantedAt === "string"
        ? new Date(row.grantedAt)
        : row.grantedAt
    ),

  /**
   * Domain → Database Create Input
   */
  toDbCreate: (permission: DocumentPermissionEntity) => ({
    id: permission.id,
    documentId: permission.documentId,
    userId: permission.userId,
    permission: permission.permission,
    grantedBy: permission.grantedBy,
    grantedAt: permission.grantedAt.toISOString(),
  }),

  /**
   * Domain → Database Update Input
   */
  toDbUpdate: (permission: DocumentPermissionEntity) => ({
    permission: permission.permission,
  }),

  /**
   * Convert array of rows to domain entities
   */
  toDomainMany: (rows: PermissionRow[]): DocumentPermissionEntity[] =>
    rows.map(PermissionMapper.toDomain),
};
