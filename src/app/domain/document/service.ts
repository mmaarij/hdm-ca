import { Effect, Option, Layer, Context } from "effect";
import { DocumentId } from "../refined/uuid";
import { DocumentRepository, DocumentRepositoryTag } from "./repository";
import { DocumentAggregate } from "./aggregate";
import { CreateDocumentVersionPayload, DocumentVersion } from "./entity";
import { DocumentNotFoundError, DocumentDomainError } from "./errors";

/**
 * DocumentService. This orchestrates aggregate + repository operations to
 * ensure DocumentVersion lifecycle is managed through the aggregate root.
 */
export interface DocumentService {
  readonly addVersion: (
    documentId: DocumentId,
    payload: Omit<
      CreateDocumentVersionPayload,
      "documentId" | "versionNumber"
    > &
      Partial<Pick<CreateDocumentVersionPayload, "id">>
  ) => Effect.Effect<DocumentVersion, DocumentDomainError>;
}

export const DocumentServiceTag = Context.GenericTag<DocumentService>(
  "@app/DocumentService"
);

/**
 * Live implementation of DocumentService that uses the repository from
 * context. This keeps orchestration logic in the domain so callers don't
 * manipulate versions directly.
 */
export const DocumentServiceLive = Layer.effect(
  DocumentServiceTag,
  Effect.gen(function* () {
    const repo = yield* DocumentRepositoryTag;

    const addVersion: DocumentService["addVersion"] = (documentId, payload) =>
      Effect.gen(function* () {
        // Load document
        const docOpt = yield* repo.findDocument(documentId);
        if (Option.isNone(docOpt)) {
          return yield* Effect.fail(
            new DocumentNotFoundError({
              documentId,
              message: "Document not found",
            })
          );
        }

        const document = docOpt.value;

        // Load existing versions
        const versions = yield* repo.listVersions(documentId);

        // Build aggregate and prepare payload
        const agg = DocumentAggregate.from(document, versions);
        const createPayload = agg.prepareAddVersion(payload as any);

        // Persist version
        const persisted = yield* repo.createVersion(createPayload);

        // Attach persisted version to aggregate (in-memory)
        const updated = agg.attachVersion(persisted);

        // Add audit entry (best-effort via repository)
        yield* repo.addAudit({
          documentId,
          action: "version_added",
          performedBy: persisted.uploadedBy,
          details: `version ${persisted.versionNumber} added`,
        } as any);

        // Return persisted version
        return persisted;
      });

    return { addVersion } satisfies DocumentService;
  })
);

export type { DocumentVersion, CreateDocumentVersionPayload };
