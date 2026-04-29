"use client";

import { Anchor } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center gap-6">
      <div className="rounded-2xl bg-muted/50 p-6">
        <Anchor className="mx-auto size-12 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Sin conexión</h1>
        <p className="text-muted-foreground max-w-xs">
          Entrá al checklist de tu viaje antes de zarpar para que funcione sin internet.
        </p>
      </div>

      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Reintentar
      </button>
    </main>
  );
}
