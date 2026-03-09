# CC — Product Blueprint

## What It Is

CC is a single-user Portuguese accounting assistant. It ingests PDF invoices via Paperless-ngx (OCR), extracts structured data (NIF, total, VAT, date), imports bank statement CSVs, and reconciles invoices against bank movements.

## Who Uses It

A Portuguese sole trader or micro-business owner who needs to track invoices and match them to bank transactions without an accountant or ERP.

## Core Jobs-to-be-Done

1. **Ingest** — Upload PDF invoices; OCR extracts supplier NIF, client NIF, total, VAT, date, type.
2. **Import** — Load a bank statement CSV (date, description, amount).
3. **Reconcile** — Match invoices to bank movements: `|total − |amount|| < 0.01` and `|dates| ≤ 5 days`.
4. **Review** — See KPI summary, monthly VAT chart, reconciliation rate.
5. **Export** — Download all document data as CSV.

## Operating Model

- Single container stack: FastAPI + PostgreSQL + Paperless-ngx.
- Paperless handles OCR; post-consume webhook fires into the FastAPI app.
- invoice2data (+ regex fallback) extracts structured fields from PDFs.
- No authentication, no multi-tenant, no AT/SAFT integration.
- Direct PDF upload via UI also supported (forwards to Paperless API).

## Data Model

```
documents:         id, supplier_nif, client_nif, total, vat, date, type, paperless_id
bank_transactions: id, date, description, amount
reconciliations:   id, document_id, bank_transaction_id, match_confidence
```

## Validation Rules

- NIF: 9 digits, mod-11 checksum. Invalid NIFs stored as `000000000`.
- VAT rates: 23%, 13%, 6% (extracted from invoice; 0 when unknown).
- Money: Decimal, never float.
- Dates: UTC storage, Europe/Lisbon display.

## MVP Boundaries

**In scope:** upload, import, reconcile, export, dashboard summary, monthly VAT.
**Out of scope:** authentication, multi-tenant, AT portal, SAFT, ML matching, edit flows, search, notifications, roles, billing.
