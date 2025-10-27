import { Schema as S } from "effect";
import {
  Document,
  DocumentVersion,
  CreateDocumentPayload,
  CreateDocumentVersionPayload,
  UpdateDocumentPayload,
  DocumentWithVersion,
} from "./entity";

/**
 * Runtime validators for Document domain
 */

export const validateDocument = (input: unknown) =>
  S.decodeUnknown(Document)(input);

export const validateDocumentVersion = (input: unknown) =>
  S.decodeUnknown(DocumentVersion)(input);

export const validateCreateDocumentPayload = (input: unknown) =>
  S.decodeUnknown(CreateDocumentPayload)(input);

export const validateCreateDocumentVersionPayload = (input: unknown) =>
  S.decodeUnknown(CreateDocumentVersionPayload)(input);

export const validateUpdateDocumentPayload = (input: unknown) =>
  S.decodeUnknown(UpdateDocumentPayload)(input);

export const validateDocumentWithVersion = (input: unknown) =>
  S.decodeUnknown(DocumentWithVersion)(input);
