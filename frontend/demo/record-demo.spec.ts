/**
 * Playwright demo recording script.
 * Records a walkthrough of the xtim.ai app for marketing/landing page use.
 *
 * Prerequisites:
 *   1. App running locally: cd frontend && npm run dev
 *   2. Backend running with AUTH_DISABLED=1 and seed data
 *
 * Run:
 *   cd frontend && npx playwright test --config=playwright.config.ts
 *
 * Output:
 *   Video saved to frontend/demo/recordings/
 */
import { test, expect } from "@playwright/test";

const PAUSE = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("full product walkthrough", async ({ page }) => {
  // ── Landing page ──────────────────────────────────────────────────
  await page.goto("/");
  await PAUSE(2000); // Let animations play

  // Scroll through landing page sections
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "smooth" }));
  await PAUSE(1500);
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "smooth" }));
  await PAUSE(1500);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await PAUSE(1000);

  // ── Navigate to app (requires AUTH_DISABLED=1) ────────────────────
  await page.goto("/painel");
  await PAUSE(2000);

  // ── Dashboard ─────────────────────────────────────────────────────
  await expect(page.locator("body")).toBeVisible();
  await PAUSE(2000);

  // ── Documents page ────────────────────────────────────────────────
  await page.goto("/documentos");
  await PAUSE(2000);

  // ── Upload a document ─────────────────────────────────────────────
  // Look for upload button/area
  const uploadBtn = page.locator('button:has-text("Carregar"), button:has-text("Upload"), [data-testid="upload"]');
  if (await uploadBtn.count() > 0) {
    await uploadBtn.first().click();
    await PAUSE(1500);
    // Close modal if open
    const closeBtn = page.locator('button:has-text("Fechar"), button[aria-label="Close"], [data-testid="close"]');
    if (await closeBtn.count() > 0) {
      await closeBtn.first().click();
      await PAUSE(500);
    }
  }

  // ── Bank movements ────────────────────────────────────────────────
  await page.goto("/movimentos");
  await PAUSE(2000);

  // ── Reconciliation ────────────────────────────────────────────────
  await page.goto("/reconciliacao");
  await PAUSE(2000);

  // ── Reports ───────────────────────────────────────────────────────
  await page.goto("/relatorios");
  await PAUSE(2000);

  // ── Back to dashboard ─────────────────────────────────────────────
  await page.goto("/painel");
  await PAUSE(2000);
});

test("landing page scroll demo", async ({ page }) => {
  await page.goto("/");
  await PAUSE(3000); // Hero entrance animations

  // Smooth scroll through each section
  const sections = ["#funcionalidades", "#como-funciona", "#precos"];
  for (const id of sections) {
    await page.locator(id).scrollIntoViewIfNeeded();
    await PAUSE(2500);
  }

  // Scroll back to top
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await PAUSE(2000);
});
