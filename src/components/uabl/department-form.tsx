"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  companyId: string;
};

export function DepartmentForm({ companyId }: Props) {
  const router = useRouter();
  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [open,        setOpen]        = useState(false);

  // companyId is passed but not sent to the API — the server derives it from the session.
  void companyId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch("/api/departments", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name:        name.trim(),
        description: description.trim() || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Error al crear el departamento.");
      return;
    }

    setName("");
    setDescription("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        + Crear nuevo departamento
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <h2 className="font-semibold text-sm">Nuevo departamento</h2>

      <div className="space-y-1">
        <label className="text-sm font-medium">Nombre <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Operaciones, Mantenimiento…"
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Descripción</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción opcional"
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? "Creando…" : "Crear"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
