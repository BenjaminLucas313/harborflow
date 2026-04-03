// Admin dashboard at /admin.
// Fleet, schedules, users, analytics, audit log.

import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Panel de administración</h1>
      <nav className="mt-6">
        <ul className="space-y-2">
          <li>
            <Link
              href="/admin/trips"
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
