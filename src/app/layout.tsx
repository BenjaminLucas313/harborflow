import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { SessionProvider } from "next-auth/react";
import { LoadingProvider } from "@/components/ui/LoadingProvider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SentryUserIdentifier } from "@/components/providers/sentry-user-identifier";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "HarborFlow", template: "%s · HarborFlow" },
  description: "Sistema de gestión operativa portuaria",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    title:       "HarborFlow",
    description: "Sistema de gestión operativa portuaria",
    url:         "/",
    siteName:    "HarborFlow",
    images:      [{ url: "/og-image.png", width: 1200, height: 630 }],
    locale:      "es_AR",
    type:        "website",
  },
  twitter: {
    card:        "summary_large_image",
    title:       "HarborFlow",
    description: "Sistema de gestión operativa portuaria",
  },
  icons: {
    icon:  "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0d1b35" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="antialiased min-h-svh">
        <SessionProvider>
          <SentryUserIdentifier />
          <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
            <NextIntlClientProvider messages={messages}>
              <LoadingProvider>{children}</LoadingProvider>
            </NextIntlClientProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
