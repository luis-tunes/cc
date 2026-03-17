describe("Dashboard", () => {
  beforeEach(() => {
    cy.visit("/painel");
    cy.get("h1", { timeout: 10000 }).should("contain.text", "Painel");
  });

  it("shows page title and subtitle", () => {
    cy.get("h1").should("contain.text", "Painel");
    cy.contains("Visão geral").should("exist");
  });

  it("displays KPI cards after loading", () => {
    cy.wait("@dashboardSummary");
    cy.contains("Documentos").should("be.visible");
    cy.contains("Reconciliados").should("be.visible");
    cy.contains("Pendentes").should("be.visible");
  });

  it("shows KPI values from API", () => {
    cy.wait("@dashboardSummary");
    // doc count = 42
    cy.contains("42").should("exist");
  });

  it("has a details toggle", () => {
    cy.wait("@dashboardSummary");
    cy.contains("Ver detalhes").should("exist");
  });

  it("expands details section on click", () => {
    cy.wait("@dashboardSummary");
    cy.contains("Ver detalhes").click();
    cy.contains("Receita vs Gastos").should("be.visible");
  });
});
