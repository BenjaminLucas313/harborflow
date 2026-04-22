"use client";

// UsuariosPanel — list of users + create user form for UABL admins.

import { useState } from "react";
import { Plus, UserCheck, UserX } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserRow = {
  id:          string;
  email:       string;
  firstName:   string;
  lastName:    string;
  role:        string;
  isActive:    boolean;
  isUablAdmin: boolean;
  createdAt:   Date | string;
  branch?:     { name: string } | null;
  department?: { name: string } | null;
};

type Branch = { id: string; name: string };
type Dept   = { id: string; name: string };

type Props = {
  users:       UserRow[];
  branches:    Branch[];
  departments: Dept[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_LABEL: Record<string, string> = {
  UABL:      "UABL",
  PROVEEDOR: "Proveedor",
  EMPRESA:   "Empresa",
  USUARIO:   "Usuario",
};

const ROLE_COLOR: Record<string, string> = {
  UABL:      "bg-violet-100 text-violet-700",
  PROVEEDOR: "bg-blue-100 text-blue-700",
  EMPRESA:   "bg-amber-100 text-amber-700",
  USUARIO:   "bg-slate-100 text-slate-600",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UsuariosPanel({ users: initial, branches, departments }: Props) {
  const [users,       setUsers]       = useState<UserRow[]>(initial);
  const [showForm,    setShowForm]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState<string | null>(null);

  // Form state
  const [email,        setEmail]        = useState("");
  const [firstName,    setFirstName]    = useState("");
  const [lastName,     setLastName]     = useState("");
  const [role,         setRole]         = useState("UABL");
  const [branchId,     setBranchId]     = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [isUablAdmin,  setIsUablAdmin]  = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const res = await fetch("/api/admin/usuarios", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        email,
        firstName,
        lastName,
        role,
        branchId:     branchId     || undefined,
        departmentId: departmentId || undefined,
        isUablAdmin:  role === "UABL" ? isUablAdmin : false,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message: string } };
      setError(body.error?.message ?? "Error al crear el usuario.");
      return;
    }

    const body = await res.json() as { data: { id: string; email: string } };
    setSuccess(`Usuario ${body.data.email} creado correctamente.`);

    // Refresh list
    const listRes = await fetch("/api/admin/usuarios");
    if (listRes.ok) {
      const listBody = await listRes.json() as { data: UserRow[] };
      setUsers(listBody.data);
    }

    // Reset form
    setEmail(""); setFirstName(""); setLastName("");
    setRole("UABL"); setBranchId(""); setDepartmentId(""); setIsUablAdmin(false);
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      {/* ── Create button ─────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setError(null); setSuccess(null); }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-4" />
          Nuevo usuario
        </button>
      </div>

      {/* ── Create form ───────────────────────────────────────────────────── */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-border bg-card p-6 space-y-4"
        >
          <h2 className="text-base font-semibold">Crear nuevo usuario</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nombre <span className="text-red-500">*</span></label>
              <input
                required value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Apellido <span className="text-red-500">*</span></label>
              <input
                required value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Correo electrónico <span className="text-red-500">*</span></label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div
            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-700"
            style={{ fontSize: "13px" }}
          >
            Se generará una contraseña temporal y se enviará al correo del usuario.
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Rol <span className="text-red-500">*</span></label>
              <select
                value={role} onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="UABL">UABL</option>
                <option value="PROVEEDOR">Proveedor</option>
                <option value="EMPRESA">Empresa</option>
                <option value="USUARIO">Usuario</option>
              </select>
            </div>

            {branches.length > 0 && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Puerto</label>
                <select
                  value={branchId} onChange={(e) => setBranchId(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Sin asignar</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {role === "UABL" && departments.length > 0 && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Departamento</label>
              <select
                value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Sin asignar</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          {role === "UABL" && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox" checked={isUablAdmin} onChange={(e) => setIsUablAdmin(e.target.checked)}
                className="rounded"
              />
              Administrador UABL (puede gestionar departamentos, tipos de trabajo y usuarios)
            </label>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-input px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Creando…" : "Crear usuario"}
            </button>
          </div>
        </form>
      )}

      {success && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {success}
        </p>
      )}

      {/* ── User list ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Usuarios ({users.length})</h2>
        </div>

        {users.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No hay usuarios registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 text-left font-medium">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium">Correo</th>
                  <th className="px-4 py-3 text-left font-medium">Rol</th>
                  <th className="px-4 py-3 text-left font-medium">Puerto / Depto</th>
                  <th className="px-4 py-3 text-center font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium">
                      {u.firstName} {u.lastName}
                      {u.isUablAdmin && (
                        <span className="ml-2 text-xs text-violet-600">(admin)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", ROLE_COLOR[u.role] ?? "bg-slate-100 text-slate-600")}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {[u.branch?.name, u.department?.name].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.isActive
                        ? <UserCheck className="size-4 text-emerald-600 mx-auto" />
                        : <UserX    className="size-4 text-red-500 mx-auto" />
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
