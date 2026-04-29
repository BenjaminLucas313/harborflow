"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed,      setDismissed]      = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
  }

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
      <Download className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <p className="flex-1 text-sm text-foreground">
        Instalá HarborFlow en tu celular para usarlo sin internet.
      </p>
      <button
        type="button"
        onClick={handleInstall}
        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Instalar
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Cerrar banner de instalación"
        className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
