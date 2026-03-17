describe("Documents Page", () => {
  beforeEach(() => {
    cy.visit("/documentos");
    cy.get("h1", { timeout: 10000 }).should("contain.text", "Documentos");
  });

  it("shows page title", () => {
    cy.get("h1").should("contain.text", "Documentos");
  });

  it("shows subtitle", () => {
    cy.contains("Gestão de faturas").should("exist");
  });

  it("displays KPI cards", () => {
    cy.contains("Total Documentos").should("be.visible");
    cy.contains("Pendentes Revisão").should("be.visible");
  });

  it("shows tab navigation", () => {
    cy.contains("Todos").should("be.visible");
    cy.contains("Classificados").should("be.visible");
    cy.contains("Reconciliados").should("be.visible");
  });

  it("displays documents from API", () => {
    cy.wait("@documents");
    // Supplier NIF from mock data should be visible
    cy.contains("123456789").should("exist");
  });

  it("has upload button", () => {
    cy.contains("Carregar ficheiros").should("be.visible");
  });
});
