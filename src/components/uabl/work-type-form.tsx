"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  departments: { id: string; name: string }[];
};

export function WorkTypeForm({ departments }: Props) {
  const router = useRouter();
  const [name,         setName]         = useState("");
  const [code,         setCode]         = useState("");
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [open,         setOpen]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !departmentId) {
      setError("Completá todos los campos.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch("/api/work-types", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name:         name.trim(),
        code:         code.trim().toUpperCase(),
        departmentId,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Error al crear el tipo de trabajo.");
      return;
    }

    setName("");
    setCode("");
    setDepartmentId(departments[0]?.id ?? "");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        + Crear nuevo tipo de trabajo
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <h2 className="font-semibold text-sm">Nuevo tipo de trabajo</h2>

      <div className="space-y-1">
        <label className="text-sm font-medium">Departamento <span className="text-red-500">*</span></label>
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Nombre <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Mantenimiento eléctrico"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Código <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ej: ELECT"
            maxLength={10}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring uppercase"
          />
        </div>
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
