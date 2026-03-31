import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchDocuments, type Document } from "@/lib/api";
import { type DocumentRecord, type DocumentType } from "@/lib/documents-data";

function parseNotesMetadata(notes: string | null): Pick<DocumentRecord, "fieldConfidence" | "validationWarnings"> {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes);
    return {
      fieldConfidence: parsed._field_confidence ?? undefined,
      validationWarnings: parsed._validation_warnings ?? undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Map a backend Document to the frontend DocumentRecord shape.
 */
export function toDocumentRecord(doc: Document): DocumentRecord {
  const typeMap: Record<string, DocumentType> = {
    fatura: "fatura",
    "fatura-fornecedor": "fatura-fornecedor",
    "fatura-recibo": "fatura-recibo",
    "fatura-simplificada": "fatura-simplificada",
    "fatura-proforma": "fatura-proforma",
    recibo: "recibo",
    "nota-credito": "nota-credito",
    "nota-debito": "nota-debito",
    "guia-remessa": "guia-remessa",
    extrato: "extrato",
    orcamento: "orcamento",
  };

  const statusMap: Record<string, DocumentRecord["classificationStatus"]> = {
    pendente: "pendente",
    "pendente ocr": "pendente",
    "a processar": "pendente",
    extraído: "extraído",
    classificado: "classificado",
    revisto: "revisto",
    erro: "rejeitado",
    arquivado: "arquivado",
  };

  const hasReconciliation = !!doc.reconciliation_status;

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
    extractionConfidence: (() => {
      let score = 0;
      if (doc.raw_text && doc.raw_text.length > 50) score += 15;
      if (doc.total && doc.total > 0) score += 30;
      if (doc.vat && doc.vat > 0) score += 15;
      if (doc.supplier_nif && doc.supplier_nif !== "000000000" && doc.supplier_nif !== "") score += 15;
      if (doc.date) score += 10;
      if (doc.type && doc.type !== "outro") score += 5;
      if (doc.snc_account) score += 10;
      return Math.min(score, 100);
    })(),
    classificationStatus: statusMap[doc.status] || "pendente",
    reconciliationStatus: hasReconciliation ? "reconciliado" : "pendente",
    source: "upload",
    uploadedAt: doc.created_at || new Date().toISOString(),
    needsReview: ["pendente", "a processar", "extraído"].includes(doc.status),
    ...parseNotesMetadata(doc.notes),
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
