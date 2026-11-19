import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const config: NextConfig = {
  // Le logiciel est servi sous /agence, y compris à travers le site client (même adresse,
  // même connexion : le gérant y accède depuis son téléphone comme depuis son PC).
  basePath: "/agence",
  transpilePackages: ["@lvb/ui"],
  poweredByHeader: false,
  webpack: (c) => {
    // Les sources TypeScript du monorepo importent avec l'extension .js (ESM NodeNext).
    c.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return c;
  },
};

export default createNextIntlPlugin("./i18n/request.ts")(config);
