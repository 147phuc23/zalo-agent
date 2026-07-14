import useSWR, { useSWRConfig } from "swr";
import { Audit } from "@/lib/types";

export function useAudits(conversationId: string | null) {
  const { cache, mutate } = useSWRConfig();

  const fetcher = async (url: string) => {
    const cachedState = cache.get(url);
    const existingAudits: Audit[] = cachedState?.data || [];
    
    const lastAudit = existingAudits[existingAudits.length - 1];
    const after = lastAudit ? lastAudit.created_at : "";

    const fetchUrl = after 
      ? `${url}?after=${encodeURIComponent(after)}` 
      : url;

    const res = await fetch(fetchUrl);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Failed to fetch audits");

    const newAudits: Audit[] = data.audits || [];

    if (after) {
      const existingIds = new Set(existingAudits.map((a) => a.id));
      const filteredNew = newAudits.filter((a) => !existingIds.has(a.id));
      return [...existingAudits, ...filteredNew];
    }
    return newAudits;
  };

  const { data, error, isLoading } = useSWR<Audit[]>(
    conversationId ? `/api/conversations/${conversationId}/audits` : null,
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      keepPreviousData: false,
    }
  );

  return {
    audits: data || [],
    error,
    isLoading,
    mutate: (
      newAudits?: Audit[] | ((current?: Audit[]) => Audit[]),
      options?: any
    ) => {
      if (conversationId) {
        return mutate(
          `/api/conversations/${conversationId}/audits`,
          newAudits,
          options
        );
      }
    },
  };
}
