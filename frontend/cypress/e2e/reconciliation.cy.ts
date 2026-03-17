describe("Reconciliation Page", () => {
  beforeEach(() => {
    cy.visit("/reconciliacao");
    cy.get("h1", { timeout: 10000 }).should("contain.text", "Reconcilia");
  });

  it("shows page title", () => {
    cy.get("h1").should("contain.text", "Reconcilia");
  });

  it("shows subtitle", () => {
    cy.contains("Correspondência entre documentos").should("exist");
  });

  it("loads reconciliation data", () => {
    cy.wait("@reconciliations");
    cy.wait("@documents");
  });

  it("shows reconciliation status section", () => {
    // Should show either the command bar with filters or the empty state
    cy.get("body").then(($body) => {
      const hasData = $body.text().includes("Reconciliados") || $body.text().includes("Pendentes");
      const hasEmpty = $body.text().includes("Sem dados para reconciliar");
      expect(hasData || hasEmpty).to.be.true;
    });
  });
});
