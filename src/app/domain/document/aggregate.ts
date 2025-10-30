import {
  Document,
  DocumentVersion,
  CreateDocumentVersionPayload,
} from "./entity";

/**
 * DocumentAggregate
 *
 * Aggregate root for a Document and its versions. Prepare version payloads
 * with the aggregate, and attach persisted versions returned by the
 * repository. The aggregate itself does not persist data.
 */
export class DocumentAggregate {
  private constructor(
    private readonly document: Document,
    private readonly versions: readonly DocumentVersion[]
  ) {}

  /** Create an aggregate from a document and optional versions list */
  static from(
    document: Document,
    versions: readonly DocumentVersion[] = []
  ): DocumentAggregate {
    return new DocumentAggregate(document, versions.slice());
  }

  // Read-only accessors
  get root(): Document {
    return this.document;
  }

  get allVersions(): readonly DocumentVersion[] {
    return this.versions.slice();
  }

  get latestVersion(): DocumentVersion | undefined {
    if (!this.versions || this.versions.length === 0) return undefined;
    return this.versions.reduce((a, b) =>
      a.versionNumber >= b.versionNumber ? a : b
    );
  }

  /**
   * Build a CreateDocumentVersionPayload with the next version number.
   * Does not persist; pass the payload to the repository and then call
   * attachVersion with the persisted result.
   */
  prepareAddVersion(
    payload: Omit<
      CreateDocumentVersionPayload,
      "documentId" | "versionNumber"
    > &
      Partial<Pick<CreateDocumentVersionPayload, "id">>
  ): CreateDocumentVersionPayload {
    const max = this.versions.reduce(
      (acc, v) => Math.max(acc, (v.versionNumber as unknown as number) || 0),
      0
    );

    const next = (max || 0) + 1;

    return {
      id: payload.id,
      documentId: this.document.id,
      filename: payload.filename,
      originalName: payload.originalName,
      mimeType: payload.mimeType,
      size: payload.size,
      path: payload.path,
      versionNumber: next as unknown as any,
      uploadedBy: payload.uploadedBy,
    } as CreateDocumentVersionPayload;
  }

  /**
   * Attach a persisted version to the aggregate and return a new
   * aggregate instance.
   */
  attachVersion(version: DocumentVersion): DocumentAggregate {
    const exists = this.versions.some((v) => v.id === version.id);
    if (exists) return this;
    return new DocumentAggregate(this.document, [...this.versions, version]);
  }

  /**
   * Return a new aggregate without the specified version id. This only
   * updates the in-memory aggregate; persistent deletion must be done via
   * the repository.
   */
  removeVersionById(versionId: string): DocumentAggregate {
    const filtered = this.versions.filter((v) => v.id !== versionId);
    return new DocumentAggregate(this.document, filtered);
  }

  /** Convert to a plain object for tests or persistence helpers */
  toObject(): { document: Document; versions: readonly DocumentVersion[] } {
    return { document: this.document, versions: this.allVersions };
  }
}

export type { Document, DocumentVersion, CreateDocumentVersionPayload };
