import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./demo",
  timeout: 120_000,
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1280, height: 720 },
    video: { mode: "on", size: { width: 1280, height: 720 } },
    launchOptions: { slowMo: 80 },
  },
  projects: [
    {
      name: "demo-recording",
      use: { browserName: "chromium" },
    },
  ],
  outputDir: "./demo/recordings",
});
