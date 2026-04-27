export const PAGE_SIZE = 20;

/** For API route handlers that receive a URLSearchParams object. */
export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const skip = (page - 1) * PAGE_SIZE;
  return { page, skip, take: PAGE_SIZE };
}

/**
 * For App Router server pages where searchParams is a plain object.
 * Supports multiple paginators on one page via a named param.
 */
export function getPageParam(
  searchParams: Record<string, string | string[] | undefined>,
  paramName = "page",
): { page: number; skip: number; take: number } {
  const raw  = searchParams[paramName];
  const page = Math.max(1, parseInt((typeof raw === "string" ? raw : "1"), 10));
  return { page, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE };
}

export type PaginationMeta = {
  total:      number;
  page:       number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
};

export function buildPaginationMeta(total: number, page: number): PaginationMeta {
  // Ensure at least 1 page even when total is 0.
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return {
    total,
    page,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
