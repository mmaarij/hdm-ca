/**
 * TypeScript Enums for Elysia schema validation
 *
 * These enums mirror the domain value objects but are used for
 * HTTP layer validation and OpenAPI documentation
 */

/**
 * User Role Enumeration
 */
export enum UserRoleType {
  ADMIN = "ADMIN",
  USER = "USER",
}

/**
 * Document Permission Type Enumeration
 */
export enum DocumentPermissionType {
  READ = "READ",
  WRITE = "WRITE",
  DELETE = "DELETE",
}

/**
 * Helper to validate user role
 */
export const isValidUserRole = (role: string): role is UserRoleType => {
  return Object.values(UserRoleType).includes(role as UserRoleType);
};

/**
 * Helper to validate permission type
 */
export const isValidPermissionType = (
  permission: string
): permission is DocumentPermissionType => {
  return Object.values(DocumentPermissionType).includes(
    permission as DocumentPermissionType
  );
};
