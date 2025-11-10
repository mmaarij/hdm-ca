/**
 * Metadata Request DTOs
 *
 * Each operation has two schemas:
 * - *Input: Raw input from API (strings) - used by presentation layer
 * - *Command/*Query: Branded domain types - used by workflows after transformation
 */

import { Schema as S } from "effect";
import {
  DocumentId,
  StringToDocumentId,
  UserId,
  StringToUserId,
} from "../../../domain/refined/uuid";
import { MetadataId } from "../../../domain/metedata/entity";
import {
  MetadataKey,
  MetadataValue,
} from "../../../domain/metedata/value-object";

// ============================================================================
// Add Metadata
// ============================================================================

/**
 * Raw input from API
 */
export const AddMetadataInput = S.Struct({
  documentId: S.String,
  key: S.String,
  value: S.String,
  userId: S.String,
});
export type AddMetadataInput = S.Schema.Type<typeof AddMetadataInput>;

/**
 * Branded command for workflows
 */
export const AddMetadataCommand = S.Struct({
  documentId: StringToDocumentId,
  key: MetadataKey,
  value: MetadataValue,
  userId: StringToUserId,
});
export type AddMetadataCommand = S.Schema.Type<typeof AddMetadataCommand>;

// ============================================================================
// Update Metadata
// ============================================================================

/**
 * Raw input from API
 */
export const UpdateMetadataInput = S.Struct({
  metadataId: S.String,
  value: S.String,
  userId: S.String,
});
export type UpdateMetadataInput = S.Schema.Type<typeof UpdateMetadataInput>;

/**
 * Branded command for workflows
 */
export const UpdateMetadataCommand = S.Struct({
  metadataId: MetadataId,
  value: MetadataValue,
  userId: StringToUserId,
});
export type UpdateMetadataCommand = S.Schema.Type<typeof UpdateMetadataCommand>;

// ============================================================================
// Delete Metadata
// ============================================================================

/**
 * Raw input from API
 */
export const DeleteMetadataInput = S.Struct({
  metadataId: S.String,
  userId: S.String,
});
export type DeleteMetadataInput = S.Schema.Type<typeof DeleteMetadataInput>;

/**
 * Branded command for workflows
 */
export const DeleteMetadataCommand = S.Struct({
  metadataId: MetadataId,
  userId: StringToUserId,
});
export type DeleteMetadataCommand = S.Schema.Type<typeof DeleteMetadataCommand>;

// ============================================================================
// List Metadata
// ============================================================================

/**
 * Raw input from API
 */
export const ListMetadataInput = S.Struct({
  documentId: S.String,
  userId: S.String,
});
export type ListMetadataInput = S.Schema.Type<typeof ListMetadataInput>;

/**
 * Branded query for workflows
 */
export const ListMetadataQuery = S.Struct({
  documentId: StringToDocumentId,
  userId: StringToUserId,
});
export type ListMetadataQuery = S.Schema.Type<typeof ListMetadataQuery>;

// ============================================================================
// Get Metadata by Key
// ============================================================================

/**
 * Raw input from API
 */
export const GetMetadataByKeyInput = S.Struct({
  documentId: S.String,
  key: S.String,
  userId: S.String,
});
export type GetMetadataByKeyInput = S.Schema.Type<typeof GetMetadataByKeyInput>;

/**
 * Branded query for workflows
 */
export const GetMetadataByKeyQuery = S.Struct({
  documentId: StringToDocumentId,
  key: MetadataKey,
  userId: StringToUserId,
});
export type GetMetadataByKeyQuery = S.Schema.Type<typeof GetMetadataByKeyQuery>;
