"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

export function SubmitBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/group-bookings/${bookingId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "SUBMIT" }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? body.error ?? "Error al enviar.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
      >
        <Send className="size-4" />
        {loading ? "Enviando…" : "Enviar a UABL"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
