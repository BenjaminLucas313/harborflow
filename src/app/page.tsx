import Link from "next/link";
import { Anchor } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4 py-16">
      <div className="text-center space-y-6 max-w-md">
        {/* Brand mark */}
        <div className="flex justify-center">
          <div className="rounded-3xl bg-white/10 backdrop-blur-sm p-5 ring-1 ring-white/20 shadow-xl">
            <Anchor className="size-11 text-white" aria-hidden="true" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            HarborFlow
          </h1>
          <p className="text-base text-white/60 leading-relaxed">
            Launch reservation and operations platform
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-white/90 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
