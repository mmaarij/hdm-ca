import { Schema as S } from "effect";
import { v4 as uuidv4 } from "uuid";

/**
 * Shared UUID Schema 
 * 
 * Branded UUID base used for all domain entity identifiers.

 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Uuid = S.String.pipe(
  S.filter((value) => UUID_RE.test(value), { message: () => "Invalid UUID" }),
  S.brand("Uuid")
);
export type Uuid = S.Schema.Type<typeof Uuid>;

/**
 * Factory for creating branded UUID schemas for specific domain entities.
 *
 * Prevents cross-usage between different ID types (e.g., UserId ≠ DocumentId).
 */
const makeIdSchema = <const Brand extends string>(brand: Brand) =>
  Uuid.pipe(S.brand(brand));

// --------------------
// Domain Entity IDs
// --------------------
export const DocumentId = makeIdSchema("DocumentId");
export type DocumentId = S.Schema.Type<typeof DocumentId>;

export const DocumentVersionId = makeIdSchema("DocumentVersionId");
export type DocumentVersionId = S.Schema.Type<typeof DocumentVersionId>;

export const UserId = makeIdSchema("UserId");
export type UserId = S.Schema.Type<typeof UserId>;

export const DownloadTokenId = makeIdSchema("DownloadTokenId");
export type DownloadTokenId = S.Schema.Type<typeof DownloadTokenId>;

export const WorkspaceId = makeIdSchema("WorkspaceId");
export type WorkspaceId = S.Schema.Type<typeof WorkspaceId>;

export const AccessPolicyId = makeIdSchema("AccessPolicyId");
export type AccessPolicyId = S.Schema.Type<typeof AccessPolicyId>;

// --------------------
// String to UUID Transformers (for DTOs)
// --------------------
/**
 * Transforms string input to branded UserId
 * Use in DTOs to accept string and validate/brand as UserId
 */
export const StringToUserId = UserId;
export const StringToDocumentId = DocumentId;
export const StringToDocumentVersionId = DocumentVersionId;
export const StringToDownloadTokenId = DownloadTokenId;
export const StringToWorkspaceId = WorkspaceId;
export const StringToAccessPolicyId = AccessPolicyId;

// Generic alias for any UUID
export const StringToUUID = Uuid;

/**
 * Safe ID constructors
 *
 * Decode unknown inputs (from HTTP requests, database rows, etc.)
 * into typed, validated domain IDs.
 *
 * These ensure the domain never receives invalid or cross-typed IDs.
 */
export const makeDocumentId = (input: unknown) =>
  S.decodeUnknown(DocumentId)(input);
export const makeDocumentVersionId = (input: unknown) =>
  S.decodeUnknown(DocumentVersionId)(input);
export const makeUserId = (input: unknown) => S.decodeUnknown(UserId)(input);
export const makeDownloadTokenId = (input: unknown) =>
  S.decodeUnknown(DownloadTokenId)(input);
export const makeWorkspaceId = (input: unknown) =>
  S.decodeUnknown(WorkspaceId)(input);
export const makeAccessPolicyId = (input: unknown) =>
  S.decodeUnknown(AccessPolicyId)(input);

/**
 * Sync versions of the same constructors.
 * Use when the input is already guaranteed to be trusted and valid.
 */
export const makeDocumentIdSync = (input: unknown) =>
  S.decodeUnknownSync(DocumentId)(input);
export const makeDocumentVersionIdSync = (input: unknown) =>
  S.decodeUnknownSync(DocumentVersionId)(input);
export const makeUserIdSync = (input: unknown) =>
  S.decodeUnknownSync(UserId)(input);
export const makeDownloadTokenIdSync = (input: unknown) =>
  S.decodeUnknownSync(DownloadTokenId)(input);
export const makeWorkspaceIdSync = (input: unknown) =>
  S.decodeUnknownSync(WorkspaceId)(input);
export const makeAccessPolicyIdSync = (input: unknown) =>
  S.decodeUnknownSync(AccessPolicyId)(input);

/**
 * UUID Generation Helpers
 *
 * Generate new branded UUIDs for entity creation.
 * These wrap uuidv4() with proper type branding to avoid 'as any' casts.
 */
export const UuidGenerators = {
  documentId: (): DocumentId => uuidv4() as DocumentId,
  documentVersionId: (): DocumentVersionId => uuidv4() as DocumentVersionId,
  userId: (): UserId => uuidv4() as UserId,
  downloadTokenId: (): DownloadTokenId => uuidv4() as DownloadTokenId,
  workspaceId: (): WorkspaceId => uuidv4() as WorkspaceId,
  accessPolicyId: (): AccessPolicyId => uuidv4() as AccessPolicyId,
  uuid: (): Uuid => uuidv4() as Uuid,
} as const;
