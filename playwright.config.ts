import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const env = {
  DATABASE_URL: "file:./e2e.db",
  LEADS_DEMO_MODE: "true",
  ANTHROPIC_API_KEY: "",
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  NEXT_DIST_DIR: ".next-e2e",
  AUTH_SECRET: "e2e-test-secret-not-for-production",
  APP_URL: `http://localhost:${PORT}`,
  NEXT_TELEMETRY_DISABLED: "1",
};

// Il DB SQLite dedicato (prisma/e2e.db, percorso relativo allo schema) viene ricreato da zero
// ad ogni avvio con `prisma db push`, prima della build e dell'avvio del server di produzione.
const command = [
  "rm -f prisma/e2e.db prisma/e2e.db-journal",
  "npx prisma db push --skip-generate --accept-data-loss",
  "npx next build",
  `npx next start -p ${PORT}`,
].join(" && ");

const launchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    launchOptions,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions } },
  ],
  webServer: {
    command,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: Boolean(process.env.PW_REUSE_SERVER),
    timeout: 360_000,
    env: { ...(process.env as Record<string, string>), ...env },
    stdout: "pipe",
  },
});
