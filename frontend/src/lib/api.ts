/**
 * API client for the FastAPI backend.
 * All requests go through /api which Vite proxies to localhost:8080.
 * In production the same path is served by the backend directly.
 */

const BASE = "/api";

/** Structured API error with status code and detail message. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly code?: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }

  get isNetworkError() { return this.status === 0; }
  get isNotFound() { return this.status === 404; }
  get isForbidden() { return this.status === 403; }
  get isServerError() { return this.status >= 500; }
  get isRateLimited() { return this.status === 429; }
}

/**
 * Token provider — set by AuthSync component so the API client
 * can obtain a fresh Clerk session token from outside React.
 */
let _tokenProvider: (() => Promise<string | null>) | null = null;

export function setTokenProvider(provider: () => Promise<string | null>) {
  _tokenProvider = provider;
  // Reset cache when provider changes
  _cachedToken = undefined;
  _tokenExpiry = 0;
}

// Cache the token to avoid calling getToken() on every request
let _cachedToken: string | null | undefined;
let _tokenExpiry = 0;
const TOKEN_CACHE_MS = 45_000; // cache for 45s (Clerk tokens last ~60s)

async function getAuthToken(): Promise<string | null> {
  if (!_tokenProvider) return null;

  const now = Date.now();
  if (_cachedToken !== undefined && now < _tokenExpiry) {
    return _cachedToken;
  }

  try {
    // Timeout after 2s — Clerk's getToken() can hang on HTTP (no crypto.subtle)
    const result = await Promise.race([
      _tokenProvider(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    _cachedToken = result;
    // If token is null (HTTP / no crypto.subtle), cache longer to avoid repeated 2s waits
    _tokenExpiry = now + (result ? TOKEN_CACHE_MS : 10_000);
    return result;
  } catch {
    // token fetch failed — cache null to avoid repeated failures
    _cachedToken = null;
    _tokenExpiry = now + 10_000;
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const token = await getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(0, "Sem ligação à internet");
  }

  // Retry once with fresh token on 401 (expired JWT)
  if (res.status === 401 && _tokenProvider) {
    _cachedToken = undefined;
    _tokenExpiry = 0;
    const freshToken = await getAuthToken();
    if (freshToken) {
      headers["Authorization"] = `Bearer ${freshToken}`;
      try {
        res = await fetch(`${BASE}${path}`, { ...options, headers });
      } catch {
        throw new ApiError(0, "Sem ligação à internet");
      }
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let detail = body || res.statusText;
    let code: string | undefined;
    try {
      const parsed = JSON.parse(body);
      if (parsed?.detail) detail = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
      if (parsed?.code) code = parsed.code;
    } catch { /* not JSON */ }
    throw new ApiError(res.status, detail, code);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function requestFormData<T>(
  path: string,
  form: FormData
): Promise<T> {
  const headers: Record<string, string> = {};

  const token = await getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers,
      body: form,
    });
  } catch {
    throw new ApiError(0, "Sem ligação à internet");
  }

  // Retry once with fresh token on 401
  if (res.status === 401 && _tokenProvider) {
    _cachedToken = undefined;
    _tokenExpiry = 0;
    const freshToken = await getAuthToken();
    if (freshToken) {
      headers["Authorization"] = `Bearer ${freshToken}`;
      try {
        res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: form });
      } catch {
        throw new ApiError(0, "Sem ligação à internet");
      }
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text || res.statusText;
    let code: string | undefined;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.detail) detail = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
      if (parsed?.code) code = parsed.code;
    } catch { /* not JSON */ }
    throw new ApiError(res.status, detail, code);
  }

  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────

export interface Document {
  id: number;
  supplier_nif: string;
  client_nif: string;
  total: number;
  vat: number;
  date: string | null;
  type: string;
  filename: string | null;
  raw_text: string | null;
  status: string;
  paperless_id: number | null;
  created_at: string | null;
  snc_account: string | null;
  classification_source: string | null;
  notes: string | null;
  reconciliation_status?: string | null;
}

export interface DocumentPatch {
  status?: string;
  type?: string;
  supplier_nif?: string;
  client_nif?: string;
  total?: number;
  vat?: number;
  date?: string;
  filename?: string;
  notes?: string;
}

export interface BankTransaction {
  id: number;
  date: string;
  description: string;
  amount: number;
}

export interface Reconciliation {
  id: number;
  document_id: number;
  bank_transaction_id: number;
  match_confidence: number;
  reconciliation_status?: string;
  supplier_nif?: string;
  total?: number;
  doc_vat?: number;
  doc_date?: string;
  doc_filename?: string;
  description?: string;
  amount?: number;
  tx_date?: string;
}

export interface DashboardSummary {
  documents: { count: number; total: string };
  bank_transactions: { count: number; total: string };
  reconciliations: number;
  unmatched_documents: number;
  pending_review: number;
  classified: number;
}

export interface MonthlyData {
  month: string;
  doc_count: number;
  total: string;
  vat: string;
}

// ── Documents ────────────────────────────────────────────────────────

export async function fetchDocuments(params?: {
  status?: string;
  search?: string;
  supplier_nif?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}): Promise<Document[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.search) qs.set("search", params.search);
  if (params?.supplier_nif) qs.set("supplier_nif", params.supplier_nif);
  if (params?.date_from) qs.set("date_from", params.date_from);
  if (params?.date_to) qs.set("date_to", params.date_to);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return request<Document[]>(`/documents${query ? `?${query}` : ""}`);
}

