/**
 * Document Routes - Type-safe with oRPC contracts
 *
 * HTTP endpoints for document operations using contract-first development.
 * All routes are fully type-safe from input validation to response, using
 * schemas defined in the application layer.
 */

import { Elysia } from "elysia";
import { Effect, pipe } from "effect";
import type { Runtime } from "effect";
import { DocumentWorkflowTag } from "../../../application/workflows/document-workflow";
import { documentContract } from "../contracts/document.contracts";
import {
  registerTypedRoute,
  type ContractHandler,
} from "../utils/typed-routes";
import type { DocumentId, UserId } from "../../../domain/refined/uuid";

/**
 * Create document routes with full type safety
 */
export const createDocumentRoutes = <R>(runtime: Runtime.Runtime<R>) => {
  const app = new Elysia({ prefix: "/documents" });

  // Upload document handler - inferred types from contract
  const uploadHandler: ContractHandler<any, any, any> = (input, auth) =>
    pipe(
      DocumentWorkflowTag,
      Effect.flatMap((workflow) =>
        workflow.uploadDocument({
          ...input,
          uploadedBy: auth.userId,
        })
      )
    ) as any;

  // Get document handler - inferred types from contract
  const getHandler: ContractHandler<any, any, any> = (input, auth) =>
    pipe(
      DocumentWorkflowTag,
      Effect.flatMap((workflow) =>
        workflow.getDocument({
          ...input,
          userId: auth.userId,
        })
      )
    ) as any;

  // Get document version handler - inferred types from contract
  const getVersionHandler: ContractHandler<any, any, any> = (input, auth) =>
    pipe(
      DocumentWorkflowTag,
      Effect.flatMap((workflow) =>
        workflow.getDocumentVersion({
          ...input,
          userId: auth.userId,
        })
      )
    ) as any;

  // List document versions handler - inferred types from contract
  const listVersionsHandler: ContractHandler<any, any, any> = (input, auth) =>
    pipe(
      DocumentWorkflowTag,
      Effect.flatMap((workflow) =>
        workflow.listDocumentVersions(
          input.documentId as DocumentId,
          auth.userId as UserId
        )
      )
    ) as any;

  // List documents handler - inferred types from contract
  const listHandler: ContractHandler<any, any, any> = (input, auth) =>
    pipe(
      DocumentWorkflowTag,
      Effect.flatMap((workflow) =>
        workflow.listDocuments({
          ...input,
          userId: auth.userId,
        })
      )
    ) as any;

  // List all documents handler (admin) - inferred types from contract
  const listAllHandler: ContractHandler<any, any, any> = (input, auth) =>
    pipe(
      DocumentWorkflowTag,
      Effect.flatMap((workflow) =>
        workflow.listAllDocuments({
          ...input,
          userId: auth.userId,
        })
      )
    ) as any;

  // Search documents handler - inferred types from contract
  const searchHandler: ContractHandler<any, any, any> = (input, auth) =>
    pipe(
      DocumentWorkflowTag,
      Effect.flatMap((workflow) =>
        workflow.searchDocuments({
          ...input,
          userId: auth.userId,
        })
      )
    ) as any;

  // Delete document handler - inferred types from contract
  const deleteHandler: ContractHandler<any, any, any> = (input, auth) =>
    pipe(
      DocumentWorkflowTag,
      Effect.flatMap((workflow) =>
        workflow.deleteDocument({
          ...input,
          userId: auth.userId,
        })
      ),
      Effect.map(() => ({ message: "Document deleted successfully" }))
    ) as any;

  // Register all routes with their contracts - fully type-safe
  return app
    .use(registerTypedRoute(documentContract.upload, runtime, uploadHandler))
    .use(registerTypedRoute(documentContract.get, runtime, getHandler))
    .use(
      registerTypedRoute(
        documentContract.getVersion,
        runtime,
        getVersionHandler
      )
    )
    .use(
      registerTypedRoute(
        documentContract.listVersions,
        runtime,
        listVersionsHandler
      )
    )
    .use(registerTypedRoute(documentContract.list, runtime, listHandler))
    .use(registerTypedRoute(documentContract.listAll, runtime, listAllHandler))
    .use(registerTypedRoute(documentContract.search, runtime, searchHandler))
    .use(registerTypedRoute(documentContract.delete, runtime, deleteHandler));
};
