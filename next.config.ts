import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Keep @react-pdf/renderer out of the client bundle — it renders PDFs
  // server-side only (in API routes). Bundling it into the edge/client runtime
  // causes canvas and Node.js-specific module errors.
  serverExternalPackages: ["@react-pdf/renderer"],
  // react-markdown v10+ is ESM-only — transpile it through Next.js's webpack
  // pipeline so it works correctly in both server and client rendering contexts.
  transpilePackages: ["react-markdown", "three"],
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org:       process.env.SENTRY_ORG,
  project:   process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent:                  true,
  disableLogger:           true,
  automaticVercelMonitors: false,
});
