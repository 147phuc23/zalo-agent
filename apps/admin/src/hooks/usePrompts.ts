import useSWR from "swr";
import { PromptVersion } from "@/lib/types";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Failed to fetch prompts");
  return data.versions as PromptVersion[];
};

export function usePrompts() {
  const { data, error, isLoading, mutate } = useSWR<PromptVersion[]>(
    "/api/prompts?listAll=true",
    fetcher
  );

  return {
    promptVersions: data || [],
    error,
    isLoading,
    mutate,
  };
}
