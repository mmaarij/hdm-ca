import { Schema as S } from "effect";

/**
 * Permission Type Enumeration
 */
export const PermissionType = S.Literal("READ", "WRITE", "DELETE");
export type PermissionType = S.Schema.Type<typeof PermissionType>;

/**
 * Permission level hierarchy
 */
export const PERMISSION_HIERARCHY: Record<PermissionType, number> = {
  READ: 1,
  WRITE: 2,
  DELETE: 3,
};

/**
 * Check if a permission type grants access to another
 * @param granted The permission the user has
 * @param required The permission required for the operation
 * @returns true if granted permission level >= required permission level
 */
export const hasPermissionLevel = (
  granted: PermissionType,
  required: PermissionType
): boolean => PERMISSION_HIERARCHY[granted] >= PERMISSION_HIERARCHY[required];

/**
 * Get all permissions implied by a given permission
 * e.g., WRITE grants both WRITE and READ
 */
export const getImpliedPermissions = (
  permission: PermissionType
): PermissionType[] => {
  const level = PERMISSION_HIERARCHY[permission];
  return (Object.keys(PERMISSION_HIERARCHY) as PermissionType[]).filter(
    (p) => PERMISSION_HIERARCHY[p] <= level
  );
};
