// Operator dashboard at /operator.
// Trip manifest, check-in queue, port status controls.

import Link from "next/link";

export default function OperatorPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Panel de operaciones</h1>
      <nav className="mt-6">
        <ul className="space-y-2">
          <li>
            <Link
              href="/operator/trips"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Viajes →
            </Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
