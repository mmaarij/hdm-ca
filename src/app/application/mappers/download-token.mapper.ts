/**
 * Download Token Application → Domain Mappers
 *
 * Maps Application DTOs to Domain entities for download token operations.
 */

import { Option } from "effect";
import type { GenerateDownloadLinkCommand } from "../dtos/download-token/request.dto";
import type {
  DownloadLinkResponse,
  DownloadFileResponse,
  ValidateTokenResponse,
  CleanupTokensResponse,
} from "../dtos/download-token/response.dto";
import type { DownloadTokenEntity as DownloadToken } from "../../domain/download-token/entity";
import type { DocumentVersionEntity as DocumentVersion } from "../../domain/document/entity";

/**
 * Command to Domain Mappers
 */
export const DownloadTokenCommandMapper = {
  /**
   * Map GenerateDownloadLinkCommand to domain parameters
   * Note: DownloadToken is created via factory in the workflow
   */
  toCreateParams: (
    command: GenerateDownloadLinkCommand
  ): {
    documentId: typeof command.documentId;
    versionId: typeof command.versionId;
    createdBy: typeof command.userId;
    expiresInHours: number;
  } => ({
    documentId: command.documentId,
    versionId: command.versionId,
    createdBy: command.userId,
    expiresInHours: (command.ttlMs ?? 5 * 60 * 1000) / (60 * 60 * 1000),
  }),
} as const;

/**
 * Domain to Response Mappers
 */
export const DownloadTokenResponseMapper = {
  /**
   * Map DownloadToken entity to DownloadLinkResponse DTO
   */
  toDownloadLinkResponse: (
    token: DownloadToken,
    baseUrl: string
  ): DownloadLinkResponse => ({
    token: token.token,
    documentId: token.documentId,
    versionId: Option.isSome(token.versionId)
      ? token.versionId.value
      : undefined,
    downloadUrl: `${baseUrl}/download/${token.token}`,
    expiresAt: token.expiresAt as any, // Branded Date type
  }),

  /**
   * Map DocumentVersion to DownloadFileResponse DTO
   */
  toDownloadFileResponse: (version: DocumentVersion): DownloadFileResponse => ({
    documentId: version.documentId,
    versionId: version.id,
    filename: version.filename,
    mimeType: version.mimeType,
    size: version.size,
    path: Option.getOrElse(version.path, () => ""),
  }),

  /**
   * Map token validation to ValidateTokenResponse DTO
   */
  toValidateTokenResponse: (
    valid: boolean,
    token?: DownloadToken
  ): ValidateTokenResponse => {
    if (!valid || !token) {
      return { valid: false };
    }

    return {
      valid: true,
      documentId: token.documentId,
      versionId: Option.isSome(token.versionId)
        ? token.versionId.value
        : undefined,
      expiresAt: token.expiresAt as any, // Branded Date type
    };
  },

  /**
   * Map cleanup operation to CleanupTokensResponse DTO
   */
  toCleanupTokensResponse: (deletedCount: number): CleanupTokensResponse => ({
    deletedCount,
    message: `Successfully deleted ${deletedCount} expired download tokens`,
  }),
} as const;
