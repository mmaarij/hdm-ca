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
   */
  static create(
    input: SerializedDocumentPermission
  ): E.Effect<DocumentPermissionEntity, PermissionValidationError, never> {
    return pipe(
      S.decodeUnknown(DocumentPermissionSchema)(input),
      E.flatMap((data) => {
        return E.succeed(
          new DocumentPermissionEntity(
            data.id,
            data.documentId,
            data.userId,
            data.permission,
            data.grantedBy,
            data.grantedAt ?? new Date()
          )
        );
      }),
      E.mapError(
        (error) =>
          new PermissionValidationError({
            message: `Permission validation failed: ${error}`,
          })
      )
    );
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

// ============================================================================
// Legacy Type Aliases and Factory Functions (for backward compatibility)
// ============================================================================

/**
 * Legacy DocumentPermission type alias
 * @deprecated Use DocumentPermissionEntity instead
 */
export type DocumentPermission = DocumentPermissionEntity;

/**
 * Legacy DocumentPermission factory functions
 * @deprecated Use DocumentPermissionEntity methods instead
 */
export const DocumentPermission = {
  /**
   * Create a new permission
   */
  create: (props: {
    documentId: DocumentId;
    userId: UserId;
    permission: PermissionType;
    grantedBy: UserId;
  }): DocumentPermissionEntity => {
    return new DocumentPermissionEntity(
      uuidv4() as PermissionId,
      props.documentId,
      props.userId,
      props.permission,
      props.grantedBy,
      new Date()
    );
  },

  /**
   * Update permission level
   */
  updatePermission: (
    permission: DocumentPermissionEntity,
    newPermissionType: PermissionType
  ): DocumentPermissionEntity => permission.updatePermission(newPermissionType),
};
