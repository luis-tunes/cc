/// <reference types="cypress" />

import { mockApi } from "./mock-api";

// Set up API mocks and dismiss overlays before each test
beforeEach(() => {
  // Dismiss the guided tour and theme localStorage
  cy.window().then((win) => {
    win.localStorage.setItem("tim-tour-completed", "1");
  });
  mockApi();
});
