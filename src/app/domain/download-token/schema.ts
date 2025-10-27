import { Schema as S } from "effect";
import {
  DownloadToken,
  CreateDownloadTokenPayload,
  DownloadTokenWithDocument,
} from "./entity";

/**
 * Runtime validators for Download Token domain
 */

export const validateDownloadToken = (input: unknown) =>
  S.decodeUnknown(DownloadToken)(input);

export const validateCreateDownloadTokenPayload = (input: unknown) =>
  S.decodeUnknown(CreateDownloadTokenPayload)(input);

export const validateDownloadTokenWithDocument = (input: unknown) =>
  S.decodeUnknown(DownloadTokenWithDocument)(input);
