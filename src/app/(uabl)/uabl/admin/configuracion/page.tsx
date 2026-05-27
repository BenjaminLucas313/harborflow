"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Save } from "lucide-react";

export default function ConfiguracionPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/company")
      .then((r) => r.json())
      .then((data: { emailAdministrador?: string }) => {
        setEmail(data.emailAdministrador ?? "");
        setLoading(false);
      })
      .catch(() => {
        setError("No se pudo cargar la configuración.");
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/admin/company", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ emailAdministrador: email || null }),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Error al guardar.");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10 space-y-8">
      <div>
        <button
          onClick={() => router.back()}
          className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
        >
          ← Volver
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configurá las opciones generales de la empresa.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-100 p-2.5">
            <Mail className="size-5 text-violet-700" />
          </div>
          <div>
            <p className="font-semibold">Email del administrador</p>
            <p className="text-sm text-muted-foreground">
              Destinatario del resumen mensual consolidado de operaciones.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground animate-pulse">Cargando...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="emailAdmin" className="text-sm font-medium">
                Email
              </label>
              <input
                id="emailAdmin"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@empresa.com"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Dejá vacío para no enviar el email mensual de administración.
              </p>
            </div>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            {success && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 border border-emerald-200">
                ✓ Guardado correctamente.
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Save className="size-4" />
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
