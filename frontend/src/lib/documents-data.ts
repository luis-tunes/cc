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

// ---- MOCK DATA ----

export const mockDocuments: DocumentRecord[] = [
  {
    id: "doc-1",
    fileName: "fatura_abc_materiais_0847.pdf",
    fileType: "pdf",
    documentType: "fatura",
    supplier: "ABC Materiais, Lda.",
    nif: "509123456",
    total: 2450.0,
    vat: 563.5,
    date: "2024-03-05",
    extractionConfidence: 96,
    classificationStatus: "classificado",
    reconciliationStatus: "reconciliado",
    source: "upload",
    uploadedAt: "2024-03-06T09:14:00",
    needsReview: false,
    extractedFields: [
      { label: "Fornecedor", sourceValue: "ABC Materiais Lda", interpretedValue: "ABC Materiais, Lda.", confidence: 98, confirmed: true },
      { label: "NIF", sourceValue: "509123456", interpretedValue: "509123456", confidence: 100, confirmed: true },
      { label: "Total", sourceValue: "2.450,00 €", interpretedValue: "€2.450,00", confidence: 99, confirmed: true },
      { label: "IVA", sourceValue: "563,50 €", interpretedValue: "€563,50", confidence: 99, confirmed: true },
      { label: "Data", sourceValue: "05/03/2024", interpretedValue: "2024-03-05", confidence: 100, confirmed: true },
    ],
    lineItems: [
      { description: "Cimento Portland CEM II 42.5", quantity: 50, unitPrice: 12.5, vatRate: 23, total: 625.0 },
      { description: "Areia lavada (m³)", quantity: 10, unitPrice: 45.0, vatRate: 23, total: 450.0 },
      { description: "Blocos betão 20x20x40", quantity: 500, unitPrice: 2.75, vatRate: 23, total: 1375.0 },
    ],
  },
  {
    id: "doc-2",
    fileName: "recibo_cliente_silva_rc0231.pdf",
    fileType: "pdf",
    documentType: "recibo",
    customer: "Silva & Filhos, S.A.",
    nif: "501987654",
    total: 5200.0,
    vat: 1196.0,
    date: "2024-03-07",
    extractionConfidence: 92,
    classificationStatus: "classificado",
    reconciliationStatus: "reconciliado",
    source: "email",
    uploadedAt: "2024-03-07T11:30:00",
    needsReview: false,
  },
  {
    id: "doc-3",
    fileName: "fatura_utilities_edp_mar24.pdf",
    fileType: "pdf",
    documentType: "fatura",
    supplier: "EDP Comercial",
    nif: "503504564",
    total: 890.0,
    vat: 204.7,
    date: "2024-03-01",
    extractionConfidence: 68,
    classificationStatus: "pendente",
    reconciliationStatus: "pendente",
    source: "upload",
    uploadedAt: "2024-03-08T08:45:00",
    needsReview: true,
    extractedFields: [
      { label: "Fornecedor", sourceValue: "EDP Comercial SA", interpretedValue: "EDP Comercial", confidence: 85, confirmed: false },
      { label: "NIF", sourceValue: "503504564", interpretedValue: "503504564", confidence: 100, confirmed: true },
      { label: "Total", sourceValue: "890.00", interpretedValue: "€890,00", confidence: 75, confirmed: false },
      { label: "IVA", sourceValue: "ilegível", interpretedValue: "€204,70", confidence: 42, confirmed: false },
      { label: "Data", sourceValue: "01-03-2024", interpretedValue: "2024-03-01", confidence: 90, confirmed: false },
    ],
  },
  {
    id: "doc-4",
    fileName: "scan_despesa_0044.jpg",
    fileType: "jpg",
    documentType: "outro",
    total: 47.5,
    date: "2024-03-04",
    extractionConfidence: 34,
    classificationStatus: "pendente",
    reconciliationStatus: "pendente",
    source: "upload",
    uploadedAt: "2024-03-08T10:12:00",
    needsReview: true,
    extractedFields: [
      { label: "Fornecedor", sourceValue: "ilegível", interpretedValue: "—", confidence: 12, confirmed: false },
      { label: "Total", sourceValue: "47,50", interpretedValue: "€47,50", confidence: 60, confirmed: false },
      { label: "Data", sourceValue: "ilegível", interpretedValue: "2024-03-04", confidence: 25, confirmed: false },
    ],
  },
  {
    id: "doc-5",
    fileName: "nota_credito_fornecedor_xyz.pdf",
    fileType: "pdf",
    documentType: "nota-credito",
    supplier: "XYZ Serviços, Lda.",
    nif: "507654321",
    total: -320.0,
    vat: -73.6,
    date: "2024-03-02",
    extractionConfidence: 88,
    classificationStatus: "extraído",
    reconciliationStatus: "pendente",
    source: "api",
    uploadedAt: "2024-03-03T15:00:00",
    needsReview: false,
  },
  {
    id: "doc-6",
    fileName: "fatura_servicos_consultoria.pdf",
    fileType: "pdf",
    documentType: "fatura",
    supplier: "Consultoria Pro, S.A.",
    nif: "510111222",
    total: 3600.0,
    vat: 828.0,
    date: "2024-02-28",
    extractionConfidence: 94,
    classificationStatus: "revisto",
    reconciliationStatus: "reconciliado",
    source: "upload",
    uploadedAt: "2024-03-01T09:00:00",
    needsReview: false,
  },
  {
    id: "doc-7",
    fileName: "recibo_renda_escritorio.pdf",
    fileType: "pdf",
    documentType: "recibo",
    supplier: "Imobiliária Central",
    nif: "502333444",
    total: 1200.0,
    vat: 0,
    date: "2024-03-01",
    extractionConfidence: 91,
    classificationStatus: "classificado",
    reconciliationStatus: "pendente",
    source: "email",
    uploadedAt: "2024-03-02T10:15:00",
    needsReview: false,
  },
];
