import { Worker } from "bullmq";
import type { createRepositorySet } from "@platform/database";

export interface DocumentProcessorDeps {
  redisUrl: string;
  repos: ReturnType<typeof createRepositorySet>;
}

export function startDocumentWorker(deps: DocumentProcessorDeps) {
  console.log("[document-processor] Starting document worker...");

  const worker = new Worker(
    "document.process",
    async (job) => {
      const { tenantId, documentId } = job.data as { tenantId: string; documentId: string };
      console.log(`[document-processor] Processing document ${documentId} for tenant ${tenantId}`);

      const doc = await deps.repos.documents.findById(documentId);
      if (!doc) {
        throw new Error(`Document not found: ${documentId}`);
      }

      await deps.repos.documents.markProcessing(documentId);

      // Skeleton behaviour: mark as processed with dummy text
      const dummyText = `Dummy extracted text for document ${documentId} of kind ${doc.kind}.`;
      await deps.repos.documents.markProcessed({
        id: documentId,
        rawText: dummyText,
        parseMethod: "plain-text",
      });

      console.log(`[document-processor] Successfully processed document ${documentId}`);
    },
    {
      connection: { url: deps.redisUrl },
    }
  );

  return worker;
}
