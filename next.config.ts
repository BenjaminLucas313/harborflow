import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Keep @react-pdf/renderer out of the client bundle — it renders PDFs
  // server-side only (in API routes). Bundling it into the edge/client runtime
  // causes canvas and Node.js-specific module errors.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default withNextIntl(nextConfig);
