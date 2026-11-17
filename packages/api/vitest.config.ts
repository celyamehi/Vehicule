import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // SWC émet les métadonnées de décorateurs nécessaires à l'injection de dépendances NestJS.
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    globalSetup: ["./test/setup-global.ts"],
    setupFiles: ["./test/env.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: { TZ: "UTC" },
    coverage: { provider: "v8", include: ["src/**"], reporter: ["text-summary"] },
  },
});
