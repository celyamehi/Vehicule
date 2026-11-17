import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/setup-global.ts"],
    // Une seule base de test partagée : les fichiers s'exécutent l'un après l'autre.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: { TZ: "Africa/Algiers" },
    coverage: { include: ["src/**"], reporter: ["text", "html"] },
  },
});
