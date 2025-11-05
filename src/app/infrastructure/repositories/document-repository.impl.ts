import { Effect, Option, Layer } from "effect";
import { eq, desc, like, or, count as drizzleCount } from "drizzle-orm";
import {
  DocumentRepository,
  DocumentRepositoryTag,
} from "../../domain/document/repository";
import {
  Document,
  DocumentVersion,
  CreateDocumentPayload,
  CreateDocumentVersionPayload,
  UpdateDocumentPayload,
  DocumentWithVersion,
} from "../../domain/document/entity";
import {
  DocumentId,
  DocumentVersionId,
  UserId,
} from "../../domain/refined/uuid";
import {
  DocumentNotFoundError,
  DocumentVersionNotFoundError,
  DocumentAlreadyExistsError,
  DocumentConstraintError,
} from "../../domain/document/errors";
import { DrizzleService } from "../services/drizzle-service";
import { documents, documentVersions, documentAudit } from "../models";
import { v4 as uuid } from "uuid";
import { detectDbConstraint } from "../../domain/shared/base.repository";

export const DocumentRepositoryLive = Layer.effect(
  DocumentRepositoryTag,
  Effect.gen(function* () {
    const { db } = yield* DrizzleService;

    const createDocument: DocumentRepository["createDocument"] = (payload) =>
      Effect.gen(function* () {
        const id = payload.id || (uuid() as DocumentId);

        yield* Effect.tryPromise({
          try: () =>
            db.insert(documents).values({
              id,
              filename: payload.filename,
              originalName: payload.originalName,
              mimeType: payload.mimeType,
              size: payload.size,
              path: payload.path || undefined,
              status: (payload.status as "DRAFT" | "PUBLISHED") || "DRAFT",
              uploadedBy: payload.uploadedBy,
            }),
          catch: (error) => {
            const constraintType = detectDbConstraint(error);
            if (constraintType === "unique") {
              return new DocumentAlreadyExistsError({
                documentId: id,
                message: "Document with this filename already exists",
              });
            }
            return new DocumentConstraintError({
              message: "Database constraint violation",
            });
          },
        });

        const doc = yield* Effect.tryPromise({
          try: () =>
            db.query.documents.findFirst({ where: eq(documents.id, id) }),
          catch: () =>
            new DocumentNotFoundError({
              documentId: id,
              message: "Document was created but could not be retrieved",
            }),
        });

        if (!doc) {
          return yield* Effect.fail(
            new DocumentNotFoundError({
              documentId: id,
              message: "Document not found after creation",
            })
          );
        }

        return doc as unknown as Document;
      });

    const createVersion: DocumentRepository["createVersion"] = (payload) =>
      Effect.gen(function* () {
        const id = payload.id || (uuid() as DocumentVersionId);

        yield* Effect.tryPromise({
          try: () =>
            db.insert(documentVersions).values({
              id,
              documentId: payload.documentId,
              filename: payload.filename,
              originalName: payload.originalName,
              mimeType: payload.mimeType,
              size: payload.size,
              path: payload.path || undefined,
              contentRef: payload.contentRef || undefined,
              checksum: payload.checksum || undefined,
              versionNumber: payload.versionNumber,
              uploadedBy: payload.uploadedBy,
            }),
          catch: (error) => {
            const constraintType = detectDbConstraint(error);
            if (constraintType === "unique") {
              return new DocumentConstraintError({
                message: "Version already exists for this document",
              });
            }
            return new DocumentConstraintError({
              message: "Database constraint violation",
            });
          },
        });

        const version = yield* Effect.tryPromise({
          try: () =>
            db.query.documentVersions.findFirst({
              where: eq(documentVersions.id, id),
            }),
          catch: () =>
            new DocumentVersionNotFoundError({
              versionId: id,
              message: "Version was created but could not be retrieved",
            }),
        });

        if (!version) {
          return yield* Effect.fail(
            new DocumentVersionNotFoundError({
              versionId: id,
              message: "Version not found after creation",
            })
          );
        }

        return version as unknown as DocumentVersion;
      });

    const findDocument: DocumentRepository["findDocument"] = (id) =>
      Effect.gen(function* () {
        const doc = yield* Effect.tryPromise({
          try: () =>
            db.query.documents.findFirst({ where: eq(documents.id, id) }),
          catch: () =>
            new DocumentConstraintError({ message: "Database error" }),
        });

        return Option.fromNullable(doc as unknown as Document);
      });

    const findVersionById: DocumentRepository["findVersionById"] = (id) =>
      Effect.gen(function* () {
        const version = yield* Effect.tryPromise({
          try: () =>
            db.query.documentVersions.findFirst({
              where: eq(documentVersions.id, id),
            }),
          catch: () =>
            new DocumentConstraintError({ message: "Database error" }),
        });

        return Option.fromNullable(version as unknown as DocumentVersion);
      });

    const findVersionByChecksum: DocumentRepository["findVersionByChecksum"] = (
      checksum
    ) =>
      Effect.gen(function* () {
        const version = yield* Effect.tryPromise({
          try: () =>
            db.query.documentVersions.findFirst({
              where: eq(documentVersions.checksum, checksum),
            }),
          catch: () =>
            new DocumentConstraintError({ message: "Database error" }),
        });

        return Option.fromNullable(version as unknown as DocumentVersion);
      });

    const findVersionByContentRef: DocumentRepository["findVersionByContentRef"] =
      (contentRef) =>
        Effect.gen(function* () {
          const version = yield* Effect.tryPromise({
            try: () =>
              db.query.documentVersions.findFirst({
                where: eq(documentVersions.contentRef, contentRef),
              }),
            catch: () =>
              new DocumentConstraintError({ message: "Database error" }),
          });

          return Option.fromNullable(version as unknown as DocumentVersion);
        });

    const getLatestVersion: DocumentRepository["getLatestVersion"] = (
      documentId
    ) =>
      Effect.gen(function* () {
        const version = yield* Effect.tryPromise({
          try: () =>
            db.query.documentVersions.findFirst({
              where: eq(documentVersions.documentId, documentId),
              orderBy: [desc(documentVersions.versionNumber)],
            }),
          catch: () =>
            new DocumentConstraintError({ message: "Database error" }),
        });

        return Option.fromNullable(version as unknown as DocumentVersion);
      });

    const listVersions: DocumentRepository["listVersions"] = (documentId) =>
      Effect.gen(function* () {
        const versions = yield* Effect.tryPromise({
          try: () =>
            db.query.documentVersions.findMany({
              where: eq(documentVersions.documentId, documentId),
              orderBy: [desc(documentVersions.versionNumber)],
            }),
          catch: () =>
            new DocumentConstraintError({ message: "Database error" }),
        });

        return (versions as unknown as DocumentVersion[]) || [];
      });

    const listByUser: DocumentRepository["listByUser"] = (userId, pagination) =>
      Effect.gen(function* () {
        const { page, limit } = pagination;
        const offset = (page - 1) * limit;

        const [countResult] = yield* Effect.tryPromise({
          try: () =>
            db
              .select({ count: drizzleCount() })
              .from(documents)
              .where(eq(documents.uploadedBy, userId)),
          catch: () =>
            new DocumentConstraintError({ message: "Database error" }),
        });

        const totalItems = countResult?.count || 0;
        const totalPages = Math.ceil(totalItems / limit);

        const docs = yield* Effect.tryPromise({
          try: () =>
            db.query.documents.findMany({
              where: eq(documents.uploadedBy, userId),
              orderBy: [desc(documents.createdAt)],
              limit,
              offset,
            }),
          catch: () =>
            new DocumentConstraintError({ message: "Database error" }),
        });

        const docsWithVersions = yield* Effect.all(
          docs.map((doc) =>
            Effect.gen(function* () {
              const version = yield* Effect.tryPromise({
                try: () =>
                  db.query.documentVersions.findFirst({
                    where: eq(documentVersions.documentId, doc.id),
                    orderBy: [desc(documentVersions.versionNumber)],
                  }),
                catch: () =>
                  new DocumentConstraintError({ message: "Database error" }),
              });

              return {
                document: doc as unknown as Document,
                latestVersion: version
                  ? (version as unknown as DocumentVersion)
                  : undefined,
              } as DocumentWithVersion;
            })
          )
        );

        return {
          data: docsWithVersions,
          meta: {
            page,
            limit,
            totalItems,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
        };
      });

    const listAll: DocumentRepository["listAll"] = (pagination) =>
      Effect.gen(function* () {
        const { page, limit } = pagination;
        const offset = (page - 1) * limit;

        const [countResult] = yield* Effect.tryPromise({
          try: () => db.select({ count: drizzleCount() }).from(documents),
          catch: () =>
            new DocumentConstraintError({ message: "Database error" }),
        });

        const totalItems = countResult?.count || 0;
        const totalPages = Math.ceil(totalItems / limit);

        const docs = yield* Effect.tryPromise({
          try: () =>
            db.query.documents.findMany({
              orderBy: [desc(documents.createdAt)],
              limit,
              offset,
            }),
          catch: () =>
            new DocumentConstraintError({ message: "Database error" }),
        });

        const docsWithVersions = yield* Effect.all(
          docs.map((doc) =>
            Effect.gen(function* () {
              const version = yield* Effect.tryPromise({
                try: () =>
                  db.query.documentVersions.findFirst({
                    where: eq(documentVersions.documentId, doc.id),
                    orderBy: [desc(documentVersions.versionNumber)],
                  }),
                catch: () =>
                  new DocumentConstraintError({ message: "Database error" }),
              });

              return {
                document: doc as unknown as Document,
                latestVersion: version
                  ? (version as unknown as DocumentVersion)
                  : undefined,
              } as DocumentWithVersion;
            })
          )
        );

        return {
          data: docsWithVersions,
          meta: {
            page,
            limit,
            totalItems,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
        };
      });

    const search: DocumentRepository["search"] = (query, pagination) =>
      Effect.gen(function* () {
        const { page, limit } = pagination;
        const offset = (page - 1) * limit;
        const searchPattern = `%${query}%`;

        const [countResult] = yield* Effect.tryPromise({
          try: () =>
            db
              .select({ count: drizzleCount() })
              .from(documentVersions)
              .where(
                or(
                  like(documentVersions.filename, searchPattern),
                  like(documentVersions.originalName, searchPattern)
                )
              ),
          catch: () =>
            new DocumentConstraintError({ message: "Database error" }),
        });

        const totalItems = countResult?.count || 0;
        const totalPages = Math.ceil(totalItems / limit);

        const versions = yield* Effect.tryPromise({
          try: () =>
            db.query.documentVersions.findMany({
              where: or(
                like(documentVersions.filename, searchPattern),
                like(documentVersions.originalName, searchPattern)
              ),
              orderBy: [desc(documentVersions.createdAt)],
              limit,
              offset,
            }),
          catch: () =>
            new DocumentConstraintError({ message: "Database error" }),
        });

        return {
          data: versions as unknown as readonly DocumentVersion[],
          meta: {
            page,
            limit,
            totalItems,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
        };
      });

    const updateDocument: DocumentRepository["updateDocument"] = (
      id,
      payload
    ) =>
      Effect.gen(function* () {
        const updateData: Record<string, any> = {};
        if (payload.filename !== undefined)
          updateData.filename = payload.filename;
        if (payload.originalName !== undefined)
          updateData.originalName = payload.originalName;
        if (payload.path !== undefined) updateData.path = payload.path;
        if (payload.status !== undefined) updateData.status = payload.status;

        if (Object.keys(updateData).length === 0) {
          const doc = yield* findDocument(id);
          if (Option.isNone(doc)) {
            return yield* Effect.fail(
              new DocumentNotFoundError({
                documentId: id,
                message: "Document not found",
              })
            );
          }
          return doc.value;
        }

        yield* Effect.tryPromise({
          try: () =>
            db.update(documents).set(updateData).where(eq(documents.id, id)),
          catch: () =>
            new DocumentConstraintError({ message: "Database error" }),
        });

        const updated = yield* Effect.tryPromise({
          try: () =>
            db.query.documents.findFirst({ where: eq(documents.id, id) }),
          catch: () =>
            new DocumentNotFoundError({
              documentId: id,
              message: "Document not found",
            }),
        });

        if (!updated) {
          return yield* Effect.fail(
            new DocumentNotFoundError({
              documentId: id,
              message: "Document not found",
            })
          );
        }

        return updated as unknown as Document;
      });

    const updateVersion: DocumentRepository["updateVersion"] = (id, payload) =>
      Effect.gen(function* () {
        // Prepare update object
        const updates: any = {};
        if (payload.path !== undefined) updates.path = payload.path;
        if (payload.contentRef !== undefined)
          updates.contentRef = payload.contentRef;
        if (payload.checksum !== undefined) updates.checksum = payload.checksum;

        yield* Effect.tryPromise({
          try: () =>
            db
              .update(documentVersions)
              .set(updates)
              .where(eq(documentVersions.id, id)),
          catch: () =>
            new DocumentConstraintError({ message: "Database error" }),
        });

        const updated = yield* Effect.tryPromise({
          try: () =>
            db.query.documentVersions.findFirst({
              where: eq(documentVersions.id, id),
            }),
          catch: () =>
            new DocumentNotFoundError({
              documentId: "" as DocumentId, // We don't have documentId here
              message: "Version not found",
            }),
        });

        if (!updated) {
          return yield* Effect.fail(
            new DocumentNotFoundError({
              documentId: "" as DocumentId,
              message: "Version not found",
            })
          );
        }

        return updated as unknown as DocumentVersion;
      });

    const deleteDocument: DocumentRepository["deleteDocument"] = (id) =>
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise({
          try: () => db.delete(documents).where(eq(documents.id, id)),
          catch: () =>
            new DocumentConstraintError({ message: "Database error" }),
        });

        if (!(result as any).changes && !(result as any).rowCount) {
          return yield* Effect.fail(
            new DocumentNotFoundError({
              documentId: id,
              message: "Document not found",
            })
          );
        }
      });

    const addAudit: DocumentRepository["addAudit"] = (payload) =>
      Effect.gen(function* () {
        yield* Effect.tryPromise({
          try: () =>
            db.insert(documentAudit).values({
              documentId: payload.documentId,
              action: payload.action,
              performedBy: payload.performedBy,
              details: payload.details || "",
            }),
          catch: () =>
            new DocumentConstraintError({ message: "Database error" }),
        });
      });

    return {
      createDocument,
      createVersion,
      findDocument,
      findVersionById,
      findVersionByChecksum,
      findVersionByContentRef,
      getLatestVersion,
      listVersions,
      listByUser,
      listAll,
      search,
      updateDocument,
      updateVersion,
      deleteDocument,
      addAudit,
    } satisfies DocumentRepository;
  })
);
