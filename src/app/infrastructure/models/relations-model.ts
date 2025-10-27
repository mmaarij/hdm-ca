import { relations } from "drizzle-orm";
import { users } from "./users-model";
import { documents } from "./documents-model";
import { documentVersions } from "./document-versions-model";
import { documentMetadata } from "./metadata-model";
import { documentPermissions } from "./permission-model";
import { downloadTokens } from "./download-tokens-model";
import { documentAudit } from "./document-audit-model";

/**
 * User relations
 */
export const usersRelations = relations(users, ({ many }) => ({
  uploadedDocuments: many(documents, { relationName: "uploadedBy" }),
  uploadedVersions: many(documentVersions, { relationName: "uploadedBy" }),
  permissions: many(documentPermissions, { relationName: "userId" }),
  grantedPermissions: many(documentPermissions, { relationName: "grantedBy" }),
  downloadTokens: many(downloadTokens, { relationName: "createdBy" }),
  auditLogs: many(documentAudit, { relationName: "performedBy" }),
}));

/**
 * Document relations
 */
export const documentsRelations = relations(documents, ({ one, many }) => ({
  uploader: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
    relationName: "uploadedBy",
  }),
  versions: many(documentVersions),
  metadata: many(documentMetadata),
  permissions: many(documentPermissions),
  downloadTokens: many(downloadTokens),
  auditLogs: many(documentAudit),
}));

/**
 * Document version relations
 */
export const documentVersionsRelations = relations(
  documentVersions,
  ({ one }) => ({
    document: one(documents, {
      fields: [documentVersions.documentId],
      references: [documents.id],
    }),
    uploader: one(users, {
      fields: [documentVersions.uploadedBy],
      references: [users.id],
      relationName: "uploadedBy",
    }),
  })
);

/**
 * Document metadata relations
 */
export const documentMetadataRelations = relations(
  documentMetadata,
  ({ one }) => ({
    document: one(documents, {
      fields: [documentMetadata.documentId],
      references: [documents.id],
    }),
  })
);

/**
 * Document permission relations
 */
export const documentPermissionsRelations = relations(
  documentPermissions,
  ({ one }) => ({
    document: one(documents, {
      fields: [documentPermissions.documentId],
      references: [documents.id],
    }),
    user: one(users, {
      fields: [documentPermissions.userId],
      references: [users.id],
      relationName: "userId",
    }),
    grantor: one(users, {
      fields: [documentPermissions.grantedBy],
      references: [users.id],
      relationName: "grantedBy",
    }),
  })
);

/**
 * Download token relations
 */
export const downloadTokensRelations = relations(downloadTokens, ({ one }) => ({
  document: one(documents, {
    fields: [downloadTokens.documentId],
    references: [documents.id],
  }),
  version: one(documentVersions, {
    fields: [downloadTokens.versionId],
    references: [documentVersions.id],
  }),
  creator: one(users, {
    fields: [downloadTokens.createdBy],
    references: [users.id],
    relationName: "createdBy",
  }),
}));

/**
 * Document audit relations
 */
export const documentAuditRelations = relations(documentAudit, ({ one }) => ({
  document: one(documents, {
    fields: [documentAudit.documentId],
    references: [documents.id],
  }),
  performer: one(users, {
    fields: [documentAudit.performedBy],
    references: [users.id],
    relationName: "performedBy",
  }),
}));
