/**
 * Download Token Workflow
 *
 * Orchestrates download token and file download operations.
 */

import { Effect, Option, Context, Layer } from "effect";
import { DownloadTokenRepositoryTag } from "../../domain/download-token/repository";
import { DocumentRepositoryTag } from "../../domain/document/repository";
import { UserRepositoryTag } from "../../domain/user/repository";
import { PermissionRepositoryTag } from "../../domain/permission/repository";
import { NotFoundError, ForbiddenError } from "../../domain/shared/base.errors";
import {
  InsufficientPermissionError,
  DownloadTokenExpiredError,
  DownloadTokenNotFoundError,
  DownloadTokenAlreadyUsedError,
} from "../utils/errors";
import { withUseCaseLogging } from "../utils/logging";
import { canRead, isAdmin } from "../../domain/permission/access-service";
import { UserId, DocumentId } from "../../domain/refined/uuid";
import { Token } from "../../domain/download-token/value-object";
import type {
  GenerateDownloadLinkCommand,
  ValidateDownloadTokenQuery,
  DownloadFileQuery,
  CleanupExpiredTokensCommand,
} from "../dtos/download-token/request.dto";
import type {
  DownloadLinkResponse,
  DownloadFileResponse,
  ValidateTokenResponse,
  CleanupTokensResponse,
} from "../dtos/download-token/response.dto";

/**
 * Download Token Workflow Interface
 */
export interface DownloadTokenWorkflow {
  /**
   * Generate a download link for a document
   */
  readonly generateDownloadLink: (
    command: GenerateDownloadLinkCommand,
    baseUrl: string
  ) => Effect.Effect<
    DownloadLinkResponse,
    NotFoundError | InsufficientPermissionError | Error
  >;

  /**
   * Validate a download token
   */
  readonly validateToken: (
    query: ValidateDownloadTokenQuery
  ) => Effect.Effect<ValidateTokenResponse, Error>;

  /**
   * Download file using token
   */
  readonly downloadFile: (
    query: DownloadFileQuery
  ) => Effect.Effect<
    DownloadFileResponse,
    | DownloadTokenNotFoundError
    | DownloadTokenExpiredError
    | DownloadTokenAlreadyUsedError
    | NotFoundError
    | Error
  >;

  /**
   * Cleanup expired tokens (admin only)
   */
  readonly cleanupExpiredTokens: (
    command: CleanupExpiredTokensCommand
  ) => Effect.Effect<CleanupTokensResponse, ForbiddenError | Error>;
}

export const DownloadTokenWorkflowTag =
  Context.GenericTag<DownloadTokenWorkflow>("@app/DownloadTokenWorkflow");

/**
 * Live implementation of DownloadTokenWorkflow
 */
