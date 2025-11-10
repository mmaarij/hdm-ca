import { Schema as S, Option, Effect as E, pipe } from "effect";
import { DocumentId, UserId } from "../refined/uuid";
import { PermissionType } from "./value-object";
import { v4 as uuidv4 } from "uuid";
import {
  BaseEntity,
  IEntity,
  Maybe,
  normalizeMaybe,
  optionToMaybe,
} from "../shared/base-entity";
import { PermissionValidationError } from "./errors";
import { PermissionId, DocumentPermissionSchema } from "./schema";

// Re-export PermissionId for convenience (both type and value)
export { PermissionId };

// ============================================================================
// Serialized Types
// ============================================================================
export type SerializedDocumentPermission = {
  readonly id: string;
  readonly documentId: string;
  readonly userId: string;
  readonly permission: string;
  readonly grantedBy: string;
  readonly grantedAt?: Date;
};

// ============================================================================
// DocumentPermission Entity
// ============================================================================

/**
 * Document Permission Entity - Aggregate Root
 *
 * Represents an access control rule for a document.
 */
export class DocumentPermissionEntity extends BaseEntity implements IEntity {
  constructor(
    public readonly id: PermissionId,
    public readonly documentId: DocumentId,
    public readonly userId: UserId,
    public readonly permission: PermissionType,
    public readonly grantedBy: UserId,
    public readonly grantedAt: Date
  ) {
    super();
  }

  /**
   * Create a new permission with validation
   * Uses internal validation (no encoding/decoding) since data is already in memory
   */
  static create(
    input: SerializedDocumentPermission
  ): E.Effect<DocumentPermissionEntity, PermissionValidationError, never> {
    try {
      return E.succeed(
        new DocumentPermissionEntity(
          input.id as PermissionId,
          input.documentId as DocumentId,
          input.userId as UserId,
          input.permission as PermissionType,
          input.grantedBy as UserId,
          input.grantedAt ?? new Date()
        )
      );
    } catch (error) {
      return E.fail(
        new PermissionValidationError({
          message: `Permission validation failed: ${error}`,
        })
      );
    }
  }

  /**
   * Update permission level
   */
  updatePermission(
    newPermissionType: PermissionType
  ): DocumentPermissionEntity {
    return new DocumentPermissionEntity(
      this.id,
      this.documentId,
      this.userId,
      newPermissionType,
      this.grantedBy,
      this.grantedAt
    );
  }

  /**
   * Serialize to external format
   */
  serialize(): SerializedDocumentPermission {
    return {
      id: this.id,
      documentId: this.documentId,
      userId: this.userId,
      permission: this.permission,
      grantedBy: this.grantedBy,
      grantedAt: this.grantedAt,
    };
  }
}
