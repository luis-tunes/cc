import { type StatusType } from "@/components/shared/StatusBadge";

export type DocumentType = "fatura" | "fatura-fornecedor" | "fatura-recibo" | "fatura-simplificada" | "fatura-proforma" | "recibo" | "nota-credito" | "nota-debito" | "guia-remessa" | "extrato" | "orcamento" | "outro";

export interface DocumentRecord {
  id: string;
  fileName: string;
  fileType: string;
  documentType: DocumentType;
  supplier?: string;
  customer?: string;
  nif?: string;
  total?: number;
  vat?: number;
  date?: string;
  extractionConfidence: number;
  classificationStatus: StatusType;
  reconciliationStatus: StatusType;
  source: "upload" | "email" | "api";
  uploadedAt: string;
  needsReview: boolean;
  extractedFields?: ExtractedField[];
  lineItems?: LineItem[];
  notes?: string;
  fieldConfidence?: Record<string, number>;
  validationWarnings?: string[];
}

export interface ExtractedField {
  label: string;
  sourceValue: string;
  interpretedValue: string;
  confidence: number;
  confirmed: boolean;
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  total: number;
}

export interface UploadingFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "processing" | "extracted" | "failed";
  error?: string;
  previewUrl?: string;
}

export const documentTypeLabels: Record<DocumentType, string> = {
  fatura: "Fatura",
  "fatura-fornecedor": "Fatura de Fornecedor",
  "fatura-recibo": "Fatura-Recibo",
  "fatura-simplificada": "Fatura Simplificada",
  "fatura-proforma": "Fatura Pro-forma",
  recibo: "Recibo",
  "nota-credito": "Nota de Crédito",
  "nota-debito": "Nota de Débito",
  "guia-remessa": "Guia de Remessa",
  extrato: "Extrato",
  orcamento: "Orçamento",
  outro: "Outro",
};

// ---- DATA ----
// Documents are fetched from the API — no mock data needed.

export const mockDocuments: DocumentRecord[] = [];
