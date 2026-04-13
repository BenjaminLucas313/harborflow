import type { ZodError } from "zod";

/**
 * Converts a ZodError into a flat map of field path → first error message.
 * Nested paths are joined with "." (e.g. "address.street").
 * Root-level errors (no path) are stored under the key "_root".
 */
export function parseZodError(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
