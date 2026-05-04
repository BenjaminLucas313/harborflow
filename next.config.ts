import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

// next-pwa is CJS with no bundled types — require() is the safest import path
// in a TypeScript config file to avoid ESM/CJS resolution conflicts.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa") as (options: {
  dest: string;
  disable?: boolean;
  register?: boolean;
  skipWaiting?: boolean;
  fallbacks?: { document?: string };
  runtimeCaching?: Array<{
    urlPattern: RegExp | string;
    handler: string;
    options?: {
      cacheName?: string;
      expiration?: { maxEntries?: number; maxAgeSeconds?: number };
    };
  }>;
}) => (config: NextConfig) => NextConfig;

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Keep @react-pdf/renderer out of the client bundle — it renders PDFs
  // server-side only (in API routes). Bundling it into the edge/client runtime
  // causes canvas and Node.js-specific module errors.
  serverExternalPackages: ["@react-pdf/renderer"],
  // react-markdown v10+ is ESM-only — transpile it through Next.js's webpack
  // pipeline so it works correctly in both server and client rendering contexts.
  transpilePackages: ["react-markdown", "three"],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              "connect-src 'self' https://api.anthropic.com https://o4511289220202496.ingest.us.sentry.io",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

const withPWAConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: { document: "/offline" },
  runtimeCaching: [
    {
      urlPattern: /^https?.*(\/conductor\/viajes\/.*)/,
      handler: "NetworkFirst",
      options: {
        cacheName: "conductor-viajes",
        expiration: { maxEntries: 20, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^https?.*(\/api\/conductor\/.*)/,
      handler: "NetworkFirst",
      options: {
        cacheName: "conductor-api",
        expiration: { maxEntries: 30, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
  ],
});

export default withSentryConfig(withNextIntl(withPWAConfig(nextConfig)), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "australsystems",

  project: "harbor-rosario",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
