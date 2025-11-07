import { Option } from "effect";
import { DownloadTokenEntity } from "../../domain/download-token/entity";
import {
  DownloadTokenId,
  DocumentId,
  DocumentVersionId,
  UserId,
} from "../../domain/refined/uuid";
import { Token } from "../../domain/download-token/value-object";
import { normalizeMaybe } from "../../domain/shared/base-entity";

/**
 * Database row type for DownloadToken (from Drizzle)
 */
export interface DownloadTokenRow {
  id: string;
  documentId: string;
  versionId: string | null;
  token: string;
  expiresAt: Date | string;
  usedAt: Date | string | null;
  createdBy: string;
  createdAt: Date | string;
}

/**
 * DownloadToken Mapper - Infrastructure ↔ Domain
 */
export const DownloadTokenMapper = {
  /**
   * Database → Domain
   */
  toDomain: (row: DownloadTokenRow): DownloadTokenEntity =>
    new DownloadTokenEntity(
      row.id as DownloadTokenId,
      row.documentId as DocumentId,
      normalizeMaybe(
        row.versionId ? (row.versionId as DocumentVersionId) : null
      ),
      row.token as Token,
      typeof row.expiresAt === "string"
        ? new Date(row.expiresAt)
        : row.expiresAt,
      normalizeMaybe(
        row.usedAt
          ? typeof row.usedAt === "string"
            ? new Date(row.usedAt)
            : row.usedAt
          : null
      ),
      row.createdBy as UserId,
      typeof row.createdAt === "string"
        ? new Date(row.createdAt)
        : row.createdAt
    ),

  /**
   * Domain → Database Create Input
   */
  toDbCreate: (token: DownloadTokenEntity) => ({
    id: token.id,
    documentId: token.documentId,
    versionId: Option.getOrNull(token.versionId),
    token: token.token,
    expiresAt: token.expiresAt.toISOString(),
    usedAt: Option.match(token.usedAt, {
      onNone: () => null,
      onSome: (date) => date.toISOString(),
    }),
    createdBy: token.createdBy,
    createdAt: token.createdAt.toISOString(),
  }),

  /**
   * Domain → Database Update Input (for marking as used)
   */
  toDbUpdate: (token: DownloadTokenEntity) => ({
    usedAt: Option.match(token.usedAt, {
      onNone: () => null,
      onSome: (date) => date.toISOString(),
    }),
  }),

  /**
   * Convert array of rows to domain entities
   */
  toDomainMany: (rows: DownloadTokenRow[]): DownloadTokenEntity[] =>
    rows.map(DownloadTokenMapper.toDomain),
};
