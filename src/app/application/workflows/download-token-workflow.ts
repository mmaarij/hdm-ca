/**
 * Download Token Workflow
 *
 * Orchestrates download token and file download operations.
 */

import { Effect, Option, Context, Layer, pipe } from "effect";
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
import { loadEntity } from "../utils/effect-helpers";
import {
  isAdmin,
  requireReadPermission,
} from "../../domain/permission/service";
import { UserId, DocumentId } from "../../domain/refined/uuid";
import { Token } from "../../domain/download-token/value-object";
import { DownloadToken } from "../../domain/download-token/entity";
import { Document } from "../../domain/document/entity";
import { DownloadTokenResponseMapper } from "../mappers/download-token.mapper";
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
          pipe(
            // Load document
            loadEntity(
              documentRepo.findById(command.documentId),
              "Document",
              command.documentId
            ),
            Effect.mapError((e) =>
              "_tag" in e && e._tag === "NotFoundError"
                ? new NotFoundError(e)
                : e
            ),
            // Load user and permissions in parallel
            Effect.flatMap((document) =>
              pipe(
                Effect.all({
                  user: loadEntity(
                    userRepo.findById(command.userId),
                    "User",
                    command.userId
                  ),
                  permissions: permissionRepo.findByDocument(
                    command.documentId
                  ),
                }),
                Effect.mapError((e) =>
                  "_tag" in e && e._tag === "NotFoundError"
                    ? new NotFoundError(e)
                    : e
                ),
                Effect.map(({ user, permissions }) => ({
                  document,
                  user,
                  permissions,
                }))
              )
            ),
            // Check read permission
            Effect.flatMap(({ document, user, permissions }) =>
              pipe(
                requireReadPermission(user, document, permissions),
                Effect.map(() => ({ document, user }))
              )
            ),
            // Get version ID
            Effect.flatMap(({ document, user }) => {
              const versionId =
                command.versionId ??
                pipe(
                  Document.getLatestVersion(document),
                  Option.match({
                    onNone: () => undefined as any,
                    onSome: (version) => version.id,
                  })
                );

              if (!versionId) {
                return Effect.fail(
                  new NotFoundError({
                    entityType: "DocumentVersion",
                    id: command.documentId,
                    message: `No versions found for document ${command.documentId}`,
                  })
                );
              }

              return Effect.succeed({ document, user, versionId });
            }),
            // Create and save token
            Effect.flatMap(({ document, user, versionId }) => {
              const ttlMs = command.ttlMs ?? 5 * 60 * 1000;
              const expiresInHours = ttlMs / (60 * 60 * 1000);

              const newToken = DownloadToken.create({
                documentId: command.documentId,
                versionId,
                createdBy: command.userId,
                expiresInHours,
              });

              return pipe(
                tokenRepo.save(newToken),
                Effect.map((token) => ({ token, versionId }))
              );
            }),
            // Add audit log
            Effect.tap(({ token }) =>
              documentRepo.addAudit(
                command.documentId,
                "download_link_generated",
                command.userId,
                Option.some(
                  `Download link generated, expires at ${token.expiresAt.toISOString()}`
                )
              )
            ),
            // Map to response
            Effect.mapError((e) =>
              e instanceof Error ? e : new Error(String(e))
            ),
            Effect.map(({ token }) =>
              DownloadTokenResponseMapper.toDownloadLinkResponse(token, baseUrl)
            )
          ),
          { documentId: command.documentId, userId: command.userId }
        );

    const validateToken: DownloadTokenWorkflow["validateToken"] = (query) =>
      withUseCaseLogging(
        "ValidateToken",
        pipe(
          tokenRepo.findByToken(query.token),
          Effect.map(
            Option.match({
              onNone: () =>
                DownloadTokenResponseMapper.toValidateTokenResponse(false),
              onSome: (token: DownloadToken) =>
                DownloadToken.isExpired(token) || DownloadToken.isUsed(token)
                  ? DownloadTokenResponseMapper.toValidateTokenResponse(false)
                  : DownloadTokenResponseMapper.toValidateTokenResponse(
                      true,
                      token
                    ),
            })
          )
        ),
        { token: query.token }
      );

    const downloadFile: DownloadTokenWorkflow["downloadFile"] = (query) =>
      withUseCaseLogging(
        "DownloadFile",
        pipe(
          // Find token
          tokenRepo.findByToken(query.token),
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.fail(
                  new DownloadTokenNotFoundError({
                    message: "Download token not found or invalid",
                    token: query.token,
                  })
                ),
              onSome: (token: DownloadToken) => Effect.succeed(token),
            })
          ),
          // Check if expired
          Effect.flatMap((token) =>
            DownloadToken.isExpired(token)
              ? Effect.fail(
                  new DownloadTokenExpiredError({
                    message: "Download token has expired",
                    token: query.token,
                    expiresAt: token.expiresAt,
                  })
                )
              : Effect.succeed(token)
          ),
          // Check if already used
          Effect.flatMap((token) =>
            DownloadToken.isUsed(token)
              ? Effect.fail(
                  new DownloadTokenAlreadyUsedError({
                    message: "Download token has already been used",
                    token: query.token,
                    usedAt: Option.isSome(token.usedAt)
                      ? token.usedAt.value
                      : new Date(),
                  })
                )
              : Effect.succeed(token)
          ),
          // Load document
          Effect.flatMap((token) =>
            pipe(
              loadEntity(
                documentRepo.findById(token.documentId),
                "Document",
                token.documentId
              ),
              Effect.map((document) => ({ token, document }))
            )
          ),
          // Get version
          Effect.flatMap(({ token, document }) => {
            if (Option.isSome(token.versionId)) {
              const versionId = token.versionId.value;
              const version = document.versions.find((v) => v.id === versionId);
              if (!version) {
                return Effect.fail(
                  new NotFoundError({
                    entityType: "DocumentVersion",
                    id: versionId,
                    message: `Document version not found`,
                  })
                );
              }
              return Effect.succeed({ token, document, version });
            } else {
              return pipe(
                Document.getLatestVersion(document),
                Option.match({
                  onNone: () =>
                    Effect.fail(
                      new NotFoundError({
                        entityType: "DocumentVersion",
                        id: token.documentId,
                        message: `No versions found for document`,
                      })
                    ),
                  onSome: (version) =>
                    Effect.succeed({ token, document, version }),
                })
              );
            }
          }),
          // Mark token as used
          Effect.flatMap(({ token, document, version }) =>
            pipe(
              tokenRepo.save(DownloadToken.markAsUsed(token)),
              Effect.map(() => ({ token, document, version }))
            )
          ),
          // Add audit log
          Effect.tap(({ token }) =>
            documentRepo.addAudit(
              token.documentId,
              "downloaded",
              token.createdBy,
              Option.some(`Document downloaded via token`)
            )
          ),
          // Map to response
          Effect.mapError((e) =>
            e instanceof Error ? e : new Error(String(e))
          ),
          Effect.map(({ version }) =>
            DownloadTokenResponseMapper.toDownloadFileResponse(version)
          )
        ),
        { token: query.token }
      );

    const cleanupExpiredTokens: DownloadTokenWorkflow["cleanupExpiredTokens"] =
      (command) =>
        withUseCaseLogging(
          "CleanupExpiredTokens",
          pipe(
            // Load user
            loadEntity(
              userRepo.findById(command.userId),
              "User",
              command.userId
            ),
            // Map NotFoundError to Error for type compatibility
            Effect.mapError((e) =>
              "_tag" in e && e._tag === "NotFoundError"
                ? new Error(e.message)
                : e
            ),
            // Check admin permission
            Effect.flatMap((user) =>
              isAdmin(user)
                ? Effect.succeed(user)
                : Effect.fail(
                    new ForbiddenError({
                      message: "Only admins can cleanup expired tokens",
                      resource: "DownloadTokens",
                    })
                  )
            ),
            // Delete expired tokens
            Effect.flatMap(() => tokenRepo.deleteExpired()),
            // Map repository errors to Error
            Effect.mapError((e) =>
              e instanceof Error ? e : new Error(String(e))
            ),
            // Map to response
            Effect.map((deletedCount) =>
              DownloadTokenResponseMapper.toCleanupTokensResponse(deletedCount)
            )
          ),
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
