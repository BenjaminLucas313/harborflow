"use client";

import { useState, use }       from "react";
import { useRouter }           from "next/navigation";
import Link                    from "next/link";
import { Anchor, Eye, EyeOff, Loader2 } from "lucide-react";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = use(searchParams);

  const router = useRouter();

  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);

  const mismatch   = confirm.length > 0 && password !== confirm;
  const tooShort   = password.length > 0 && password.length < 8;
  const canSubmit  = !!token && password.length >= 8 && password === confirm && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const res  = await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json() as { ok?: boolean; error?: { code: string; message: string } };

      if (!res.ok) {
        setError(data.error?.message ?? "Error al restablecer la contraseña.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.replace("/login?reset=ok"), 2000);
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
      setLoading(false);
    }
  }

  return (
    <main
      className="relative flex min-h-svh items-center justify-center px-4 py-12"
      style={{ background: "#020009" }}
    >
      <div className="relative w-full max-w-sm space-y-6" style={{ zIndex: 10 }}>
        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="rounded-2xl bg-primary p-3 shadow-sm">
              <Anchor className="size-7 text-primary-foreground" aria-hidden="true" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: "0.04em" }}>
              HarborFlow
            </h1>
            <p className="mt-1 text-sm text-white/65">
              Nueva contraseña
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-7 shadow-xl backdrop-blur-md">
          {!token ? (
            <div className="space-y-3 text-center">
              <p className="text-red-400 font-medium text-sm">Link inválido o expirado.</p>
              <Link href="/forgot-password" className="text-sm text-white/60 hover:text-white transition-colors">
                Solicitá uno nuevo →
              </Link>
            </div>
          ) : success ? (
            <div className="space-y-3 text-center">
              <div
                className="mx-auto flex size-12 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(74,222,128,0.12)" }}
              >
                <svg viewBox="0 0 24 24" className="size-6 text-green-400" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-semibold">¡Contraseña actualizada!</p>
              <p className="text-white/60 text-sm">Redirigiendo al inicio de sesión…</p>
            </div>
          ) : (
            <>
              <h2 className="text-[20px] font-semibold mb-1 text-white">
                Restablecer contraseña
              </h2>
              <p className="text-sm text-white/55 mb-6">
                Elegí una nueva contraseña de al menos 8 caracteres.
              </p>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Nueva contraseña */}
                <div className="space-y-1.5">
                  <label htmlFor="newPwd" className="block text-sm font-medium text-white/75">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="newPwd"
                      type={showPass ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-invalid={tooShort}
                      className="w-full rounded-lg border border-white/15 bg-white/8 px-3 py-2.5 pr-10 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {tooShort && (
                    <p className="text-xs text-red-400">Mínimo 8 caracteres.</p>
                  )}
                </div>

                {/* Confirmar */}
                <div className="space-y-1.5">
                  <label htmlFor="confirmPwd" className="block text-sm font-medium text-white/75">
                    Confirmar contraseña
                  </label>
                  <input
                    id="confirmPwd"
                    type={showPass ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    aria-invalid={mismatch}
                    className="w-full rounded-lg border border-white/15 bg-white/8 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {mismatch && (
                    <p className="text-xs text-red-400">Las contraseñas no coinciden.</p>
                  )}
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-lg px-3 py-2 text-sm"
                    style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Guardando…</>
                  ) : (
                    "Guardar nueva contraseña"
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
