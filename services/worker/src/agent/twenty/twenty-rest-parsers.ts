/**
 * Twenty REST responses vary slightly between core records API and metadata API.
 * These helpers extract arrays/objects without leaking raw shapes beyond the Twenty module.
 */

export function extractCoreManyRecords(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") return [];

  const record = payload as { data?: Record<string, unknown> };
  const data = record.data;
  if (!data || typeof data !== "object") return [];

  const values = Object.values(data).filter((value) => Array.isArray(value));
  if (values.length === 0) return [];

  const firstArray = values[0];
  return Array.isArray(firstArray) ? (firstArray as unknown[]) : [];
}

export function extractMetadataRows(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") return [];

  const top = payload as {
    data?: Record<string, unknown> | unknown[];
    objects?: unknown[];
    fields?: unknown[];
  };

  if (Array.isArray(top.data)) {
    return top.data as unknown[];
  }

  if (top.data && typeof top.data === "object" && !Array.isArray(top.data)) {
    const dataObj = top.data as Record<string, unknown>;
    if (Array.isArray(dataObj.objects)) return dataObj.objects as unknown[];
    if (Array.isArray(dataObj.fields)) return dataObj.fields as unknown[];

    const nestedArrays = Object.values(dataObj).filter((value) => Array.isArray(value));
    if (nestedArrays.length > 0 && Array.isArray(nestedArrays[0])) {
      return nestedArrays[0] as unknown[];
    }
  }

  if (Array.isArray(top.objects)) return top.objects;
  if (Array.isArray(top.fields)) return top.fields;

  return [];
}

export function pickFirstRecord(payload: unknown): Record<string, unknown> | null {
  const rows = extractCoreManyRecords(payload);
  const first = rows[0];
  if (first && typeof first === "object") return first as Record<string, unknown>;
  return null;
}
