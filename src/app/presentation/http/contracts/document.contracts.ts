/**
 * Document Contracts - Type-safe API contracts using oRPC
 *
 * Defines the contract for all document routes using Effect schemas from the application layer.
 * These contracts provide full type safety from client to server without code duplication.
 */

import { oc } from "@orpc/contract";
import { Schema as S } from "effect";
import { effectSchema } from "../utils/effect-schema-adapter";

// Import existing schemas from application layer
import {
  UploadDocumentInput,
  GetDocumentInput,
  GetDocumentVersionInput,
  ListDocumentsInput,
  ListAllDocumentsInput,
  SearchDocumentsInput,
  DeleteDocumentInput,
} from "../../../application/dtos/document/request.dto";

import {
  UploadDocumentResponse,
  DocumentWithVersionResponse,
  DocumentVersionResponse,
  PaginatedDocumentsResponseSchema,
  SearchDocumentsResponseSchema,
} from "../../../application/dtos/document/response.dto";

/**
 * Document router contract
 * All routes are defined with input/output schemas for full type safety
 */
export const documentContract = {
  /**
   * POST /
   * Upload a new document or create a new version of an existing document
   */
  upload: oc
    .input(effectSchema(UploadDocumentInput.pipe(S.omit("uploadedBy"))))
    .output(effectSchema(UploadDocumentResponse))
    .route({
      method: "POST",
      path: "/",
    }),

  /**
   * GET /:documentId
   * Get a document by ID with its latest version
   */
  get: oc
    .input(effectSchema(GetDocumentInput.pipe(S.omit("userId"))))
    .output(effectSchema(DocumentWithVersionResponse))
    .route({
      method: "GET",
      path: "/:documentId",
    }),

  /**
   * GET /:documentId/versions/:versionId
   * Get a specific version of a document
   */
  getVersion: oc
    .input(effectSchema(GetDocumentVersionInput.pipe(S.omit("userId"))))
    .output(effectSchema(DocumentVersionResponse))
    .route({
      method: "GET",
      path: "/:documentId/versions/:versionId",
    }),

  /**
   * GET /:documentId/versions
   * List all versions of a document
   */
  listVersions: oc
    .input(
      effectSchema(
        S.Struct({
          documentId: S.String,
        })
      )
    )
    .output(effectSchema(S.Array(DocumentVersionResponse)))
    .route({
      method: "GET",
      path: "/:documentId/versions",
    }),

  /**
   * GET /
   * List documents accessible to the current user
   */
  list: oc
    .input(effectSchema(ListDocumentsInput.pipe(S.omit("userId"))))
    .output(effectSchema(PaginatedDocumentsResponseSchema))
    .route({
      method: "GET",
      path: "/",
    }),

  /**
   * GET /admin/all
   * List all documents (admin only)
   */
  listAll: oc
    .input(effectSchema(ListAllDocumentsInput.pipe(S.omit("userId"))))
    .output(effectSchema(PaginatedDocumentsResponseSchema))
    .route({
      method: "GET",
      path: "/admin/all",
    }),

  /**
   * GET /search
   * Search documents by query
   */
  search: oc
    .input(effectSchema(SearchDocumentsInput.pipe(S.omit("userId"))))
    .output(effectSchema(SearchDocumentsResponseSchema))
    .route({
      method: "GET",
      path: "/search",
    }),

  /**
   * DELETE /:documentId
   * Delete a document and all its versions
   */
  delete: oc
    .input(effectSchema(DeleteDocumentInput.pipe(S.omit("userId"))))
    .output(
      effectSchema(
        S.Struct({
          message: S.String,
        })
      )
    )
    .route({
      method: "DELETE",
      path: "/:documentId",
    }),
} as const;

/**
 * Export types inferred from the contract for use in client code
 */
export type DocumentContract = typeof documentContract;
