/**
 * Permission Application → Domain Mappers
 *
 * Maps Application DTOs to Domain entities for permission operations.
 */

import type {
  GrantPermissionCommand,
  UpdatePermissionCommand,
} from "../dtos/permission/request.dto";
import type {
  PermissionResponse,
  GrantPermissionResponse,
  ListPermissionsResponse,
  CheckPermissionResponse,
} from "../dtos/permission/response.dto";
import type { DocumentPermissionEntity as DocumentPermission } from "../../domain/permission/entity";
import type { DocumentId, UserId } from "../../domain/refined/uuid";
import type { PermissionType } from "../../domain/permission/value-object";

/**
 * Command to Domain Mappers
 */
export const PermissionCommandMapper = {
  /**
   * Map GrantPermissionCommand to Permission.create parameters
   */
  toCreateParams: (
    command: GrantPermissionCommand
  ): {
    documentId: DocumentId;
    userId: UserId;
    permission: PermissionType;
    grantedBy: UserId;
  } => ({
    documentId: command.documentId,
    userId: command.userId,
    permission: command.permission,
    grantedBy: command.grantedBy,
  }),

  /**
   * Map UpdatePermissionCommand to Permission.update parameters
   */
  toUpdateParams: (
    command: UpdatePermissionCommand
  ): {
    permission: PermissionType;
  } => ({
    permission: command.permission,
  }),
} as const;

/**
 * Domain to Response Mappers
 */
export const PermissionResponseMapper = {
  /**
   * Map DocumentPermission entity to PermissionResponse DTO
   */
  toPermissionResponse: (
    permission: DocumentPermission
  ): PermissionResponse => ({
    id: permission.id,
    documentId: permission.documentId,
    userId: permission.userId,
    permission: permission.permission,
    grantedBy: permission.grantedBy,
    grantedAt: permission.grantedAt as any, // Branded Date type
  }),

  /**
   * Map DocumentPermission entity to GrantPermissionResponse DTO
   */
  toGrantPermissionResponse: (
    permission: DocumentPermission,
    isNew: boolean = true
  ): GrantPermissionResponse => ({
    permission: PermissionResponseMapper.toPermissionResponse(permission),
    message: isNew
      ? "Permission granted successfully"
      : "Permission updated successfully",
  }),

  /**
   * Map permissions list to ListPermissionsResponse DTO
   */
  toListPermissionsResponse: (
    permissions: readonly DocumentPermission[]
  ): ListPermissionsResponse => ({
    permissions: permissions.map(PermissionResponseMapper.toPermissionResponse),
    total: permissions.length,
  }),

  /**
   * Map permission check result to CheckPermissionResponse DTO
   */
  toCheckPermissionResponse: (
    hasPermission: boolean,
    permissionType?: PermissionType
  ): CheckPermissionResponse => ({
    hasPermission,
    permission: permissionType,
  }),
} as const;
