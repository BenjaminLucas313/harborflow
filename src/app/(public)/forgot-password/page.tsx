"use client";

import { useState } from "react";
import Link         from "next/link";
import { Anchor, Loader2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email,     setEmail]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await fetch("/api/auth/forgot-password", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email }),
    }).catch(() => null);

    // Always show the generic message — don't reveal if the email exists.
    setLoading(false);
    setSubmitted(true);
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
              Recuperación de contraseña
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-7 shadow-xl backdrop-blur-md">
          {submitted ? (
            <div className="space-y-4 text-center">
              <div
                className="mx-auto flex size-12 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(74,222,128,0.12)" }}
              >
                <svg viewBox="0 0 24 24" className="size-6 text-green-400" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-semibold text-[16px]">Revisá tu correo</p>
              <p className="text-white/65 text-sm leading-relaxed">
                Si el correo existe en el sistema, recibirás las instrucciones para restablecer tu contraseña.
              </p>
              <Link
                href="/login"
                className="mt-2 flex items-center justify-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-[20px] font-semibold mb-1 text-white">
                Olvidé mi contraseña
              </h2>
              <p className="text-sm text-white/55 mb-6">
                Ingresá tu correo y te enviaremos las instrucciones.
              </p>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-medium text-white/75">
                    Correo electrónico
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full rounded-lg border border-white/15 bg-white/8 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Enviando…</>
                  ) : (
                    "Enviar instrucciones"
                  )}
                </button>
              </form>

              <div className="mt-5 text-center">
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  <ArrowLeft size={13} aria-hidden="true" />
                  Volver al inicio de sesión
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
