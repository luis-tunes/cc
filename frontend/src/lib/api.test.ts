/**
 * Tests for the API client layer.
 * Validates request construction, error handling, and query string building.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally before importing api module
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// No auth token in tests (token provider not set → header omitted)

// Must import after mocks are set
import {
  fetchDocuments,
  fetchDocument,
  patchDocument,
  fetchBankTransactions,
  fetchReconciliations,
  fetchDashboardSummary,
  fetchIngredients,
  fetchSuppliers,
  fetchProducts,
  fetchStockEvents,
  createStockEvent,
  createIngredient,
  createSupplier,
  deleteIngredient,
  deleteDocument,
  documentPreviewUrl,
  documentThumbnailUrl,
  downloadWithAuth,
  runReconciliation,
  patchReconciliation,
  fetchReconciliationSuggestions,
  uploadBankCSV,
  fetchMonthlyData,
  getExportCSVUrl,
  createCheckoutSession,
  fetchEntity,
  saveEntity,
  fetchBillingPlans,
  fetchBillingStatus,
  setTokenProvider,
  uploadDocument,
} from "@/lib/api";

function mockResponse(data: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function mockError(status: number, body = "") {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: "Error",
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(body),
  });
}

describe("API client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // ── Documents ──────────────────────────────────────────────────

  it("fetchDocuments sends correct URL without params", async () => {
    mockResponse([]);
    const result = await fetchDocuments();
    expect(result).toEqual([]);
    expect(mockFetch).toHaveBeenCalledWith("/api/documents", expect.any(Object));
  });

  it("fetchDocuments builds query string from params", async () => {
    mockResponse([]);
    await fetchDocuments({ status: "pendente", limit: 10, offset: 5 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("status=pendente");
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=5");
  });

  it("fetchDocuments excludes undefined params from query", async () => {
    mockResponse([]);
    await fetchDocuments({ status: "pendente" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("status=pendente");
    expect(url).not.toContain("limit");
    expect(url).not.toContain("offset");
  });

  it("fetchDocument calls correct endpoint", async () => {
    mockResponse({ id: 42, status: "pendente" });
    const doc = await fetchDocument(42);
    expect(doc.id).toBe(42);
    expect(mockFetch).toHaveBeenCalledWith("/api/documents/42", expect.any(Object));
  });

  it("patchDocument sends PATCH with body", async () => {
    mockResponse({ id: 1, status: "revisto" });
    await patchDocument(1, { status: "revisto" });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/documents/1");
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body)).toEqual({ status: "revisto" });
  });

  // ── Bank Transactions ──────────────────────────────────────────

  it("fetchBankTransactions builds date filters", async () => {
    mockResponse([]);
    await fetchBankTransactions({ date_from: "2025-01-01", date_to: "2025-12-31" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("date_from=2025-01-01");
    expect(url).toContain("date_to=2025-12-31");
  });

  // ── Reconciliation ─────────────────────────────────────────────

  it("fetchReconciliations calls /reconciliations", async () => {
    mockResponse([]);
    await fetchReconciliations();
    expect(mockFetch).toHaveBeenCalledWith("/api/reconciliations", expect.any(Object));
  });

  // ── Dashboard ──────────────────────────────────────────────────

  it("fetchDashboardSummary calls /dashboard/summary", async () => {
    const data = { documents: { count: 5, total: "100.00" }, bank_transactions: { count: 3, total: "200.00" } };
    mockResponse(data);
    const result = await fetchDashboardSummary();
    expect(result.documents.count).toBe(5);
  });

  // ── Inventory ──────────────────────────────────────────────────

  it("fetchIngredients with category filter", async () => {
    mockResponse([]);
    await fetchIngredients({ category: "cereais" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("category=cereais");
  });

  it("fetchIngredients with status_filter", async () => {
    mockResponse([]);
    await fetchIngredients({ status_filter: "baixo" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("status_filter=baixo");
  });

  it("fetchSuppliers calls /suppliers", async () => {
    mockResponse([]);
    await fetchSuppliers();
    expect(mockFetch).toHaveBeenCalledWith("/api/suppliers", expect.any(Object));
  });

  it("fetchProducts calls /products", async () => {
    mockResponse([]);
    await fetchProducts();
    expect(mockFetch).toHaveBeenCalledWith("/api/products", expect.any(Object));
  });

  it("fetchStockEvents with filters", async () => {
    mockResponse([]);
    await fetchStockEvents({ ingredient_id: 3, event_type: "entrada", limit: 50 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("ingredient_id=3");
    expect(url).toContain("event_type=entrada");
    expect(url).toContain("limit=50");
  });

  it("createStockEvent sends POST", async () => {
    mockResponse({ id: 1, type: "entrada", qty: 10 });
    await createStockEvent({ type: "entrada", ingredient_id: 1, qty: 10 });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/stock-events");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.type).toBe("entrada");
    expect(body.qty).toBe(10);
  });

  it("createIngredient sends POST with correct body", async () => {
    mockResponse({ id: 1, name: "Arroz" });
    await createIngredient({ name: "Arroz", unit: "kg" });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/ingredients");
    expect(opts.method).toBe("POST");
  });

  it("createSupplier sends POST", async () => {
    mockResponse({ id: 1, name: "Fornecedor A" });
    await createSupplier({ name: "Fornecedor A", nif: "123456789" });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/suppliers");
    expect(opts.method).toBe("POST");
  });

  it("deleteIngredient sends DELETE", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      statusText: "No Content",
      json: () => Promise.resolve(undefined),
      text: () => Promise.resolve(""),
    });
    await deleteIngredient(5);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/ingredients/5");
    expect(opts.method).toBe("DELETE");
  });

  // ── Billing ────────────────────────────────────────────────────

  it("fetchBillingPlans calls /billing/plans", async () => {
    mockResponse([{ id: "pro", name: "Pro" }]);
    const plans = await fetchBillingPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe("pro");
  });

  it("fetchBillingStatus calls /billing/status", async () => {
    mockResponse({ plan: "pro", status: "active" });
    const status = await fetchBillingStatus();
    expect(status.plan).toBe("pro");
  });

  // ── Error handling ─────────────────────────────────────────────

  it("throws on non-ok response", async () => {
    mockError(422, '{"detail":"name required"}');
    await expect(createIngredient({ unit: "kg" })).rejects.toThrow("API 422");
  });

  it("throws on 404", async () => {
    mockError(404, "Not Found");
    await expect(fetchDocument(999)).rejects.toThrow("API 404");
  });

  it("throws on 500", async () => {
    mockError(500, "Internal Server Error");
    await expect(fetchDashboardSummary()).rejects.toThrow("API 500");
  });

  // ── Content-Type header ────────────────────────────────────────

  it("sends Content-Type application/json", async () => {
    mockResponse([]);
    await fetchDocuments();
    const opts = mockFetch.mock.calls[0][1];
    expect(opts.headers["Content-Type"]).toBe("application/json");
  });

  // ── Auth token ─────────────────────────────────────────────────

  it("sends Authorization header when token provider is set", async () => {
    setTokenProvider(() => Promise.resolve("test-token-123"));
    mockResponse([]);
    await fetchDocuments();
    const opts = mockFetch.mock.calls[0][1];
    expect(opts.headers["Authorization"]).toBe("Bearer test-token-123");
    // Clean up
    setTokenProvider(() => Promise.resolve(null));
  });

  it("uploadDocument sends Authorization header with FormData", async () => {
    setTokenProvider(() => Promise.resolve("upload-token-456"));
    mockResponse({ status: "accepted", filename: "test.pdf", id: 1 });
    const file = new File(["pdf-data"], "test.pdf", { type: "application/pdf" });
    await uploadDocument(file);
    const opts = mockFetch.mock.calls[0][1];
    expect(opts.headers["Authorization"]).toBe("Bearer upload-token-456");
    expect(opts.body).toBeInstanceOf(FormData);
    // Clean up
    setTokenProvider(() => Promise.resolve(null));
  });

  it("omits Authorization header when token provider returns null", async () => {
    setTokenProvider(() => Promise.resolve(null));
    mockResponse([]);
    await fetchDocuments();
    const opts = mockFetch.mock.calls[0][1];
    expect(opts.headers["Authorization"]).toBeUndefined();
  });

  // ── Delete Document ────────────────────────────────────────────

  it("deleteDocument sends DELETE to correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      statusText: "No Content",
      json: () => Promise.resolve(undefined),
      text: () => Promise.resolve(""),
    });
    await deleteDocument(42);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/documents/42");
    expect(opts.method).toBe("DELETE");
  });

  // ── Document Preview/Thumbnail URLs ────────────────────────────

  it("documentPreviewUrl returns correct path", () => {
    expect(documentPreviewUrl(7)).toBe("/api/documents/7/preview");
  });

  it("documentThumbnailUrl returns correct path", () => {
    expect(documentThumbnailUrl(99)).toBe("/api/documents/99/thumbnail");
  });

  // ── Export CSV URL ─────────────────────────────────────────────

  it("getExportCSVUrl returns correct path", () => {
    expect(getExportCSVUrl()).toBe("/api/export/csv");
  });

  // ── downloadWithAuth ───────────────────────────────────────────

  it("downloadWithAuth fetches and triggers download", async () => {
    setTokenProvider(() => Promise.resolve("dl-token"));
    const fakeBlob = new Blob(["csv-data"], { type: "text/csv" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(fakeBlob),
    });

    // Mock URL.createObjectURL and document.createElement
    const revokeUrl = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:fake", revokeObjectURL: revokeUrl });
    const clickFn = vi.fn();
    const removeFn = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        const el = origCreateElement("a");
        el.click = clickFn;
        el.remove = removeFn;
        return el;
      }
      return origCreateElement(tag);
    });

    await downloadWithAuth("/export/csv", "test.csv");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/export/csv");
    expect(opts.headers["Authorization"]).toBe("Bearer dl-token");
    expect(clickFn).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith("blob:fake");

    vi.restoreAllMocks();
    setTokenProvider(() => Promise.resolve(null));
  });

  it("downloadWithAuth throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
    await expect(downloadWithAuth("/export/csv", "f.csv")).rejects.toThrow("Export failed");
  });

  // ── Reconciliation ─────────────────────────────────────────────

  it("runReconciliation sends POST to /reconcile", async () => {
    mockResponse({ matched: 3, matches: [] });
    const result = await runReconciliation();
    expect(result.matched).toBe(3);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/reconcile");
    expect(opts.method).toBe("POST");
  });

  it("patchReconciliation sends PATCH with status", async () => {
    mockResponse({ id: 5, status: "aprovado" });
    const result = await patchReconciliation(5, { status: "aprovado" });
    expect(result.status).toBe("aprovado");
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/reconciliations/5");
    expect(opts.method).toBe("PATCH");
  });

  it("fetchReconciliationSuggestions calls correct endpoint", async () => {
    mockResponse([{ bank_transaction_id: 1, confidence: 85 }]);
    const result = await fetchReconciliationSuggestions(10);
    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/reconciliations/10/suggestions", expect.any(Object));
  });

  // ── Bank CSV Upload ────────────────────────────────────────────

  it("uploadBankCSV sends FormData via POST", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ imported: 5 }),
      text: () => Promise.resolve('{"imported": 5}'),
    });
    const file = new File(["csv-data"], "bank.csv", { type: "text/csv" });
    const result = await uploadBankCSV(file);
    expect(result.imported).toBe(5);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/bank-transactions/upload");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeInstanceOf(FormData);
  });

  // ── Monthly Data ───────────────────────────────────────────────

  it("fetchMonthlyData calls /dashboard/monthly", async () => {
    mockResponse([{ month: "2026-01", doc_count: 3 }]);
    const result = await fetchMonthlyData();
    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/dashboard/monthly", expect.any(Object));
  });

  // ── Checkout ───────────────────────────────────────────────────

  it("createCheckoutSession sends POST with plan_id", async () => {
    mockResponse({ checkout_url: "https://stripe.com/checkout/xyz" });
    const result = await createCheckoutSession("pro");
    expect(result.checkout_url).toContain("stripe.com");
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("plan_id=pro");
    expect(opts.method).toBe("POST");
  });

  // ── Entity ─────────────────────────────────────────────────────

  it("fetchEntity calls /entity", async () => {
    mockResponse({ legalName: "Empresa" });
    const result = await fetchEntity();
    expect(result.legalName).toBe("Empresa");
    expect(mockFetch).toHaveBeenCalledWith("/api/entity", expect.any(Object));
  });

  it("saveEntity sends PUT with data", async () => {
    mockResponse({ legalName: "Nova Empresa" });
    await saveEntity({ legalName: "Nova Empresa", nif: "999999999" });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/entity");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual({ legalName: "Nova Empresa", nif: "999999999" });
  });
});