export async function fetchDocument(id: number): Promise<Document> {
  return request<Document>(`/documents/${id}`);
}

export interface ClassificationSuggestion {
  account: string;
  label: string;
  confidence: number;
  source: string;
  reason: string;
}

export async function fetchClassificationSuggestion(docId: number): Promise<ClassificationSuggestion> {
  return request<ClassificationSuggestion>(`/documents/${docId}/suggest`);
}

export async function patchDocument(id: number, patch: DocumentPatch): Promise<Document> {
  return request<Document>(`/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function uploadDocument(file: File): Promise<{ status: string; filename: string; id: number }> {
  const form = new FormData();
  form.append("file", file);
  return requestFormData("/documents/upload", form);
}

export async function deleteDocument(id: number): Promise<void> {
  await request<void>(`/documents/${id}`, { method: "DELETE" });
}

export async function bulkDeleteDocuments(ids: number[]): Promise<void> {
  await request<void>("/documents/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export function documentPreviewUrl(id: number): string {
  return `${BASE}/documents/${id}/preview`;
}

export function documentThumbnailUrl(id: number): string {
  return `${BASE}/documents/${id}/thumbnail`;
}

/** Fetch an authenticated blob URL for images/files that require auth headers. */
export async function fetchAuthenticatedBlob(url: string): Promise<string> {
  const headers: Record<string, string> = {};
  const token = await getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function reprocessDocument(id: number): Promise<void> {
  await request<void>(`/documents/${id}/reprocess`, { method: "POST" });
}

// ── Bank Transactions ────────────────────────────────────────────────

export async function fetchBankTransactions(params?: {
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}): Promise<BankTransaction[]> {
  const qs = new URLSearchParams();
  if (params?.date_from) qs.set("date_from", params.date_from);
  if (params?.date_to) qs.set("date_to", params.date_to);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return request<BankTransaction[]>(`/bank-transactions${query ? `?${query}` : ""}`);
}

export async function uploadBankCSV(file: File): Promise<{ imported: number }> {
  const form = new FormData();
  form.append("file", file);
  return requestFormData("/bank-transactions/upload", form);
}

export async function deleteBankTransaction(id: number): Promise<void> {
  await request<void>(`/bank-transactions/${id}`, { method: "DELETE" });
}

// ── Reconciliation ───────────────────────────────────────────────────

export async function fetchReconciliations(): Promise<Reconciliation[]> {
  return request<Reconciliation[]>("/reconciliations");
}

export async function runReconciliation(): Promise<{ matched: number; matches: any[] }> {
  return request<{ matched: number; matches: any[] }>("/reconcile", { method: "POST" });
}

export async function patchReconciliation(id: number, patch: { status: string }): Promise<{ id: number; status: string }> {
  return request<{ id: number; status: string }>(`/reconciliations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function fetchReconciliationSuggestions(docId: number): Promise<{
  bank_transaction_id: number;
  description: string;
  amount: number;
  date: string;
  confidence: number;
  amount_diff: number;
  date_diff: number;
}[]> {
  return request(`/reconciliations/${docId}/suggestions`);
}

// ── Dashboard ────────────────────────────────────────────────────────

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return request<DashboardSummary>("/dashboard/summary");
}

export async function fetchMonthlyData(): Promise<MonthlyData[]> {
  return request<MonthlyData[]>("/dashboard/monthly");
}

// ── Export ────────────────────────────────────────────────────────────

export function getExportCSVUrl(): string {
  return `${BASE}/export/csv`;
}

export async function downloadWithAuth(path: string, filename: string): Promise<void> {
  const headers: Record<string, string> = {};
  const token = await getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers });
  } catch {
    throw new ApiError(0, "Sem ligação à internet");
  }
  if (!res.ok) {
    throw new ApiError(res.status, `Export failed: ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Billing ──────────────────────────────────────────────────────────

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  docs_per_month: number;
  seats: number;
  features: string[];
  contact: string;
  vat_note: string;
}

export interface BillingStatus {
  plan: string;
  status: string;
  stripe_customer?: string;
  trial_days_left?: number;
  trial_end?: string;
}

export async function fetchBillingPlans(): Promise<BillingPlan[]> {
  return request<BillingPlan[]>("/billing/plans");
}

export async function fetchBillingStatus(): Promise<BillingStatus> {
  return request<BillingStatus>("/billing/status");
}

export async function createCheckoutSession(planId: string): Promise<{ checkout_url: string }> {
  return request<{ checkout_url: string }>(`/billing/checkout?plan_id=${planId}`, {
    method: "POST",
  });
}

// ── Entity Profile ───────────────────────────────────────────────────

export async function fetchEntity(): Promise<Record<string, string>> {
  return request<Record<string, string>>("/entity");
}

export async function saveEntity(data: Record<string, string>): Promise<Record<string, string>> {
  return request<Record<string, string>>("/entity", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ── Inventory Types ──────────────────────────────────────────────────

export interface UnitFamily {
  id: number;
  name: string;
  base_unit: string;
  conversions: { from_unit: string; to_unit: string; factor: number }[];
}

export interface Supplier {
  id: number;
  name: string;
  nif: string;
  category: string;
  avg_delivery_days: number;
  reliability: number;
  ingredient_ids: number[];
  price_history: PricePoint[];
}

export interface Ingredient {
  id: number;
  name: string;
  category: string;
  unit: string;
  min_threshold: number;
  supplier_id: number | null;
  supplier_name: string | null;
  last_cost: number;
  avg_cost: number;
  stock: number;
  status: "rutura" | "baixo" | "normal" | "excesso";
}

export interface StockEvent {
  id: number;
  type: "entrada" | "saída" | "desperdício" | "ajuste";
  ingredient_id: number;
  ingredient_name: string;
  qty: number;
  unit: string;
  date: string;
  source: string;
  reference: string;
  cost: number | null;
}

export interface RecipeIngredient {
  ingredient_id: number;
  ingredient_name?: string;
  qty: number;
  unit: string;
  wastage_percent: number;
  avg_cost?: number;
}

export interface Product {
  id: number;
  code: string;
  name: string;
  category: string;
  recipe_version: string;
  estimated_cost: number;
  pvp: number;
  margin: number;
  active: boolean;
  ingredients: RecipeIngredient[];
}

export interface InventoryStats {
  total_ingredients: number;
  rutura_count: number;
  baixo_count: number;
  stock_value: number;
  recent_entradas: number;
  recent_saidas: number;
}

export interface ShoppingListItem {
  ingredient_id: number;
  name: string;
  current_stock: number;
  threshold: number;
  suggested_qty: number;
  unit: string;
  supplier_id: number | null;
  supplier_name: string | null;
  last_price: number;
  avg_price: number;
  urgency: "urgente" | "alta" | "normal";
}

export interface PricePoint {
  id?: number;
  ingredient_id: number;
  supplier_id: number;
  price: number;
  date: string;
}

export interface ProductCost {
  total_cost: number;
  margin: number;
  breakdown: {
    ingredient_id: number;
    name: string;
    qty: number;
    wastage_percent: number;
    avg_cost: number;
    line_cost: number;
  }[];
}

export interface StockImpact {
  qty: number;
  sufficient: boolean;
  impact: {
    ingredient_id: number;
    name: string;
    current_stock: number;
    needed: number;
    after: number;
    unit: string;
    sufficient: boolean;
  }[];
}

// ── Inventory API ────────────────────────────────────────────────────

export async function fetchUnitFamilies(): Promise<UnitFamily[]> {
  return request<UnitFamily[]>("/unit-families");
}

export async function createUnitFamily(body: { name: string; base_unit: string; conversions?: { from_unit: string; to_unit: string; factor: number }[] }): Promise<UnitFamily> {
  return request<UnitFamily>("/unit-families", { method: "POST", body: JSON.stringify(body) });
}

export async function fetchSuppliers(): Promise<Supplier[]> {
  return request<Supplier[]>("/suppliers");
}

export async function createSupplier(body: Partial<Supplier>): Promise<Supplier> {
  return request<Supplier>("/suppliers", { method: "POST", body: JSON.stringify(body) });
}

export async function updateSupplier(id: number, body: Partial<Supplier>): Promise<Supplier> {
  return request<Supplier>(`/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function deleteSupplier(id: number): Promise<void> {
  return request(`/suppliers/${id}`, { method: "DELETE" });
}

export async function fetchIngredients(params?: { category?: string; status_filter?: string }): Promise<Ingredient[]> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set("category", params.category);
  if (params?.status_filter) qs.set("status_filter", params.status_filter);
  const query = qs.toString();
  return request<Ingredient[]>(`/ingredients${query ? `?${query}` : ""}`);
}

export async function createIngredient(body: Partial<Ingredient>): Promise<Ingredient> {
  return request<Ingredient>("/ingredients", { method: "POST", body: JSON.stringify(body) });
}

export async function updateIngredient(id: number, body: Partial<Ingredient>): Promise<Ingredient> {
  return request<Ingredient>(`/ingredients/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function deleteIngredient(id: number): Promise<void> {
  return request(`/ingredients/${id}`, { method: "DELETE" });
}

export async function fetchStockEvents(params?: { ingredient_id?: number; event_type?: string; limit?: number; offset?: number }): Promise<StockEvent[]> {
  const qs = new URLSearchParams();
  if (params?.ingredient_id) qs.set("ingredient_id", String(params.ingredient_id));
  if (params?.event_type) qs.set("event_type", params.event_type);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return request<StockEvent[]>(`/stock-events${query ? `?${query}` : ""}`);
}

export async function createStockEvent(body: { type: string; ingredient_id: number; qty: number; unit?: string; date?: string; source?: string; reference?: string; cost?: number }): Promise<StockEvent> {
  return request<StockEvent>("/stock-events", { method: "POST", body: JSON.stringify(body) });
}

export async function fetchProducts(): Promise<Product[]> {
  return request<Product[]>("/products");
}

export async function createProduct(body: Partial<Product> & { ingredients?: RecipeIngredient[] }): Promise<Product> {
  return request<Product>("/products", { method: "POST", body: JSON.stringify(body) });
}

export async function updateProduct(id: number, body: Partial<Product> & { ingredients?: RecipeIngredient[] }): Promise<Product> {
  return request<Product>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function deleteProduct(id: number): Promise<void> {
  return request(`/products/${id}`, { method: "DELETE" });
}

export async function fetchProductCost(id: number): Promise<ProductCost> {
  return request<ProductCost>(`/products/${id}/cost`);
}

export async function produceProduct(id: number, qty: number): Promise<{ produced: number; product: string; events: StockEvent[] }> {
  return request(`/products/${id}/produce`, { method: "POST", body: JSON.stringify({ qty }) });
}

export async function fetchStockImpact(id: number, qty: number): Promise<StockImpact> {
  return request<StockImpact>(`/products/${id}/stock-impact?qty=${qty}`);
}

export async function fetchInventoryStats(): Promise<InventoryStats> {
  return request<InventoryStats>("/inventory/stats");
}

export async function fetchShoppingList(): Promise<ShoppingListItem[]> {
  return request<ShoppingListItem[]>("/inventory/shopping-list");
}

export async function addPricePoint(body: { ingredient_id: number; supplier_id: number; price: number; date?: string }): Promise<PricePoint> {
  return request<PricePoint>("/price-history", { method: "POST", body: JSON.stringify(body) });
}

// ── Tax Center ──────────────────────────────────────────────────────────────

export interface IvaPeriod {
  period: string;
  year: string;
  quarter: number;
  doc_count: number;
  total_invoiced: number;
  total_vat: number;
  vat_collected: number;
  vat_deductible: number;
  vat_due: number;
}

export interface IrcEstimate {
  year: number;
  receitas: number;
  gastos: number;
  resultado: number;
  irc_estimate: number;
  irc_rate_note: string;
  doc_count: number;
}

export interface AuditFlag {
  type: string;
  severity: "error" | "warning" | "info";
  label: string;
  count: number;
  description: string;
}

export interface AuditFlagsResult {
  flags: AuditFlag[];
  total_issues: number;
}

export async function fetchIvaPeriods(): Promise<IvaPeriod[]> {
  return request<IvaPeriod[]>("/tax/iva-periods");
}

export async function fetchIrcEstimate(): Promise<IrcEstimate> {
  return request<IrcEstimate>("/tax/irc-estimate");
}

export async function fetchAuditFlags(): Promise<AuditFlagsResult> {
  return request<AuditFlagsResult>("/tax/audit-flags");
}

// ── Obligations ─────────────────────────────────────────────────────────────

export interface Obligation {
  id: string;
  type: string;
  period: string;
  deadline: string;
  deadline_month: number | null;
  deadline_day: number;
  description: string;
  days_left: number;
  status: "overdue" | "urgent" | "upcoming" | "future";
}

export async function fetchObligations(year?: number): Promise<Obligation[]> {
  const qs = year ? `?year=${year}` : "";
  return request<Obligation[]>(`/obligations${qs}`);
}

// ── Reports ─────────────────────────────────────────────────────────────────

export interface PlMonth {
  month: string;
  month_label: string;
  receitas: number;
  iva_cobrado: number;
  gastos: number;
  iva_dedutivel: number;
  resultado: number;
  doc_count: number;
}

export interface PlReport {
  year: number;
  months: PlMonth[];
  totals: { receitas: number; gastos: number; resultado: number; iva_cobrado: number; iva_dedutivel: number };
}

export interface TopSupplier {
  supplier_nif: string;
  doc_count: number;
  total_spend: number;
  total_vat: number;
  last_date: string | null;
}

export async function fetchPlReport(year?: number): Promise<PlReport> {
  const qs = year ? `?year=${year}` : "";
  return request<PlReport>(`/reports/pl${qs}`);
}

export async function fetchTopSuppliers(limit = 10): Promise<TopSupplier[]> {
  return request<TopSupplier[]>(`/reports/top-suppliers?limit=${limit}`);
}

// ── Classification Rules ────────────────────────────────────────────

export interface ClassificationRule {
  id: number;
  field: string;
  operator: string;
  value: string;
  account: string;
  label: string;
  priority: number;
  active: boolean;
}

export interface ClassificationRuleCreate {
  field: string;
  operator: string;
  value: string;
  account: string;
  label?: string;
  priority?: number;
  active?: boolean;
}

export async function fetchClassificationRules(): Promise<ClassificationRule[]> {
  return request<ClassificationRule[]>("/classification-rules");
}

export async function createClassificationRule(body: ClassificationRuleCreate): Promise<ClassificationRule> {
  return request<ClassificationRule>("/classification-rules", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchClassificationRule(id: number, patch: Partial<ClassificationRuleCreate>): Promise<ClassificationRule> {
  return request<ClassificationRule>(`/classification-rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteClassificationRule(id: number): Promise<void> {
  return request<void>(`/classification-rules/${id}`, { method: "DELETE" });
}

// ── Alerts ───────────────────────────────────────────────────────────

export interface Alert {
  id: number;
  type: string;
  severity: string;
  title: string;
  description: string;
  action_url: string | null;
  read: boolean;
  created_at: string | null;
}

export async function fetchAlerts(unreadOnly = false): Promise<Alert[]> {
  const qs = unreadOnly ? "?unread_only=true" : "";
  return request<Alert[]>(`/alerts${qs}`);
}

export async function markAlertRead(id: number): Promise<{ id: number; read: boolean }> {
  return request<{ id: number; read: boolean }>(`/alerts/${id}`, { method: "PATCH" });
}

export async function generateAlerts(): Promise<{ generated: number }> {
  return request<{ generated: number }>("/alerts/generate", { method: "POST" });
}

// ── Assets ───────────────────────────────────────────────────────────

export interface Asset {
  id: number;
  name: string;
  category: string;
  acquisition_date: string;
  acquisition_cost: number;
  useful_life_years: number;
  depreciation_method: string;
  current_value: number;
  status: string;
  supplier: string | null;
  invoice_ref: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface AssetCreate {
  name: string;
  category?: string;
  acquisition_date: string;
  acquisition_cost: number;
  useful_life_years?: number;
  depreciation_method?: string;
  status?: string;
  supplier?: string;
  invoice_ref?: string;
  notes?: string;
}

export interface AssetSummary {
  total_assets: number;
  total_acquisition_value: number;
  total_current_value: number;
  total_depreciation: number;
  annual_depreciation: number;
  without_method: number;
}

export async function fetchAssets(): Promise<Asset[]> {
  return request<Asset[]>("/assets");
}

export async function fetchAsset(id: number): Promise<Asset> {
  return request<Asset>(`/assets/${id}`);
}

export async function createAsset(body: AssetCreate): Promise<Asset> {
  return request<Asset>("/assets", { method: "POST", body: JSON.stringify(body) });
}

export async function patchAsset(id: number, patch: Partial<AssetCreate>): Promise<Asset> {
  return request<Asset>(`/assets/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteAsset(id: number): Promise<void> {
  return request<void>(`/assets/${id}`, { method: "DELETE" });
}

export async function fetchAssetsSummary(): Promise<AssetSummary> {
  return request<AssetSummary>("/assets/summary");
}

// ── Movement Rules ───────────────────────────────────────────────────

export interface MovementRule {
  id: number;
  name: string;
  pattern: string;
  category: string;
  snc_account: string;
  entity_nif: string | null;
  priority: number;
  active: boolean;
}

export async function fetchMovementRules(): Promise<MovementRule[]> {
  return request<MovementRule[]>("/movement-rules");
}

export async function createMovementRule(body: Omit<MovementRule, "id">): Promise<MovementRule> {
  return request<MovementRule>("/movement-rules", { method: "POST", body: JSON.stringify(body) });
}

export async function deleteMovementRule(id: number): Promise<void> {
  return request<void>(`/movement-rules/${id}`, { method: "DELETE" });
}

// ── Enriched Movements ──────────────────────────────────────────────

export interface EnrichedMovement {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  snc_account: string | null;
  entity_nif: string | null;
  entity_name: string | null;
  classified: boolean;
}

export async function fetchEnrichedMovements(): Promise<EnrichedMovement[]> {
  return request<EnrichedMovement[]>("/bank-transactions/enrich");
}

export async function fetchDuplicateMovements(): Promise<any[]> {
  return request<any[]>("/bank-transactions/duplicates");
}

// ── CSV Export URLs ──────────────────────────────────────────────────

export function getExportMovementsCSVUrl(): string {
  return `${BASE}/export/bank-transactions/csv`;
}

export function getExportReconciliationsCSVUrl(): string {
  return `${BASE}/export/reconciliations/csv`;
}

export function getExportAssetsCSVUrl(): string {
  return `${BASE}/export/assets/csv`;
}

// ── AI Assistant ─────────────────────────────────────────────────────

export interface QuickPrompt {
  id: string;
  label: string;
  prompt: string;
  category: "fiscal" | "operacional" | "análise" | "comunicação";
}

export interface ChatResponse {
  question: string;
  intent: string;
  answer: string;
}

export async function fetchAssistantPrompts(): Promise<QuickPrompt[]> {
  return request<QuickPrompt[]>("/assistant/prompts");
}

export async function sendAssistantMessage(question: string): Promise<ChatResponse> {
  return request<ChatResponse>("/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

// ── Auto-Classification ──────────────────────────────────────────────

export interface AutoClassifyResult {
  classified_now: number;
  skipped: number;
  total_processed: number;
  total_classified: number;
  total_unclassified: number;
}

export interface ClassificationStats {
  total: number;
  classified: number;
  unclassified: number;
  coverage_pct: number;
  by_account: { account: string; count: number }[];
}

export async function runAutoClassify(): Promise<AutoClassifyResult> {
  return request<AutoClassifyResult>("/documents/auto-classify", { method: "POST" });
}

export async function fetchClassificationStats(): Promise<ClassificationStats> {
  return request<ClassificationStats>("/documents/classification-stats");
}

// ── Activity Log ─────────────────────────────────────────────────────

export interface ActivityEntry {
  id: number;
  entity_type: string;
  entity_id: number | null;
  action: string;
  detail: string;
  created_at: string;
}

export async function fetchActivity(limit = 50): Promise<ActivityEntry[]> {
  return request<ActivityEntry[]>(`/activity?limit=${limit}`);
}
