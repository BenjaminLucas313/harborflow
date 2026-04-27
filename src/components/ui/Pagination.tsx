"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page:       number;
  totalPages: number;
  total:      number;
  paramName?: string;
};

export function Pagination({ page, totalPages, total, paramName = "page" }: Props) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function navigate(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, String(newPage));
    router.push(`?${params.toString()}`);
  }

  const btnBase =
    "flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="flex items-center justify-between gap-4 pt-4">
      <button
        onClick={() => navigate(page - 1)}
        disabled={page <= 1}
        className={btnBase}
        aria-label="Página anterior"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Anterior
      </button>

      <span className="text-sm text-muted-foreground text-center">
        Página {page} de {totalPages}{" "}
        <span className="text-muted-foreground/60">({total} resultados)</span>
      </span>

      <button
        onClick={() => navigate(page + 1)}
        disabled={page >= totalPages}
        className={btnBase}
        aria-label="Página siguiente"
      >
        Siguiente
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
