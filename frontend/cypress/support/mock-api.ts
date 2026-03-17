/// <reference types="cypress" />

/**
 * Mock all /api/* endpoints so E2E tests run without a backend.
 */
export function mockApi() {
  // Dashboard
  cy.intercept("GET", "/api/dashboard/summary", {
    body: {
      documents: { count: 42, total: "125000.00" },
      bank_transactions: { count: 38, total: "180000.00" },
      reconciliations: 35,
      unmatched_documents: 5,
      pending_review: 3,
      classified: 30,
    },
  }).as("dashboardSummary");

  cy.intercept("GET", "/api/dashboard/monthly", {
    body: [
      { month: "2025-01", doc_count: 8, total: "18000", vat: "4140" },
      { month: "2025-02", doc_count: 10, total: "22000", vat: "5060" },
      { month: "2025-03", doc_count: 7, total: "19000", vat: "4370" },
    ],
  }).as("dashboardMonthly");

  // Documents
  cy.intercept("GET", "/api/documents*", {
    body: [
      { id: 1, supplier_nif: "123456789", client_nif: "987654321", total: "1500.00", vat: "345.00", date: "2025-03-01", type: "fatura", status: "processed", filename: "fatura_001.pdf" },
      { id: 2, supplier_nif: "111222333", client_nif: "987654321", total: "800.00", vat: "184.00", date: "2025-03-05", type: "fatura", status: "pending", filename: "fatura_002.pdf" },
      { id: 3, supplier_nif: "444555666", client_nif: "987654321", total: "2200.00", vat: "506.00", date: "2025-02-28", type: "recibo", status: "processed", filename: "recibo_001.pdf" },
    ],
  }).as("documents");

  // Bank transactions
  cy.intercept("GET", "/api/bank-transactions*", {
    body: [
      { id: 1, date: "2025-03-01", description: "Pagamento fornecedor ABC", amount: -1500 },
      { id: 2, date: "2025-03-03", description: "Recebimento cliente XYZ", amount: 3200 },
      { id: 3, date: "2025-03-05", description: "Pagamento renda", amount: -800 },
    ],
  }).as("bankTransactions");

  // Reconciliations
  cy.intercept("GET", "/api/reconciliations", {
    body: [
      { id: 1, document_id: 1, bank_transaction_id: 1, match_confidence: 0.95, status: "confirmed" },
    ],
  }).as("reconciliations");

  // Billing status — active trial
  cy.intercept("GET", "/api/billing/status", {
    body: { status: "trial", days_left: 14, plan: null },
  }).as("billingStatus");

  // Entity
  cy.intercept("GET", "/api/entity", {
    body: { name: "TIM Testes Lda", nif: "999999990", email: "teste@tim.pt" },
  }).as("entity");

  // Alerts
  cy.intercept("GET", "/api/alerts*", { body: [] }).as("alerts");

  // IVA periods
  cy.intercept("GET", "/api/tax/iva-periods", {
    body: [
      { period: "2025-Q1", doc_count: 15, total_invoiced: 45000, vat_collected: 10350, vat_deductible: 6900, vat_due: 3450 },
    ],
  }).as("ivaPeriods");

  // IRC estimate
  cy.intercept("GET", "/api/tax/irc-estimate", {
    body: { year: 2025, receitas: 125000, gastos: 83000, resultado: 42000, irc_estimate: 8820, irc_rate_note: "21% taxa normal", doc_count: 42 },
  }).as("ircEstimate");

  // Audit flags
  cy.intercept("GET", "/api/tax/audit-flags", {
    body: { total_issues: 0, flags: [] },
  }).as("auditFlags");

  // P&L report
  cy.intercept("GET", "/api/reports/pl*", {
    body: {
      months: [
        { month: 1, month_label: "Jan", receitas: 18000, gastos: 12000, resultado: 6000, iva_cobrado: 4140, iva_dedutivel: 2760, doc_count: 5 },
        { month: 2, month_label: "Fev", receitas: 22000, gastos: 14000, resultado: 8000, iva_cobrado: 5060, iva_dedutivel: 3220, doc_count: 7 },
      ],
      totals: { receitas: 40000, gastos: 26000, resultado: 14000, iva_cobrado: 9200, iva_dedutivel: 5980 },
    },
  }).as("plReport");

  // Top suppliers
  cy.intercept("GET", "/api/reports/top-suppliers*", {
    body: [
      { supplier_nif: "123456789", total_spend: 15000, doc_count: 8, last_date: "2025-03-10" },
      { supplier_nif: "111222333", total_spend: 8000, doc_count: 4, last_date: "2025-03-05" },
    ],
  }).as("topSuppliers");

  // Classification rules
  cy.intercept("GET", "/api/classification-rules", { body: [] }).as("classificationRules");

  // Activity feed
  cy.intercept("GET", "/api/activity*", { body: [] }).as("activity");

  // Inventory / suppliers / products
  cy.intercept("GET", "/api/inventory/stats", { body: { total_ingredients: 0, low_stock: 0, total_value: 0 } }).as("inventoryStats");
  cy.intercept("GET", "/api/ingredients*", { body: [] }).as("ingredients");
  cy.intercept("GET", "/api/suppliers", { body: [] }).as("suppliers");
  cy.intercept("GET", "/api/products", { body: [] }).as("products");
  cy.intercept("GET", "/api/shopping-list", { body: [] }).as("shoppingList");

  // Classification stats
  cy.intercept("GET", "/api/classification-stats", { body: { total_classified: 0, auto_classified: 0, manual_classified: 0 } }).as("classificationStats");

  // Obligations
  cy.intercept("GET", "/api/obligations*", { body: [] }).as("obligations");

  // Assets
  cy.intercept("GET", "/api/assets", { body: [] }).as("assets");
  cy.intercept("GET", "/api/assets/summary", { body: { total_assets: 0, total_value: 0, monthly_depreciation: 0 } }).as("assetsSummary");

  // Enriched movements
  cy.intercept("GET", "/api/enriched-movements", { body: [] }).as("enrichedMovements");
  cy.intercept("GET", "/api/duplicate-movements", { body: [] }).as("duplicateMovements");
  cy.intercept("GET", "/api/movement-rules", { body: [] }).as("movementRules");
}
