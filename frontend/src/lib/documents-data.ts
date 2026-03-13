import { type StatusType } from "@/components/shared/StatusBadge";

export type DocumentType = "fatura" | "recibo" | "nota-credito" | "nota-debito" | "extrato" | "outro";

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
}

export const documentTypeLabels: Record<DocumentType, string> = {
  fatura: "Fatura",
  recibo: "Recibo",
  "nota-credito": "Nota de Crédito",
  "nota-debito": "Nota de Débito",
  extrato: "Extrato",
  outro: "Outro",
};

// ---- DATA ----
// Documents are fetched from the API — no mock data needed.

export const mockDocuments: DocumentRecord[] = [];
