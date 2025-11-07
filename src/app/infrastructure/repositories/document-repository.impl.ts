import { Effect, Option, Layer, pipe } from "effect";
import { eq, desc, asc, like, or, count as drizzleCount } from "drizzle-orm";
import {
  DocumentRepository,
  DocumentRepositoryTag,
} from "../../domain/document/repository";
import { Document, DocumentWithVersion } from "../../domain/document/entity";
import { DocumentId, UserId } from "../../domain/refined/uuid";
import {
  DocumentNotFoundError,
  DocumentConstraintError,
  DocumentInfrastructureError,
} from "../../domain/document/errors";
import { DrizzleService } from "../services/drizzle-service";
import { documents, documentVersions, documentAudit } from "../models";
import {
  DocumentMapper,
  DocumentVersionMapper,
} from "../mappers/document.mapper";
import { detectDbConstraint } from "../../domain/shared/base.repository";

/**
 * Document Repository Implementation using Drizzle ORM
 *
 * Handles the Document aggregate including all versions.
 * Document is the aggregate root - versions are always loaded with the document.
 */
export const DocumentRepositoryLive = Layer.effect(
  DocumentRepositoryTag,
  Effect.gen(function* () {
    const { db } = yield* DrizzleService;

    /**
     * Save a document aggregate (document + all versions)
     * Handles both creation and updates
     */
    const save: DocumentRepository["save"] = (document) =>
      pipe(
        // Check if document exists
        Effect.tryPromise({
          try: () =>
            db.query.documents.findFirst({
              where: eq(documents.id, document.id),
            }),
          catch: () =>
            new DocumentInfrastructureError({
              message: "Database connection error",
            }),
        }),
        Effect.flatMap((existingDocRow) => {
          if (existingDocRow) {
            // Update existing document
            const updateData = DocumentMapper.toDbUpdate(document);
            return Effect.tryPromise({
              try: () =>
                db
                  .update(documents)
                  .set(updateData)
                  .where(eq(documents.id, document.id)),
              catch: () =>
                new DocumentConstraintError({
                  message: "Database constraint violation",
                }),
            });
          } else {
            // Create new document
            const createData = DocumentMapper.toDbCreate(document);
            return Effect.tryPromise({
              try: () => db.insert(documents).values(createData),
              catch: (error) => {
                const constraintType = detectDbConstraint(error);
                if (constraintType === "unique") {
                  return new DocumentConstraintError({
                    message: "Document with this filename already exists",
                  });
                }
                return new DocumentConstraintError({
                  message: "Database constraint violation",
                });
              },
            });
          }
        }),
        // Save all versions - get existing version IDs
        Effect.flatMap(() =>
          Effect.tryPromise({
            try: () =>
              db.query.documentVersions.findMany({
                where: eq(documentVersions.documentId, document.id),
              }),
            catch: () =>
              new DocumentInfrastructureError({
                message: "Database connection error",
              }),
          })
        ),
        Effect.flatMap((existingVersionRows) => {
          const existingVersionIds = new Set(
            existingVersionRows.map((v) => v.id)
          );

          // Upsert each version in the document
          const versionEffects = document.versions.map((version) => {
            if (existingVersionIds.has(version.id)) {
              // Update existing version
              const versionUpdate = DocumentVersionMapper.toDbUpdate(version);
              return Effect.tryPromise({
                try: () =>
                  db
                    .update(documentVersions)
                    .set(versionUpdate)
                    .where(eq(documentVersions.id, version.id)),
                catch: () =>
                  new DocumentConstraintError({
                    message: "Failed to update version",
                  }),
              });
            } else {
              // Insert new version
              const versionCreate = DocumentVersionMapper.toDbCreate(version);
              return Effect.tryPromise({
                try: () => db.insert(documentVersions).values(versionCreate),
                catch: () =>
                  new DocumentConstraintError({
                    message: "Failed to create version",
                  }),
              });
            }
          });

          return Effect.all(versionEffects, { concurrency: "unbounded" });
        }),
        // Return the saved aggregate by loading it fresh
        Effect.flatMap(() => findById(document.id)),
        Effect.flatMap((docOpt) =>
          pipe(
            docOpt,
            Option.match({
              onNone: () =>
                Effect.fail(
                  new DocumentNotFoundError({
                    documentId: document.id,
                    message: "Document not found after save",
                  })
                ),
              onSome: (doc) => Effect.succeed(doc),
            })
          )
        )
      );

    /**
     * Find document by ID (loads full aggregate with all versions)
     */
    const findById: DocumentRepository["findById"] = (id) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db.query.documents.findFirst({ where: eq(documents.id, id) }),
          catch: () =>
            new DocumentInfrastructureError({
              message: "Database connection error",
            }),
        }),
        Effect.flatMap((docRow) => {
          if (!docRow) {
            return Effect.succeed(Option.none());
          }

          // Load all versions for this document (ordered by version number ascending)
          return pipe(
            Effect.tryPromise({
              try: () =>
                db.query.documentVersions.findMany({
                  where: eq(documentVersions.documentId, id),
                  orderBy: [asc(documentVersions.versionNumber)],
                }),
              catch: () =>
                new DocumentInfrastructureError({
                  message: "Database connection error",
                }),
            }),
            Effect.map((versionRows) =>
              Option.some(
                DocumentMapper.toDomainWithVersions(docRow, versionRows)
              )
            )
          );
        })
      );

    /**
     * Find document by version checksum
     * Returns the parent document, not just the version
     */
    const findByChecksum: DocumentRepository["findByChecksum"] = (checksum) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db.query.documentVersions.findFirst({
              where: eq(documentVersions.checksum, checksum),
            }),
          catch: () =>
            new DocumentInfrastructureError({
              message: "Database connection error",
            }),
        }),
        Effect.flatMap((versionRow) => {
          if (!versionRow) {
            return Effect.succeed(Option.none());
          }

          // Load the parent document with all versions
          return findById(versionRow.documentId as DocumentId);
        })
      );

    /**
     * Find document by content reference
     * Returns the parent document, not just the version
     */
    const findByContentRef: DocumentRepository["findByContentRef"] = (
      contentRef
    ) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db.query.documentVersions.findFirst({
              where: eq(documentVersions.contentRef, contentRef),
            }),
          catch: () =>
            new DocumentInfrastructureError({
              message: "Database connection error",
            }),
        }),
        Effect.flatMap((versionRow) => {
          if (!versionRow) {
            return Effect.succeed(Option.none());
          }

          // Load the parent document with all versions
          return findById(versionRow.documentId as DocumentId);
        })
      );

    /**
     * List documents by user with pagination
     * Returns documents with their latest version
     */
    const listByUser: DocumentRepository["listByUser"] = (userId, pagination) =>
      pipe(
        Effect.all({
          // Get total count
          count: pipe(
            Effect.tryPromise({
              try: () =>
                db
                  .select({ count: drizzleCount() })
                  .from(documents)
                  .where(eq(documents.uploadedBy, userId)),
              catch: () =>
                new DocumentInfrastructureError({
                  message: "Database connection error",
                }),
            }),
            Effect.map(([countResult]) => countResult?.count || 0)
          ),
          // Get paginated documents
          docRows: Effect.tryPromise({
            try: () => {
              const { page, limit } = pagination;
              const offset = (page - 1) * limit;
              return db.query.documents.findMany({
                where: eq(documents.uploadedBy, userId),
                orderBy: [desc(documents.createdAt)],
                limit,
                offset,
              });
            },
            catch: () =>
              new DocumentInfrastructureError({
                message: "Database connection error",
              }),
          }),
        }),
        Effect.flatMap(({ count: totalItems, docRows }) => {
          const { page, limit } = pagination;
          const totalPages = Math.ceil(totalItems / limit);

          // For each document, get its latest version
          return pipe(
            Effect.all(
              docRows.map((docRow) =>
                pipe(
                  Effect.tryPromise({
                    try: () =>
                      db.query.documentVersions.findFirst({
                        where: eq(documentVersions.documentId, docRow.id),
                        orderBy: [desc(documentVersions.versionNumber)],
                      }),
                    catch: () =>
                      new DocumentConstraintError({
                        message: "Database error",
                      }),
                  }),
                  Effect.map((versionRow) => {
                    const document = DocumentMapper.toDomain(docRow);
                    const latestVersion = versionRow
                      ? Option.some(DocumentVersionMapper.toDomain(versionRow))
                      : Option.none();

                    return {
                      document,
                      latestVersion,
                    } as DocumentWithVersion;
                  })
                )
              )
            ),
            Effect.map((docsWithVersions) => ({
              data: docsWithVersions,
              meta: {
                page,
                limit,
                totalItems,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
              },
            }))
          );
        })
      );

    /**
     * List all documents with pagination
     */
    const listAll: DocumentRepository["listAll"] = (pagination) =>
      pipe(
        Effect.all({
          // Get total count
          count: pipe(
            Effect.tryPromise({
              try: () => db.select({ count: drizzleCount() }).from(documents),
              catch: () =>
                new DocumentInfrastructureError({
                  message: "Database connection error",
                }),
            }),
            Effect.map(([countResult]) => countResult?.count || 0)
          ),
          // Get paginated documents
          docRows: Effect.tryPromise({
            try: () => {
              const { page, limit } = pagination;
              const offset = (page - 1) * limit;
              return db.query.documents.findMany({
                orderBy: [desc(documents.createdAt)],
                limit,
                offset,
              });
            },
            catch: () =>
              new DocumentInfrastructureError({
                message: "Database connection error",
              }),
          }),
        }),
        Effect.flatMap(({ count: totalItems, docRows }) => {
          const { page, limit } = pagination;
          const totalPages = Math.ceil(totalItems / limit);

          // For each document, get its latest version
          return pipe(
            Effect.all(
              docRows.map((docRow) =>
                pipe(
                  Effect.tryPromise({
                    try: () =>
                      db.query.documentVersions.findFirst({
                        where: eq(documentVersions.documentId, docRow.id),
                        orderBy: [desc(documentVersions.versionNumber)],
                      }),
                    catch: () =>
                      new DocumentConstraintError({
                        message: "Database error",
                      }),
                  }),
                  Effect.map((versionRow) => {
                    const document = DocumentMapper.toDomain(docRow);
                    const latestVersion = versionRow
                      ? Option.some(DocumentVersionMapper.toDomain(versionRow))
                      : Option.none();

                    return {
                      document,
                      latestVersion,
                    } as DocumentWithVersion;
                  })
                )
              )
            ),
            Effect.map((docsWithVersions) => ({
              data: docsWithVersions,
              meta: {
                page,
                limit,
                totalItems,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
              },
            }))
          );
        })
      );

    /**
     * Search documents by query
     */
    const search: DocumentRepository["search"] = (query, pagination) =>
      pipe(
        Effect.sync(() => {
          const { page, limit } = pagination;
          const offset = (page - 1) * limit;
          const searchPattern = `%${query}%`;
          return { page, limit, offset, searchPattern };
        }),
        Effect.flatMap(({ page, limit, offset, searchPattern }) =>
          Effect.all({
            // Get total count
            count: pipe(
              Effect.tryPromise({
                try: () =>
                  db
                    .select({ count: drizzleCount() })
                    .from(documents)
                    .where(
                      or(
                        like(documents.filename, searchPattern),
                        like(documents.originalName, searchPattern)
                      )
                    ),
                catch: () =>
                  new DocumentInfrastructureError({
                    message: "Database connection error",
                  }),
              }),
              Effect.map(([countResult]) => countResult?.count || 0)
            ),
            // Get matching documents
            docRows: Effect.tryPromise({
              try: () =>
                db.query.documents.findMany({
                  where: or(
                    like(documents.filename, searchPattern),
                    like(documents.originalName, searchPattern)
                  ),
                  orderBy: [desc(documents.updatedAt)],
                  limit,
                  offset,
                }),
              catch: () =>
                new DocumentInfrastructureError({
                  message: "Database connection error",
                }),
            }),
          }).pipe(
            Effect.map(({ count: totalItems, docRows }) => ({
              totalItems,
              totalPages: Math.ceil(totalItems / limit),
              page,
              limit,
              docRows,
            }))
          )
        ),
        Effect.flatMap(({ totalItems, totalPages, page, limit, docRows }) =>
          pipe(
            // Load full aggregates for search results
            Effect.all(
              docRows.map((docRow) => findById(docRow.id as DocumentId))
            ),
            Effect.map((fullDocs) => {
              // Filter out None values
              const docs = fullDocs.flatMap((opt) =>
                Option.isSome(opt) ? [opt.value] : []
              );

              return {
                data: docs,
                meta: {
                  page,
                  limit,
                  totalItems,
                  totalPages,
                  hasNextPage: page < totalPages,
                  hasPreviousPage: page > 1,
                },
              };
            })
          )
        )
      );

    /**
     * Delete document (cascades to all versions)
     */
    const deleteDoc: DocumentRepository["delete"] = (id) =>
      pipe(
        Effect.tryPromise({
          try: () => db.delete(documents).where(eq(documents.id, id)),
          catch: () =>
            new DocumentInfrastructureError({
              message: "Database connection error",
            }),
        }),
        Effect.flatMap((result) => {
          if (!(result as any).changes && !(result as any).rowCount) {
            return Effect.fail(
              new DocumentNotFoundError({
                documentId: id,
                message: "Document not found",
              })
            );
          }
          return Effect.succeed(undefined);
        })
      );

    /**
     * Add audit log entry
     */
    const addAudit: DocumentRepository["addAudit"] = (
      documentId,
      action,
      performedBy,
      details
    ) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            db.insert(documentAudit).values({
              documentId,
              action,
              performedBy,
              details: Option.getOrNull(details) || "",
            }),
          catch: () =>
            new DocumentInfrastructureError({
              message: "Database connection error",
            }),
        }),
        Effect.asVoid
      );

    return {
      save,
      findById,
      findByChecksum,
      findByContentRef,
      listByUser,
      listAll,
      search,
      delete: deleteDoc,
      addAudit,
    } satisfies DocumentRepository;
  })
);
