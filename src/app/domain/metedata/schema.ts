import { Schema as S } from "effect";
import {
  DocumentMetadata,
  CreateMetadataPayload,
  UpdateMetadataPayload,
} from "./entity";

/**
 * Runtime validators for Metadata domain
 */

export const validateMetadata = (input: unknown) =>
  S.decodeUnknown(DocumentMetadata)(input);

export const validateCreateMetadataPayload = (input: unknown) =>
  S.decodeUnknown(CreateMetadataPayload)(input);

export const validateUpdateMetadataPayload = (input: unknown) =>
  S.decodeUnknown(UpdateMetadataPayload)(input);
