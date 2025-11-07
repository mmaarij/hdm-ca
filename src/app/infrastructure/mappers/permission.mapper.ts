import { Option } from "effect";
import {
  DocumentPermission,
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
  toDomain: (row: PermissionRow): DocumentPermission => ({
    id: row.id as PermissionId,
    documentId: row.documentId as DocumentId,
    userId: row.userId as UserId,
    permission: row.permission as PermissionType,
    grantedBy: row.grantedBy as UserId,
    grantedAt:
      typeof row.grantedAt === "string"
        ? new Date(row.grantedAt)
        : row.grantedAt,
  }),

  /**
   * Domain → Database Create Input
   */
  toDbCreate: (permission: DocumentPermission) => ({
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
  toDbUpdate: (permission: DocumentPermission) => ({
    permission: permission.permission,
  }),

  /**
   * Convert array of rows to domain entities
   */
  toDomainMany: (rows: PermissionRow[]): DocumentPermission[] =>
    rows.map(PermissionMapper.toDomain),
};
