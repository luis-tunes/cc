/**
 * API client for the FastAPI backend.
 * All requests go through /api which Vite proxies to localhost:8080.
 * In production the same path is served by the backend directly.
 */

const BASE = "/api";

/** Get the Clerk session token for API calls */
async function getAuthToken(): Promise<string | null> {
  try {
    const clerk = (window as any).__clerk;
    if (clerk?.session) {
      return await clerk.session.getToken();
    }
  } catch {
    // No clerk available (dev mode, etc.)
  }
  return null;
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

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
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

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Upload failed ${res.status}: ${body}`);
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
  supplier_nif?: string;
  total?: number;
  doc_date?: string;
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

// ── Reconciliation ───────────────────────────────────────────────────

export async function fetchReconciliations(): Promise<Reconciliation[]> {
  return request<Reconciliation[]>("/reconciliations");
}

export async function runReconciliation(): Promise<{ matched: number; matches: any[] }> {
  return request<{ matched: number; matches: any[] }>("/reconcile", { method: "POST" });
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

// ── Billing ──────────────────────────────────────────────────────────

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  docs_per_month: number;
  seats: number;
}

export interface BillingStatus {
  plan: string;
  status: string;
  stripe_customer?: string;
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
