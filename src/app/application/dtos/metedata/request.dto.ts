/**
 * Metadata Request DTOs
 */

import { Schema as S } from "effect";
import { DocumentId, UserId } from "../../../domain/refined/uuid";
import { MetadataId } from "../../../domain/metedata/entity";
import {
  MetadataKey,
  MetadataValue,
} from "../../../domain/metedata/value-object";

/**
 * Add Metadata Command
 */
export const AddMetadataCommand = S.Struct({
  documentId: DocumentId,
  key: MetadataKey,
  value: MetadataValue,
  userId: UserId, // For permission checking
});

export type AddMetadataCommand = S.Schema.Type<typeof AddMetadataCommand>;

/**
 * Update Metadata Command
 */
export const UpdateMetadataCommand = S.Struct({
  metadataId: MetadataId,
  value: MetadataValue,
  userId: UserId, // For permission checking
});

export type UpdateMetadataCommand = S.Schema.Type<typeof UpdateMetadataCommand>;

/**
 * Delete Metadata Command
 */
export const DeleteMetadataCommand = S.Struct({
  metadataId: MetadataId,
  userId: UserId, // For permission checking
});

export type DeleteMetadataCommand = S.Schema.Type<typeof DeleteMetadataCommand>;

/**
 * List Metadata Query
 */
export const ListMetadataQuery = S.Struct({
  documentId: DocumentId,
  userId: UserId, // For permission checking
});

export type ListMetadataQuery = S.Schema.Type<typeof ListMetadataQuery>;

/**
 * Get Metadata by Key Query
 */
export const GetMetadataByKeyQuery = S.Struct({
  documentId: DocumentId,
  key: MetadataKey,
  userId: UserId, // For permission checking
});

export type GetMetadataByKeyQuery = S.Schema.Type<typeof GetMetadataByKeyQuery>;
