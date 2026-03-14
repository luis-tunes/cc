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
});
