import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: { TZ: "UTC" },
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/i18n/fr.ts", "src/i18n/ar.ts", "src/i18n/kab.ts", "src/index.ts"],
      reporter: ["text-summary", "text"],
      thresholds: { "src/regles.ts": { lines: 90, branches: 90, functions: 90 } },
    },
  },
});
