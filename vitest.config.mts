import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["client/tests/**/*.test.tsx", "server/tests/**/*.test.ts"],
    restoreMocks: true,
  },
});
