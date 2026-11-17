import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const config: NextConfig = {
  transpilePackages: ["@lvb/ui"],
  poweredByHeader: false,
  webpack: (c) => {
    // Les sources TypeScript du monorepo importent avec l'extension .js (ESM NodeNext).
    c.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return c;
  },
};

export default createNextIntlPlugin("./i18n/request.ts")(config);
