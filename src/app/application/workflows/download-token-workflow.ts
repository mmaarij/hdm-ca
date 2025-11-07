/**
 * Download Token Workflow - Functional Pattern
 *
 * Functional workflows using currying pattern.
 * No Effect.gen usage - pure monadic composition with pipe.
 */

import { Effect, Option, pipe } from "effect";
import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";
import type { DownloadTokenRepository } from "../../domain/download-token/repository";
import type { DocumentRepository } from "../../domain/document/repository";
import type { UserRepository } from "../../domain/user/repository";
import type { PermissionRepository } from "../../domain/permission/repository";
import { NotFoundError, ForbiddenError } from "../../domain/shared/base.errors";
import {
  InsufficientPermissionError,
  DownloadTokenExpiredError,
  DownloadTokenNotFoundError,
  DownloadTokenAlreadyUsedError,
} from "../utils/errors";
import {
  isAdmin,
  requireReadPermission,
} from "../../domain/permission/service";
import { loadEntity } from "../utils/effect-helpers";
import type { UserId, DocumentId } from "../../domain/refined/uuid";
import type { Token } from "../../domain/download-token/value-object";
import { DownloadTokenEntity as DownloadToken } from "../../domain/download-token/entity";
import { DocumentEntity as Document } from "../../domain/document/entity";
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

// Re-export WorkflowTag from bootstrap for route compatibility
export { DownloadTokenWorkflowTag } from "../../bootstrap";

/**
 * Dependencies for download token workflows
 */
export interface DownloadTokenWorkflowDeps {
  readonly tokenRepo: DownloadTokenRepository;
  readonly documentRepo: DocumentRepository;
  readonly userRepo: UserRepository;
  readonly permissionRepo: PermissionRepository;
}

/**
 * Generate a download link for a document
 */
export const generateDownloadLink =
  (deps: DownloadTokenWorkflowDeps) =>
  (
    command: GenerateDownloadLinkCommand,
    baseUrl: string
  ): Effect.Effect<
    DownloadLinkResponse,
    NotFoundError | InsufficientPermissionError | Error
  > =>
    pipe(
      loadEntity(
        deps.documentRepo.findById(command.documentId),
        "Document",
        command.documentId
      ),
      Effect.flatMap((document) =>
        pipe(
          Effect.all({
            user: loadEntity(
              deps.userRepo.findById(command.userId),
              "User",
              command.userId
            ),
            permissions: deps.permissionRepo.findByDocument(command.documentId),
          }),
          Effect.map(({ user, permissions }) => ({
            document,
            user,
            permissions,
          }))
        )
      ),
      Effect.flatMap(({ document, user, permissions }) =>
        pipe(
          requireReadPermission(user, document, permissions),
          Effect.map(() => ({ document, user }))
        )
      ),
      Effect.flatMap(({ document, user }) => {
        const versionId =
          command.versionId ??
          pipe(
            document.getLatestVersion(),
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
      Effect.flatMap(({ document, user, versionId }) => {
        const ttlMs = command.ttlMs ?? 5 * 60 * 1000;
        const expiresAt = new Date(Date.now() + ttlMs);

        return pipe(
          DownloadToken.create({
            id: uuidv4() as any,
            documentId: command.documentId,
            versionId,
            token: randomBytes(32).toString("base64url") as any,
            expiresAt: expiresAt.toISOString() as any,
            createdBy: command.userId,
            createdAt: new Date().toISOString() as any,
          }),
          Effect.flatMap((newToken) =>
            pipe(
              deps.tokenRepo.save(newToken),
              Effect.map((token) => ({ token, versionId }))
            )
          )
        );
      }),
      Effect.tap(({ token }) =>
        deps.documentRepo.addAudit(
          command.documentId,
          "download_link_generated",
          command.userId,
          Option.some(
            `Download link generated, expires at ${token.expiresAt.toISOString()}`
          )
        )
      ),
      Effect.map(({ token }) =>
        DownloadTokenResponseMapper.toDownloadLinkResponse(token, baseUrl)
      ),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e))))
    );

/**
 * Validate a download token
 */
export const validateToken =
  (deps: DownloadTokenWorkflowDeps) =>
  (
    query: ValidateDownloadTokenQuery
  ): Effect.Effect<ValidateTokenResponse, Error> =>
    pipe(
      deps.tokenRepo.findByToken(query.token),
      Effect.map(
        Option.match({
          onNone: () =>
            DownloadTokenResponseMapper.toValidateTokenResponse(false),
          onSome: (token: DownloadToken) =>
            token.isExpired() || token.isUsed()
              ? DownloadTokenResponseMapper.toValidateTokenResponse(false)
              : DownloadTokenResponseMapper.toValidateTokenResponse(
                  true,
                  token
                ),
        })
      ),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e))))
    );

/**
 * Download file using token
 */
export const downloadFile =
  (deps: DownloadTokenWorkflowDeps) =>
  (
    query: DownloadFileQuery
  ): Effect.Effect<
    DownloadFileResponse,
    | DownloadTokenNotFoundError
    | DownloadTokenExpiredError
    | DownloadTokenAlreadyUsedError
    | NotFoundError
    | Error
  > =>
    pipe(
      deps.tokenRepo.findByToken(query.token),
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
      Effect.flatMap((token) =>
        token.isExpired()
          ? Effect.fail(
              new DownloadTokenExpiredError({
                message: "Download token has expired",
                token: query.token,
                expiresAt: token.expiresAt,
              })
            )
          : Effect.succeed(token)
      ),
      Effect.flatMap((token) =>
        token.isUsed()
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
      Effect.flatMap((token) =>
        pipe(
          loadEntity(
            deps.documentRepo.findById(token.documentId),
            "Document",
            token.documentId
          ),
          Effect.map((document) => ({ token, document }))
        )
      ),
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
            document.getLatestVersion(),
            Option.match({
              onNone: () =>
                Effect.fail(
                  new NotFoundError({
                    entityType: "DocumentVersion",
                    id: token.documentId,
                    message: `No versions found for document`,
                  })
                ),
              onSome: (version) => Effect.succeed({ token, document, version }),
            })
          );
        }
      }),
      Effect.flatMap(({ token, document, version }) =>
        pipe(
          deps.tokenRepo.save(token.markAsUsed()),
          Effect.map(() => ({ token, document, version }))
        )
      ),
      Effect.tap(({ token }) =>
        deps.documentRepo.addAudit(
          token.documentId,
          "downloaded",
          token.createdBy,
          Option.some(`Document downloaded via token`)
        )
      ),
      Effect.map(({ version }) =>
        DownloadTokenResponseMapper.toDownloadFileResponse(version)
      ),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e))))
    );

/**
 * Cleanup expired tokens (admin only)
 */
export const cleanupExpiredTokens =
  (deps: DownloadTokenWorkflowDeps) =>
  (
    command: CleanupExpiredTokensCommand
  ): Effect.Effect<CleanupTokensResponse, ForbiddenError | Error> =>
    pipe(
      loadEntity(
        deps.userRepo.findById(command.userId),
        "User",
        command.userId
      ),
      Effect.mapError((e) =>
        "_tag" in e && e._tag === "NotFoundError" ? new Error(e.message) : e
      ),
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
      Effect.flatMap(() => deps.tokenRepo.deleteExpired()),
      Effect.map((deletedCount) =>
        DownloadTokenResponseMapper.toCleanupTokensResponse(deletedCount)
      ),
      Effect.mapError((e) => (e instanceof Error ? e : new Error(String(e))))
    );
