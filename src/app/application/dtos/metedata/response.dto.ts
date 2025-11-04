/**
 * Metadata Response DTOs
 */

import { Schema as S } from "effect";
import { DocumentId } from "../../../domain/refined/uuid";
import { MetadataId } from "../../../domain/metedata/entity";
import {
  MetadataKey,
  MetadataValue,
} from "../../../domain/metedata/value-object";
import { DateTime } from "../../../domain/refined/date-time";

/**
 * Metadata Response
 */
export const MetadataResponse = S.Struct({
  id: MetadataId,
  documentId: DocumentId,
  key: MetadataKey,
  value: MetadataValue,
  createdAt: S.optional(DateTime),
});

export type MetadataResponse = S.Schema.Type<typeof MetadataResponse>;

/**
 * List Metadata Response
 */
export const ListMetadataResponse = S.Struct({
  metadata: S.Array(MetadataResponse),
  total: S.Number,
});

export type ListMetadataResponse = S.Schema.Type<typeof ListMetadataResponse>;

/**
 * Metadata Map Response (key-value pairs)
 */
export const MetadataMapResponse = S.Record({
  key: MetadataKey,
  value: MetadataValue,
});

export type MetadataMapResponse = S.Schema.Type<typeof MetadataMapResponse>;
