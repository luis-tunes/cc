describe("Dark Mode Toggle", () => {
  beforeEach(() => {
    cy.window().then((win) => win.localStorage.removeItem("tim-theme"));
    cy.visit("/painel");
    cy.get("h1", { timeout: 10000 }).should("exist");
  });

  function openThemeMenu() {
    // Find the sr-only text and click the closest button ancestor
    cy.contains("span", "Alternar tema").closest("button").click();
  }

  it("shows theme toggle button in topbar", () => {
    cy.contains("Alternar tema").should("exist");
  });

  it("opens theme dropdown on click", () => {
    openThemeMenu();
    cy.contains("Claro").should("be.visible");
    cy.contains("Escuro").should("be.visible");
    cy.contains("Sistema").should("be.visible");
  });

  it("switches to dark mode", () => {
    openThemeMenu();
    cy.contains("Escuro").click();
    cy.get("html").should("have.class", "dark");
  });

  it("persists dark mode in localStorage", () => {
    openThemeMenu();
    cy.contains("Escuro").click();
    cy.window().then((win) => {
      expect(win.localStorage.getItem("tim-theme")).to.eq("dark");
    });
  });

  it("switches back to light mode", () => {
    openThemeMenu();
    cy.contains("Escuro").click();
    cy.get("html").should("have.class", "dark");

    // Wait for dropdown to fully close before reopening
    cy.get("body").click(0, 0);
    cy.wait(300);
    openThemeMenu();
    cy.contains("Claro").click();
    cy.get("html").should("not.have.class", "dark");
  });

  it("applies dark color-scheme", () => {
    openThemeMenu();
    cy.contains("Escuro").click();
    cy.get("html").should("have.class", "dark");
  });
});
