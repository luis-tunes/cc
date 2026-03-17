import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchDocuments, type Document } from "@/lib/api";
import { type DocumentRecord, type DocumentType } from "@/lib/documents-data";

/**
 * Map a backend Document to the frontend DocumentRecord shape.
 */
export function toDocumentRecord(doc: Document): DocumentRecord {
  const typeMap: Record<string, DocumentType> = {
    fatura: "fatura",
    recibo: "recibo",
    "nota-credito": "nota-credito",
    "nota-debito": "nota-debito",
    extrato: "extrato",
  };

  const statusMap: Record<string, DocumentRecord["classificationStatus"]> = {
    pendente: "pendente",
    "a processar": "pendente",
    extraído: "extraído",
    classificado: "classificado",
    revisto: "revisto",
    erro: "rejeitado",
    arquivado: "arquivado",
  };

  const hasReconciliation = false; // TODO: backend should return this flag

  const fileName = doc.filename || `documento-${doc.id}.pdf`;
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const imageExts = new Set(["jpg", "jpeg", "png", "tiff", "tif"]);
  const fileType = imageExts.has(ext) ? "image" : "pdf";

  return {
    id: String(doc.id),
    fileName,
    fileType,
    documentType: typeMap[doc.type] || "outro",
    supplier: doc.supplier_nif || undefined,
    nif: doc.supplier_nif || undefined,
    total: doc.total || undefined,
    vat: doc.vat || undefined,
    date: doc.date || undefined,
    extractionConfidence: doc.raw_text ? 85 : 50,
    classificationStatus: statusMap[doc.status] || "pendente",
    reconciliationStatus: hasReconciliation ? "reconciliado" : "pendente",
    source: "upload",
    uploadedAt: doc.created_at || new Date().toISOString(),
    needsReview: ["pendente", "a processar", "extraído"].includes(doc.status),
  };
}

/**
 * Hook to fetch documents from the real API.
 * Returns DocumentRecord[] matching the frontend shape.
 */
export function useDocuments() {
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading, error } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const raw = await fetchDocuments();
      return raw.map(toDocumentRecord);
    },
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (!docs) return false;
      const hasPending = docs.some((d) =>
        ["pendente", "a processar"].includes(d.classificationStatus)
      );
      return hasPending ? 5000 : false;
    },
  });

  const refetch = () =>
    queryClient.invalidateQueries({ queryKey: ["documents"] });

  return { documents, isLoading, error, refetch };
}
