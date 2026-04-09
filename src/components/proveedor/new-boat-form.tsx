"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = {
  branches: { id: string; name: string }[];
};

export function NewBoatForm({ branches }: Props) {
  const router = useRouter();

  const [name,        setName]        = useState("");
  const [branchId,    setBranchId]    = useState(branches[0]?.id ?? "");
  const [capacity,    setCapacity]    = useState("");
  const [description, setDescription] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cap = parseInt(capacity, 10);
    if (!name.trim() || !branchId || isNaN(cap) || cap <= 0) {
      setError("Completá los campos obligatorios.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch("/api/boats", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        branchId,
        name:        name.trim(),
        capacity:    cap,
        description: description.trim() || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? body.error ?? "Error al crear la embarcación.");
      return;
    }

    router.push("/proveedor/barcos");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <Link href="/proveedor/barcos" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Volver a barcos
      </Link>

      <div className="space-y-1">
        <label className="text-sm font-medium">Puerto <span className="text-red-500">*</span></label>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Nombre <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Lancha Rosario I"
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Capacidad (pasajeros) <span className="text-red-500">*</span></label>
        <input
          type="number"
          min="1"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">
          Descripción <span className="text-muted-foreground text-xs">(opcional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? "Creando…" : "Crear embarcación"}
      </button>
    </form>
  );
}
