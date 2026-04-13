import { redirect } from "next/navigation";
import Link from "next/link";
import { Ship, MapPin, Clock, Anchor, Send } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProveedorDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const { companyId } = session.user;

  // Today's trips.
  const today    = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  today.setHours(0, 0, 0, 0);
  tomorrow.setHours(0, 0, 0, 0);

  const todayTrips = await prisma.trip.findMany({
    where: {
      companyId,
      departureTime: { gte: today, lt: tomorrow },
      status: { in: ["SCHEDULED", "BOARDING", "DELAYED"] },
    },
    select: {
      id:            true,
      departureTime: true,
      status:        true,
      capacity:      true,
      boat:          { select: { name: true } },
      branch:        { select: { name: true } },
      passengerSlots: {
        where:  { status: { in: ["PENDING", "CONFIRMED"] } },
        select: { id: true },
      },
    },
    orderBy: { departureTime: "asc" },
  });

  // Current port status.
  const branch = await prisma.branch.findFirst({
    where:  { companyId, isActive: true },
    select: { id: true },
  });
  const portStatus = branch
    ? await prisma.portStatus.findFirst({
        where:   { branchId: branch.id },
        orderBy: { createdAt: "desc" },
        select:  { status: true, message: true },
      })
    : null;

  const portOpen = !portStatus || portStatus.status === "OPEN";

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Panel de operaciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestioná tu flota, viajes y el estado del puerto.
        </p>
      </div>

      {/* Port status banner */}
      <div className={`rounded-2xl border px-5 py-4 flex items-center justify-between gap-3 ${
        portOpen
          ? "border-emerald-200 bg-emerald-50"
          : "border-red-200 bg-red-50"
      }`}>
        <div>
          <p className={`font-semibold ${portOpen ? "text-emerald-800" : "text-red-800"}`}>
            Puerto: {portOpen ? "Abierto" : "Cerrado"}
          </p>
          {portStatus?.message && (
            <p className={`text-sm mt-0.5 ${portOpen ? "text-emerald-700" : "text-red-700"}`}>
              {portStatus.message}
            </p>
          )}
        </div>
        <Link
          href="/proveedor/puerto"
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            portOpen
              ? "bg-emerald-700 text-white hover:bg-emerald-800"
              : "bg-red-700 text-white hover:bg-red-800"
          }`}
        >
          {portOpen ? "Cerrar puerto" : "Abrir puerto"}
        </Link>
      </div>

      {/* Today's trips */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Viajes de hoy ({todayTrips.length})</h2>
          <Link href="/proveedor/viajes" className="text-sm text-primary hover:underline">
            Ver todos
          </Link>
        </div>

        {todayTrips.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No hay viajes programados para hoy.</p>
        ) : (
          <ul className="space-y-2">
            {todayTrips.map((trip) => {
              const dep = new Date(trip.departureTime).toLocaleTimeString("es-AR", {
                timeZone: "America/Argentina/Buenos_Aires",
                hour:     "2-digit",
                minute:   "2-digit",
              });
              return (
                <li key={trip.id}>
                  <Link
                    href={`/proveedor/viajes/${trip.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="size-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-medium">{dep} — {trip.boat.name}</p>
                        <p className="text-xs text-muted-foreground">{trip.branch.name}</p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {trip.passengerSlots.length}/{trip.capacity}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Navigation */}
      <nav className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/proveedor/barcos",      icon: Ship,   label: "Barcos",      desc: "Gestionar la flota y capacidades." },
          { href: "/proveedor/viajes",      icon: Anchor, label: "Viajes",      desc: "Crear y editar viajes programados." },
          { href: "/proveedor/puerto",      icon: MapPin, label: "Puerto",      desc: "Abrir, cerrar y comunicar el estado." },
          { href: "/proveedor/solicitudes", icon: Send,   label: "Solicitudes", desc: "Revisar pedidos de lancha bajo demanda." },
        ].map(({ href, icon: Icon, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
          >
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-primary/10 p-2">
                <Icon className="size-4 text-primary" />
              </div>
              <span className="font-semibold">{label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </Link>
        ))}
      </nav>
    </main>
  );
}
