import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Audit } from "@/lib/types";

export function useAudits(conversationId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["audits", conversationId];

  const { data, error, isLoading } = useQuery<Audit[]>({
    queryKey,
    queryFn: async () => {
      if (!conversationId) return [];

      const existingAudits = queryClient.getQueryData<Audit[]>(queryKey) || [];
      const lastAudit = existingAudits[existingAudits.length - 1];
      const after = lastAudit ? lastAudit.created_at : "";

      const url = `/api/conversations/${conversationId}/audits`;
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
    },
    enabled: !!conversationId,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  return {
    audits: data || [],
    error: error as Error | null,
    isLoading,
    mutate: (
      newAudits?: Audit[] | ((current?: Audit[]) => Audit[]),
      options?: any
    ) => {
      if (!conversationId) return;
      if (typeof newAudits === "function") {
        const current = queryClient.getQueryData<Audit[]>(queryKey);
        queryClient.setQueryData(queryKey, newAudits(current));
      } else if (newAudits) {
        queryClient.setQueryData(queryKey, newAudits);
      } else {
        queryClient.invalidateQueries({ queryKey });
      }
    },
  };
}
