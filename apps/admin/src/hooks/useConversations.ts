import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Conversation } from "@/lib/types";

export function useConversations() {
  const queryClient = useQueryClient();
  const queryKey = ["conversations"];

  const { data, error, isLoading } = useQuery<Conversation[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch("/api/inbox/conversations");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to fetch conversations");
      return data.conversations as Conversation[];
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  return {
    conversations: data || [],
    error: error as Error | null,
    isLoading,
    mutate: (
      updater?: Conversation[] | ((prev: Conversation[] | undefined) => Conversation[]),
      options?: any
    ) => {
      if (typeof updater === "function") {
        const current = queryClient.getQueryData<Conversation[]>(queryKey);
        queryClient.setQueryData(queryKey, updater(current));
      } else if (updater !== undefined) {
        queryClient.setQueryData(queryKey, updater);
      } else {
        queryClient.invalidateQueries({ queryKey });
      }
    },
  };
}
