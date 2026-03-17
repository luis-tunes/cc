describe("Navigation & Sidebar", () => {
  beforeEach(() => {
    cy.visit("/painel");
    cy.get("h1", { timeout: 10000 }).should("exist");
  });

  it("loads the dashboard by default", () => {
    cy.get("h1").should("contain.text", "Painel");
  });

  it("navigates to Documentos via sidebar", () => {
    cy.get('a[href="/documentos"]').first().click({ force: true });
    cy.url().should("include", "/documentos");
    cy.get("h1").should("contain.text", "Documentos");
  });

  it("navigates to Movimentos via sidebar", () => {
    cy.get('a[href="/movimentos"]').first().click({ force: true });
    cy.url().should("include", "/movimentos");
    cy.get("h1").should("contain.text", "Movimentos");
  });

  it("navigates to Reconciliação via sidebar", () => {
    cy.get('a[href="/reconciliacao"]').first().click({ force: true });
    cy.url().should("include", "/reconciliacao");
    cy.get("h1").should("contain.text", "Reconcilia");
  });

  it("navigates to Centro Fiscal", () => {
    cy.get('a[href="/centro-fiscal"]').first().click({ force: true });
    cy.url().should("include", "/centro-fiscal");
    cy.get("h1").should("contain.text", "Centro Fiscal");
  });

  it("navigates to Relatórios", () => {
    cy.get('a[href="/relatorios"]').first().click({ force: true });
    cy.url().should("include", "/relatorios");
    cy.get("h1").should("contain.text", "Relatórios");
  });

  it("shows all three nav groups", () => {
    cy.contains("Principal").should("exist");
    cy.contains("Negócio").should("exist");
    cy.contains("Definições").should("exist");
  });
});
