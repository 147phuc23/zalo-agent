import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PromptVersion } from "@/lib/types";

export function usePrompts() {
  const queryClient = useQueryClient();
  const queryKey = ["prompts"];

  const { data, error, isLoading } = useQuery<PromptVersion[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch("/api/prompts?listAll=true");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to fetch prompts");
      return data.versions as PromptVersion[];
    },
  });

  return {
    promptVersions: data || [],
    error: error as Error | null,
    isLoading,
    mutate: () => queryClient.invalidateQueries({ queryKey }),
  };
}
