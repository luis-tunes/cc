describe("Reports Page", () => {
  beforeEach(() => {
    cy.visit("/relatorios");
    cy.get("h1", { timeout: 10000 }).should("contain.text", "Relatórios");
  });

  it("shows page title", () => {
    cy.get("h1").should("contain.text", "Relatórios");
  });

  it("shows year selector", () => {
    const year = new Date().getFullYear();
    cy.contains(year.toString()).should("be.visible");
  });

  it("has export CSV button", () => {
    cy.contains("Exportar CSV").should("be.visible");
  });

  it("shows P&L tab", () => {
    cy.contains("Demonstração de Resultados").should("be.visible");
  });

  it("shows suppliers tab", () => {
    cy.contains("Top Fornecedores").should("be.visible");
  });

  it("displays revenue and expense KPIs", () => {
    cy.wait("@plReport");
    cy.contains("Receitas").should("exist");
    cy.contains("Gastos").should("exist");
    cy.contains("Resultado").should("exist");
  });

  it("switches to suppliers tab", () => {
    cy.contains("Top Fornecedores").click();
    cy.contains("Distribuição por Fornecedor").should("be.visible");
  });
});
