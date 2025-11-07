import { Option } from "effect";
import {
  DownloadToken,
  DownloadTokenWithDocument,
} from "../../domain/download-token/entity";
import {
  DownloadTokenId,
  DocumentId,
  DocumentVersionId,
  UserId,
} from "../../domain/refined/uuid";
import { Token } from "../../domain/download-token/value-object";

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
  toDomain: (row: DownloadTokenRow): DownloadToken => ({
    id: row.id as DownloadTokenId,
    documentId: row.documentId as DocumentId,
    versionId: row.versionId
      ? Option.some(row.versionId as DocumentVersionId)
      : Option.none(),
    token: row.token as Token,
    expiresAt:
      typeof row.expiresAt === "string"
        ? new Date(row.expiresAt)
        : row.expiresAt,
    usedAt: row.usedAt
      ? Option.some(
          typeof row.usedAt === "string" ? new Date(row.usedAt) : row.usedAt
        )
      : Option.none(),
    createdBy: row.createdBy as UserId,
    createdAt:
      typeof row.createdAt === "string"
        ? new Date(row.createdAt)
        : row.createdAt,
  }),

  /**
   * Domain → Database Create Input
   */
  toDbCreate: (token: DownloadToken) => ({
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
  toDbUpdate: (token: DownloadToken) => ({
    usedAt: Option.match(token.usedAt, {
      onNone: () => null,
      onSome: (date) => date.toISOString(),
    }),
  }),

  /**
   * Convert array of rows to domain entities
   */
  toDomainMany: (rows: DownloadTokenRow[]): DownloadToken[] =>
    rows.map(DownloadTokenMapper.toDomain),
};
