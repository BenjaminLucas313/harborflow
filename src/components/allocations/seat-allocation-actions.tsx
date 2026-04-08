"use client";
// SeatAllocationActions — client component for COMPANY_REP to add seats and submit allocation.
// Includes: employee search combobox, work type select, submit button.

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Employee = { id: string; firstName: string; lastName: string; email: string };
type WorkType = { id: string; name: string; departmentId: string };
type Department = { id: string; name: string; workTypes: WorkType[] };

export function SeatAllocationActions({
  allocationId,
  tripId,
  isDraft,
  isSubmitted,
  capacity,
  takenSeats,
}: {
  allocationId: string;
  tripId: string;
  isDraft: boolean;
  isSubmitted: boolean;
  capacity: number;
  takenSeats: number;
}) {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const availableSeats = capacity - takenSeats;

  // Load work types once.
  useEffect(() => {
    if (!isDraft) return;
    fetch("/api/work-types")
      .then((r) => r.json())
      .then(setDepartments)
      .catch(() => {});
  }, [isDraft]);

  // Debounced employee search.
  useEffect(() => {
    if (employeeQuery.length < 2) {
      setEmployees([]);
      setShowDropdown(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/employees/search?q=${encodeURIComponent(employeeQuery)}`)
        .then((r) => r.json())
        .then((data: Employee[]) => {
          setEmployees(data);
          setShowDropdown(data.length > 0);
        })
        .catch(() => {});
    }, 300);
  }, [employeeQuery]);

  async function handleAddSeat() {
    if (!selectedEmployee || !selectedWorkTypeId) {
      setError("Seleccioná un empleado y un tipo de trabajo.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/allocations/${allocationId}/seats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          workTypeId: selectedWorkTypeId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al agregar asiento");
        return;
      }
      // Reset form.
      setSelectedEmployee(null);
      setEmployeeQuery("");
      setSelectedWorkTypeId("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/allocations/${allocationId}/submit`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al enviar");
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!isDraft && !isSubmitted) return null;

  return (
    <section className="space-y-4">

      {isDraft && (
        <>
          {/* Add seat form */}
          <div className="rounded-xl border bg-white p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Agregar asiento</h2>

            {availableSeats <= 0 && (
              <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                La embarcación está al máximo de capacidad ({capacity} lugares).
              </p>
            )}

            {/* Employee search */}
            <div className="relative">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Empleado
              </label>
              {selectedEmployee ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2">
                  <span className="text-sm font-medium text-gray-900">
                    {selectedEmployee.firstName} {selectedEmployee.lastName}
                    <span className="ml-2 text-xs text-gray-500">{selectedEmployee.email}</span>
                  </span>
                  <button
                    onClick={() => { setSelectedEmployee(null); setEmployeeQuery(""); }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={employeeQuery}
                    onChange={(e) => setEmployeeQuery(e.target.value)}
                    placeholder="Buscar por nombre o email…"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {showDropdown && employees.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                      {employees.map((emp) => (
                        <li key={emp.id}>
                          <button
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setEmployeeQuery(`${emp.firstName} ${emp.lastName}`);
                              setShowDropdown(false);
                            }}
                          >
                            <span className="font-medium">{emp.firstName} {emp.lastName}</span>
                            <span className="ml-2 text-xs text-gray-500">{emp.email}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {employeeQuery.length >= 2 && employees.length === 0 && (
                    <p className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-lg">
                      Sin resultados para "{employeeQuery}"
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Work type select */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Tipo de trabajo
              </label>
              <select
                value={selectedWorkTypeId}
                onChange={(e) => setSelectedWorkTypeId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Seleccionar…</option>
                {departments.map((dept) => (
                  <optgroup key={dept.id} label={dept.name}>
                    {dept.workTypes.map((wt) => (
                      <option key={wt.id} value={wt.id}>
                        {wt.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={handleAddSeat}
              disabled={loading || !selectedEmployee || !selectedWorkTypeId || availableSeats <= 0}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Agregando…" : "Agregar asiento"}
            </button>
          </div>

          {/* Submit to UABL */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
            <h2 className="font-semibold text-gray-900">Enviar a UABL para confirmación</h2>
            <p className="mt-1 text-sm text-gray-500">
              Una vez enviada, la solicitud no podrá modificarse hasta que UABL confirme o rechace los asientos.
            </p>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? "Enviando…" : "Enviar solicitud a UABL"}
            </button>
          </div>
        </>
      )}

      {isSubmitted && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-medium text-blue-800">
            Solicitud enviada a UABL. Esperando confirmación de asientos.
          </p>
          <p className="mt-1 text-xs text-blue-600">
            Los empleados serán notificados cuando UABL confirme sus asientos.
          </p>
        </div>
      )}

    </section>
  );
}
