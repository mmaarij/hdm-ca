import { Effect } from "effect";
import { DocumentPermission } from "./entity";
import { User } from "../user/entity";
import { Document } from "../document/entity";
import { PermissionType, hasPermissionLevel } from "./value-object";
import {
  InsufficientPermissionError,
  DocumentAccessDeniedError,
} from "./errors";

/**
 * DocumentAccessService - Domain Service
 *
 * Pure domain service for evaluating document access permissions.
 * This service implements the access control business rules without any I/O.
 *
 * Access Control Rules (in order of precedence):
 * 1. Admin users have full access to all documents
 * 2. Document owners have full access to their documents
 * 3. Users with explicit permissions have access based on their permission level
 * 4. Default: Deny access
 */

/**
 * Check if user is the document owner
 */
export const isDocumentOwner = (document: Document, user: User): boolean =>
  document.uploadedBy === user.id;

/**
 * Check if user is an admin
 */
export const isAdmin = (user: User): boolean => user.role === "ADMIN";

/**
 * Check if user has a specific permission on the document
 * Considers permission hierarchy (e.g., WRITE implies READ)
 */
export const hasExplicitPermission = (
  permissions: readonly DocumentPermission[],
  userId: string,
  requiredPermission: PermissionType
): boolean => {
  const userPermissions = permissions.filter((p) => p.userId === userId);

  return userPermissions.some((p) =>
    hasPermissionLevel(p.permission, requiredPermission)
  );
};

/**
 * Evaluate if a user can perform a specific action on a document
 * (Internal helper - returns boolean for composition)
 *
 * @param user - The user requesting access
 * @param document - The document being accessed
 * @param permissions - All permissions for the document
 * @param requiredPermission - The permission level required for the action
 * @returns true if access is granted, false otherwise
 *
 * Access precedence:
 * 1. Admin → Grant access
 * 2. Owner → Grant access
 * 3. Explicit permission → Check permission level
 * 4. Default → Deny access
 */
const evaluateAccess = (
  user: User,
  document: Document,
  permissions: readonly DocumentPermission[],
  requiredPermission: PermissionType
): boolean => {
  // Rule 1: Admins have full access
  if (isAdmin(user)) {
    return true;
  }

  // Rule 2: Document owners have full access
  if (isDocumentOwner(document, user)) {
    return true;
  }

  // Rule 3: Check explicit permissions with hierarchy
  if (hasExplicitPermission(permissions, user.id, requiredPermission)) {
    return true;
  }

  // Rule 4: Default deny
  return false;
};

/**
 * Guard: Require READ permission
 * Fails with domain error if user doesn't have permission
 */
export const requireReadPermission = (
  user: User,
  document: Document,
  permissions: readonly DocumentPermission[]
): Effect.Effect<void, InsufficientPermissionError> => {
  const hasAccess = evaluateAccess(user, document, permissions, "READ");

  return hasAccess
    ? Effect.void
    : Effect.fail(
        new InsufficientPermissionError({
          message: `User does not have READ permission on document`,
          userId: user.id,
          documentId: document.id,
          requiredPermission: "READ",
        })
      );
};

/**
 * Guard: Require WRITE permission
 * Fails with domain error if user doesn't have permission
 */
export const requireWritePermission = (
  user: User,
  document: Document,
  permissions: readonly DocumentPermission[]
): Effect.Effect<void, InsufficientPermissionError> => {
  const hasAccess = evaluateAccess(user, document, permissions, "WRITE");

  return hasAccess
    ? Effect.void
    : Effect.fail(
        new InsufficientPermissionError({
          message: `User does not have WRITE permission on document`,
          userId: user.id,
          documentId: document.id,
          requiredPermission: "WRITE",
        })
      );
};

/**
 * Guard: Require DELETE permission
 * Fails with domain error if user doesn't have permission
 */
export const requireDeletePermission = (
  user: User,
  document: Document,
  permissions: readonly DocumentPermission[]
): Effect.Effect<void, InsufficientPermissionError> => {
  const hasAccess = evaluateAccess(user, document, permissions, "DELETE");

  return hasAccess
    ? Effect.void
    : Effect.fail(
        new InsufficientPermissionError({
          message: `User does not have DELETE permission on document`,
          userId: user.id,
          documentId: document.id,
          requiredPermission: "DELETE",
        })
      );
};

/**
 * Generic guard: Require specific permission level
 */
export const requirePermission = (
  user: User,
  document: Document,
  permissions: readonly DocumentPermission[],
  requiredPermission: PermissionType
): Effect.Effect<void, InsufficientPermissionError> => {
  const hasAccess = evaluateAccess(
    user,
    document,
    permissions,
    requiredPermission
  );

  return hasAccess
    ? Effect.void
    : Effect.fail(
        new InsufficientPermissionError({
          message: `User does not have ${requiredPermission} permission on document`,
          userId: user.id,
          documentId: document.id,
          requiredPermission,
        })
      );
};

/**
 * Guard: Require access for specific action (more descriptive errors)
 */
export const requireDocumentAccess = (
  user: User,
  document: Document,
  permissions: readonly DocumentPermission[],
  action: string,
  requiredPermission: PermissionType
): Effect.Effect<void, DocumentAccessDeniedError> => {
  const hasAccess = evaluateAccess(
    user,
    document,
    permissions,
    requiredPermission
  );

  return hasAccess
    ? Effect.void
    : Effect.fail(
        new DocumentAccessDeniedError({
          message: `User is not allowed to ${action} this document`,
          userId: user.id,
          documentId: document.id,
          action,
        })
      );
};

/**
 * Get highest permission level user has on document
 * Returns the strongest permission the user has (DELETE > WRITE > READ)
 */
export const getHighestPermission = (
  user: User,
  document: Document,
  permissions: readonly DocumentPermission[]
): PermissionType | null => {
  // Admin and owner have full access
  if (isAdmin(user) || isDocumentOwner(document, user)) {
    return "DELETE";
  }

  const userPermissions = permissions.filter((p) => p.userId === user.id);

  if (userPermissions.length === 0) {
    return null;
  }

  // Find the highest permission level
  if (userPermissions.some((p) => p.permission === "DELETE")) {
    return "DELETE";
  }
  if (userPermissions.some((p) => p.permission === "WRITE")) {
    return "WRITE";
  }
  if (userPermissions.some((p) => p.permission === "READ")) {
    return "READ";
  }

  return null;
};

/**
 * Filter documents by user access
 * Returns only documents the user can access with the required permission
 */
export const filterAccessibleDocuments = <T extends { document: Document }>(
  user: User,
  documentsWithPermissions: readonly {
    document: Document;
    permissions: readonly DocumentPermission[];
  }[],
  requiredPermission: PermissionType
): readonly Document[] => {
  return documentsWithPermissions
    .filter(({ document, permissions }) =>
      evaluateAccess(user, document, permissions, requiredPermission)
    )
    .map(({ document }) => document);
};
