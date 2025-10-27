import { Effect } from "effect";
import { DocumentPermission } from "./entity";
import { PermissionType, hasPermissionLevel } from "./value-object";
import { UserId, DocumentId } from "../refined/uuid";

/**
 * Permission Domain Business Rules and Guards
 */

/**
 * Check if a user has a specific permission on a document
 */
export const hasPermission = (
  permissions: readonly DocumentPermission[],
  userId: UserId,
  documentId: DocumentId,
  required: PermissionType
): boolean => {
  return permissions.some(
    (p) =>
      p.userId === userId &&
      p.documentId === documentId &&
      hasPermissionLevel(p.permission, required)
  );
};

/**
 * Find user's permission for a document
 */
export const findUserPermission = (
  permissions: readonly DocumentPermission[],
  userId: UserId,
  documentId: DocumentId
): DocumentPermission | undefined => {
  return permissions.find(
    (p) => p.userId === userId && p.documentId === documentId
  );
};

/**
 * Get highest permission level for a user on a document
 */
export const getHighestPermission = (
  permissions: readonly DocumentPermission[],
  userId: UserId,
  documentId: DocumentId
): PermissionType | undefined => {
  const userPermissions = permissions.filter(
    (p) => p.userId === userId && p.documentId === documentId
  );

  if (userPermissions.length === 0) return undefined;

  return userPermissions.reduce((highest, current) => {
    return hasPermissionLevel(current.permission, highest)
      ? current.permission
      : highest;
  }, "READ" as PermissionType);
};

/**
 * Guard: User must have required permission
 */
export const guardUserPermission = (
  permissions: readonly DocumentPermission[],
  userId: UserId,
  documentId: DocumentId,
  required: PermissionType
): Effect.Effect<void, Error> =>
  hasPermission(permissions, userId, documentId, required)
    ? Effect.void
    : Effect.fail(
        new Error(`User does not have ${required} permission on this document`)
      );

/**
 * Check if user is the permission grantor
 */
export const isPermissionGrantor = (
  permission: DocumentPermission,
  userId: UserId
): boolean => permission.grantedBy === userId;

/**
 * Guard: Only permission grantor or admin can revoke
 */
export const guardCanRevokePermission = (
  permission: DocumentPermission,
  userId: UserId,
  userRole?: string
): Effect.Effect<void, Error> =>
  isPermissionGrantor(permission, userId) || userRole === "ADMIN"
    ? Effect.void
    : Effect.fail(
        new Error("Only the permission grantor or admin can revoke permissions")
      );
