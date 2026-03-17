import { describe, it, expect } from "vitest";
import { toDocumentRecord } from "./use-documents";
import type { Document } from "@/lib/api";

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: 1,
    supplier_nif: "123456789",
    client_nif: "987654321",
    total: 150.5,
    vat: 34.62,
    date: "2024-06-01",
    type: "fatura",
    filename: "invoice.pdf",
    raw_text: "parsed text here",
    status: "pendente",
    paperless_id: 10,
    created_at: "2024-06-01T10:00:00Z",
    snc_account: null,
    classification_source: null,
    ...overrides,
  };
}

describe("toDocumentRecord", () => {
  it("maps basic fields correctly", () => {
    const result = toDocumentRecord(makeDoc());
    expect(result.id).toBe("1");
    expect(result.fileName).toBe("invoice.pdf");
    expect(result.fileType).toBe("pdf");
    expect(result.documentType).toBe("fatura");
    expect(result.supplier).toBe("123456789");
    expect(result.total).toBe(150.5);
    expect(result.vat).toBe(34.62);
    expect(result.date).toBe("2024-06-01");
    expect(result.source).toBe("upload");
  });

  it("maps status correctly", () => {
    expect(toDocumentRecord(makeDoc({ status: "pendente" })).classificationStatus).toBe("pendente");
    expect(toDocumentRecord(makeDoc({ status: "a processar" })).classificationStatus).toBe("pendente");
    expect(toDocumentRecord(makeDoc({ status: "classificado" })).classificationStatus).toBe("classificado");
    expect(toDocumentRecord(makeDoc({ status: "revisto" })).classificationStatus).toBe("revisto");
    expect(toDocumentRecord(makeDoc({ status: "erro" })).classificationStatus).toBe("rejeitado");
    expect(toDocumentRecord(makeDoc({ status: "arquivado" })).classificationStatus).toBe("arquivado");
  });

  it("defaults unknown status to pendente", () => {
    expect(toDocumentRecord(makeDoc({ status: "desconhecido" })).classificationStatus).toBe("pendente");
  });

  it("defaults unknown type to outro", () => {
    expect(toDocumentRecord(makeDoc({ type: "random" })).documentType).toBe("outro");
  });

  it("maps known document types", () => {
    expect(toDocumentRecord(makeDoc({ type: "recibo" })).documentType).toBe("recibo");
    expect(toDocumentRecord(makeDoc({ type: "nota-credito" })).documentType).toBe("nota-credito");
    expect(toDocumentRecord(makeDoc({ type: "extrato" })).documentType).toBe("extrato");
  });

  it("generates filename when missing", () => {
    const result = toDocumentRecord(makeDoc({ filename: null }));
    expect(result.fileName).toBe("documento-1.pdf");
  });

  it("detects image file types", () => {
    expect(toDocumentRecord(makeDoc({ filename: "scan.jpg" })).fileType).toBe("image");
    expect(toDocumentRecord(makeDoc({ filename: "photo.png" })).fileType).toBe("image");
    expect(toDocumentRecord(makeDoc({ filename: "doc.tiff" })).fileType).toBe("image");
  });

  it("detects pdf file type", () => {
    expect(toDocumentRecord(makeDoc({ filename: "file.pdf" })).fileType).toBe("pdf");
  });

  it("sets extractionConfidence based on raw_text", () => {
    expect(toDocumentRecord(makeDoc({ raw_text: "some text" })).extractionConfidence).toBe(85);
    expect(toDocumentRecord(makeDoc({ raw_text: null })).extractionConfidence).toBe(50);
  });

  it("sets needsReview for pending statuses", () => {
    expect(toDocumentRecord(makeDoc({ status: "pendente" })).needsReview).toBe(true);
    expect(toDocumentRecord(makeDoc({ status: "a processar" })).needsReview).toBe(true);
    expect(toDocumentRecord(makeDoc({ status: "extraído" })).needsReview).toBe(true);
    expect(toDocumentRecord(makeDoc({ status: "classificado" })).needsReview).toBe(false);
    expect(toDocumentRecord(makeDoc({ status: "revisto" })).needsReview).toBe(false);
  });

  it("omits supplier when nif is empty", () => {
    const result = toDocumentRecord(makeDoc({ supplier_nif: "" }));
    expect(result.supplier).toBeUndefined();
    expect(result.nif).toBeUndefined();
  });

  it("uses created_at for uploadedAt", () => {
    const result = toDocumentRecord(makeDoc({ created_at: "2025-03-17T12:00:00Z" }));
    expect(result.uploadedAt).toBe("2025-03-17T12:00:00Z");
  });
});