export const DownloadTokenWorkflowLive = Layer.effect(
  DownloadTokenWorkflowTag,
  Effect.gen(function* () {
    const tokenRepo = yield* DownloadTokenRepositoryTag;
    const documentRepo = yield* DocumentRepositoryTag;
    const userRepo = yield* UserRepositoryTag;
    const permissionRepo = yield* PermissionRepositoryTag;

    const generateDownloadLink: DownloadTokenWorkflow["generateDownloadLink"] =
      (command, baseUrl) =>
        withUseCaseLogging(
          "GenerateDownloadLink",
          Effect.gen(function* () {
            // Verify document exists
            const documentOpt = yield* documentRepo.findDocument(
              command.documentId
            );
            if (Option.isNone(documentOpt)) {
              return yield* Effect.fail(
                new NotFoundError({
                  entityType: "Document",
                  id: command.documentId,
                  message: `Document with ID ${command.documentId} not found`,
                })
              );
            }

            const document = documentOpt.value;

            // Verify user has read permission
            const userOpt = yield* userRepo.findById(command.userId);
            if (Option.isNone(userOpt)) {
              return yield* Effect.fail(
                new NotFoundError({
                  entityType: "User",
                  id: command.userId,
                  message: `User with ID ${command.userId} not found`,
                })
              );
            }

            const user = userOpt.value;
            const permissions = yield* permissionRepo.findByDocument(
              command.documentId
            );

            if (!canRead(user, document, permissions)) {
              return yield* Effect.fail(
                new InsufficientPermissionError({
                  message: "Insufficient permission to generate download link",
                  requiredPermission: "READ",
                  resource: `Document:${command.documentId}`,
                })
              );
            }

            // Get version (latest if not specified)
            let versionId = command.versionId;
            if (!versionId) {
              const latestVersionOpt = yield* documentRepo.getLatestVersion(
                command.documentId
              );
              if (Option.isNone(latestVersionOpt)) {
                return yield* Effect.fail(
                  new NotFoundError({
                    entityType: "DocumentVersion",
                    id: command.documentId,
                    message: `No versions found for document ${command.documentId}`,
                  })
                );
              }
              versionId = latestVersionOpt.value.id;
            }

            // Calculate expiration (default 5 minutes)
            const ttlMs = command.ttlMs ?? 5 * 60 * 1000;
            const expiresAt = new Date(Date.now() + ttlMs) as any;

            // Generate random token
            const tokenString = yield* Effect.sync(() => {
              return Array.from(
                { length: 32 },
                () => Math.random().toString(36)[2]
              ).join("");
            });

            // Create token
            const token = yield* tokenRepo.create({
              documentId: command.documentId,
              versionId,
              token: tokenString as Token,
              expiresAt,
              createdBy: command.userId,
            });

            // Add audit log
            yield* documentRepo.addAudit({
              documentId: command.documentId,
              action: "download_link_generated",
              performedBy: command.userId,
              details: `Download link generated, expires at ${expiresAt.toISOString()}`,
            });

            return {
              token: token.token,
              documentId: token.documentId,
              versionId: token.versionId,
              downloadUrl: `${baseUrl}/download/${token.token}`,
              expiresAt: token.expiresAt,
            };
          }),
          { documentId: command.documentId, userId: command.userId }
        );

    const validateToken: DownloadTokenWorkflow["validateToken"] = (query) =>
      withUseCaseLogging(
        "ValidateToken",
        Effect.gen(function* () {
          const tokenOpt = yield* tokenRepo.findByToken(query.token);

          if (Option.isNone(tokenOpt)) {
            return { valid: false };
          }

          const token = tokenOpt.value;

          // Check if expired
          const now = new Date();
          const expiresAt = new Date(token.expiresAt);
          if (now > expiresAt) {
            return { valid: false };
          }

          // Check if already used
          if (token.usedAt) {
            return { valid: false };
          }

          return {
            valid: true,
            documentId: token.documentId,
            versionId: token.versionId,
            expiresAt: token.expiresAt,
          };
        }),
        { token: query.token }
      );

    const downloadFile: DownloadTokenWorkflow["downloadFile"] = (query) =>
      withUseCaseLogging(
        "DownloadFile",
        Effect.gen(function* () {
          // Find token
          const tokenOpt = yield* tokenRepo.findByToken(query.token);
          if (Option.isNone(tokenOpt)) {
            return yield* Effect.fail(
              new DownloadTokenNotFoundError({
                message: "Download token not found or invalid",
                token: query.token,
              })
            );
          }

          const token = tokenOpt.value;

          // Check if expired
          const now = new Date();
          const expiresAt = new Date(token.expiresAt);
          if (now > expiresAt) {
            return yield* Effect.fail(
              new DownloadTokenExpiredError({
                message: "Download token has expired",
                token: query.token,
                expiresAt: expiresAt,
              })
            );
          }

          // Check if already used
          if (token.usedAt) {
            return yield* Effect.fail(
              new DownloadTokenAlreadyUsedError({
                message: "Download token has already been used",
                token: query.token,
                usedAt: new Date(token.usedAt),
              })
            );
          }

          // Get version
          const versionId = token.versionId ?? (token.documentId as any);
          const versionOpt = yield* documentRepo.findVersionById(versionId);
          if (Option.isNone(versionOpt)) {
            return yield* Effect.fail(
              new NotFoundError({
                entityType: "DocumentVersion",
                id: versionId,
                message: `Document version not found`,
              })
            );
          }

          const version = versionOpt.value;

          // Mark token as used
          yield* tokenRepo.markAsUsed(token.id);

          // Add audit log
          yield* documentRepo.addAudit({
            documentId: token.documentId,
            action: "downloaded",
            performedBy: token.createdBy,
            details: `Document downloaded via token`,
          });

          return {
            documentId: version.documentId,
            versionId: version.id,
            filename: version.filename,
            mimeType: version.mimeType,
            size: version.size,
            path: version.path || "", // Handle optional path
          };
        }),
        { token: query.token }
      );

    const cleanupExpiredTokens: DownloadTokenWorkflow["cleanupExpiredTokens"] =
      (command) =>
        withUseCaseLogging(
          "CleanupExpiredTokens",
          Effect.gen(function* () {
            // Verify user is admin
            const userOpt = yield* userRepo.findById(command.userId);
            if (Option.isNone(userOpt)) {
              return yield* Effect.fail(
                new NotFoundError({
                  entityType: "User",
                  id: command.userId,
                  message: `User with ID ${command.userId} not found`,
                })
              );
            }

            const user = userOpt.value;
            if (!isAdmin(user)) {
              return yield* Effect.fail(
                new ForbiddenError({
                  message: "Only admins can cleanup expired tokens",
                  resource: "DownloadTokens",
                })
              );
            }

            // Delete expired tokens
            const deletedCount = yield* tokenRepo.deleteExpired();

            return {
              deletedCount,
              message: `Successfully deleted ${deletedCount} expired download tokens`,
            };
          }),
          { userId: command.userId }
        );

    return {
      generateDownloadLink,
      validateToken,
      downloadFile,
      cleanupExpiredTokens,
    } satisfies DownloadTokenWorkflow;
  })
);
