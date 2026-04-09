"use client";

// AddSlotPanel — EMPRESA component to add a passenger to a GroupBooking.
// Includes live search for USUARIO accounts by name.
// Department is selected first to filter work types — per business rule:
// sector is chosen per-slot, not fixed to the employer.

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, X } from "lucide-react";

type UsuarioResult = { id: string; firstName: string; lastName: string };
type Department    = { id: string; name: string };
type WorkType      = { id: string; name: string; code: string; departmentId: string };

type Props = {
  bookingId: string;
};

export function AddSlotPanel({ bookingId }: Props) {
  const router = useRouter();
  const [open, setOpen]                   = useState(false);
  const [query, setQuery]                 = useState("");
  const [results, setResults]             = useState<UsuarioResult[]>([]);
  const [selected, setSelected]           = useState<UsuarioResult | null>(null);
  const [departments, setDepartments]     = useState<Department[]>([]);
  const [departmentId, setDepartmentId]   = useState("");
  const [workTypes, setWorkTypes]         = useState<WorkType[]>([]);
  const [workTypeId, setWorkTypeId]       = useState("");
  const [representedCompany, setRepComp] = useState("");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const debounceRef                       = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load departments and all work types once on open.
  async function onOpen() {
    setOpen(true);
    if (departments.length === 0) {
      const [deptRes, wtRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/work-types"),
      ]);
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (wtRes.ok)   setWorkTypes(await wtRes.json());
    }
  }

  const filteredWorkTypes = departmentId
    ? workTypes.filter((wt) => wt.departmentId === departmentId)
    : workTypes;

  const onQueryChange = useCallback((value: string) => {
    setQuery(value);
    setSelected(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/usuarios/search?q=${encodeURIComponent(value)}`);
      if (res.ok) setResults(await res.json());
    }, 300);
  }, []);

  function selectUsuario(u: UsuarioResult) {
    setSelected(u);
    setQuery(`${u.firstName} ${u.lastName}`);
    setResults([]);
  }

  async function handleAdd() {
    if (!selected)                 { setError("Seleccioná un usuario de la lista."); return; }
    if (!workTypeId)               { setError("Seleccioná el tipo de trabajo."); return; }
    if (!representedCompany.trim()) { setError("Ingresá la empresa que representa."); return; }

    setLoading(true);
    setError(null);
    const res = await fetch(`/api/group-bookings/${bookingId}/slots`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        usuarioId:          selected.id,
        workTypeId,
        representedCompany: representedCompany.trim(),
      }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? body.error ?? "Error al agregar el pasajero.");
      return;
    }

    // Reset form and refresh.
    setSelected(null);
    setQuery("");
    setDepartmentId("");
    setWorkTypeId("");
    setRepComp("");
    setResults([]);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={onOpen}
        className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50 transition-colors w-full"
      >
        <UserPlus className="size-4" />
        Agregar pasajero
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Agregar pasajero</h3>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      {/* Search USUARIO */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Nombre del pasajero
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar por nombre o apellido…"
            className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Dropdown results */}
        {results.length > 0 && !selected && (
          <ul className="rounded-xl border border-border bg-card shadow-md overflow-hidden">
            {results.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => selectUsuario(u)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
                >
                  {u.firstName} {u.lastName}
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <p className="text-xs text-emerald-700 font-medium">
            ✓ {selected.firstName} {selected.lastName} seleccionado
          </p>
        )}
      </div>

      {/* Department selector — determines which sector this slot belongs to */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Sector / departamento
        </label>
        <select
          value={departmentId}
          onChange={(e) => { setDepartmentId(e.target.value); setWorkTypeId(""); }}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos los sectores</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Work type — filtered by selected department */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Tipo de trabajo</label>
        <select
          value={workTypeId}
          onChange={(e) => setWorkTypeId(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Seleccioná un tipo…</option>
          {filteredWorkTypes.map((wt) => (
            <option key={wt.id} value={wt.id}>{wt.name} ({wt.code})</option>
          ))}
        </select>
      </div>

      {/* Represented company */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Empresa que representa</label>
        <input
          type="text"
          value={representedCompany}
          onChange={(e) => setRepComp(e.target.value)}
          placeholder="Nombre de la empresa…"
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        onClick={handleAdd}
        disabled={loading}
        className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? "Agregando…" : "Agregar pasajero"}
      </button>
    </div>
  );
}
