"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Anchor, RotateCcw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      Sentry.captureException(error);
    } else {
      console.error(error);
    }
  }, [error]);

  return (
    <main className="min-h-svh bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100 flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <Anchor className="h-10 w-10 text-destructive" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Algo salió mal</h1>
          <p className="text-sm text-muted-foreground">
            Lamentamos los inconvenientes. Estamos trabajando para solucionarlo.
          </p>
          {process.env.NODE_ENV !== "production" && (
            <pre className="mt-2 rounded-lg bg-muted px-4 py-2 text-xs text-left font-mono text-muted-foreground break-all whitespace-pre-wrap">
              {error.message}
            </pre>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Reintentar
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
