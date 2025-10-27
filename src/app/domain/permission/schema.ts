import { Schema as S } from "effect";
import {
  DocumentPermission,
  CreatePermissionPayload,
  UpdatePermissionPayload,
} from "./entity";

/**
 * Runtime validators for Permission domain
 */

export const validatePermission = (input: unknown) =>
  S.decodeUnknown(DocumentPermission)(input);

export const validateCreatePermissionPayload = (input: unknown) =>
  S.decodeUnknown(CreatePermissionPayload)(input);

export const validateUpdatePermissionPayload = (input: unknown) =>
  S.decodeUnknown(UpdatePermissionPayload)(input);
