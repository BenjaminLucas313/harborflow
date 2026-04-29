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
  title: "HarborFlow",
  description: "Plataforma de reservas y operaciones de lanchas",
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
