describe("Bank Movements Page", () => {
  beforeEach(() => {
    cy.visit("/movimentos");
    cy.get("h1", { timeout: 10000 }).should("contain.text", "Movimentos");
  });

  it("shows page title", () => {
    cy.get("h1").should("contain.text", "Movimentos");
  });

  it("shows subtitle", () => {
    cy.contains("Importação, classificação").should("exist");
  });

  it("has import button", () => {
    cy.contains("Importar").should("be.visible");
  });

  it("displays bank transactions from API", () => {
    cy.wait("@bankTransactions");
    cy.contains("Pagamento fornecedor ABC").should("exist");
  });

  it("shows multiple transaction descriptions", () => {
    cy.wait("@bankTransactions");
    cy.contains("Recebimento cliente XYZ").should("exist");
  });
});
