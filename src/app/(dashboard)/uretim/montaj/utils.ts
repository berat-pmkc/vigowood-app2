/** Safely parse workers JSONB field — handles string, array, or null */
export function parseWorkers(
  raw: unknown
): Array<{ id: string; name: string }> | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // invalid JSON
    }
  }
  return null;
}
