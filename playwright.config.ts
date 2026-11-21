import { defineConfig } from "@playwright/test";
const database =
  process.env.DATABASE_URL ||
  "postgresql://postgres@127.0.0.1:55433/viora_review_20261119?schema=public";
if (!/test|review/i.test(new URL(database).pathname))
  throw Error("Browser tests require an isolated test database");
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:5179",
    headless: true,
    ...(process.env.PLAYWRIGHT_USE_BUNDLED ? {} : { channel: "chrome" }),
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npx tsx server/src/index.ts",
      url: "http://127.0.0.1:5061/api/health",
      reuseExistingServer: false,
      env: {
        DATABASE_URL: database,
        NODE_ENV: "test",
        PORT: "5061",
        CLIENT_URL: "http://127.0.0.1:5179",
      },
    },
    {
      command:
        "npm run dev --workspace client -- --host 127.0.0.1 --port 5179 --strictPort",
      url: "http://127.0.0.1:5179",
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: "http://127.0.0.1:5061" },
    },
  ],
});
