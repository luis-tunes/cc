/**
 * API client for the FastAPI backend.
 * All requests go through /api which Vite proxies to localhost:8080.
 * In production the same path is served by the backend directly.
 */

const BASE = "/api";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────

export interface Document {
  id: number;
  filename: string;
  issuer_name: string | null;
  issuer_nif: string | null;
  amount: number | null;
  doc_date: string | null;
  raw_text: string | null;
  status: string;
  created_at: string;
}

export interface BankTransaction {
  id: number;
  tx_date: string;
  description: string;
  amount: number;
  balance: number | null;
  created_at: string;
}

export interface Reconciliation {
  id: number;
  document_id: number;
  transaction_id: number;
  matched_on: string;
  created_at: string;
}

export interface DashboardSummary {
  total_documents: number;
  total_transactions: number;
  total_reconciled: number;
  unreconciled_documents: number;
}

export interface MonthlyData {
  month: string;
  invoices: number;
  total: number;
}

// ── Documents ────────────────────────────────────────────────────────

export async function fetchDocuments(params?: {
  status?: string;
  search?: string;
}): Promise<Document[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.search) qs.set("search", params.search);
  const query = qs.toString();
  return request<Document[]>(`/documents${query ? `?${query}` : ""}`);
}

export async function fetchDocument(id: number): Promise<Document> {
  return request<Document>(`/documents/${id}`);
}

export async function uploadDocument(file: File): Promise<Document> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/documents/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Upload failed ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Bank Transactions ────────────────────────────────────────────────

export async function fetchBankTransactions(): Promise<BankTransaction[]> {
  return request<BankTransaction[]>("/bank-transactions");
}

export async function uploadBankCSV(file: File): Promise<{ imported: number }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/bank-transactions/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`CSV upload failed ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Reconciliation ───────────────────────────────────────────────────

export async function fetchReconciliations(): Promise<Reconciliation[]> {
  return request<Reconciliation[]>("/reconciliations");
}

export async function runReconciliation(): Promise<{ new_matches: number }> {
  return request<{ new_matches: number }>("/reconcile", { method: "POST" });
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
