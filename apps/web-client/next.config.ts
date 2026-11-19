import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const config: NextConfig = {
  transpilePackages: ["@lvb/ui"],
  poweredByHeader: false,
  // /agence/* = logiciel des agences, servi sous la même adresse que le site.
  async rewrites() {
    const loueur = process.env.URL_LOUEUR_INTERNE ?? "http://localhost:3001";
    return {
      beforeFiles: [
        { source: "/agence", destination: `${loueur}/agence` },
        { source: "/agence/:chemin*", destination: `${loueur}/agence/:chemin*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  webpack: (c) => {
    // Les sources TypeScript du monorepo importent avec l'extension .js (ESM NodeNext).
    c.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return c;
  },
};

export default createNextIntlPlugin("./i18n/request.ts")(config);
