import useSWR from "swr";
import { Conversation } from "@/lib/types";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Failed to fetch conversations");
  return data.conversations as Conversation[];
};

export function useConversations() {
  const { data, error, isLoading, mutate } = useSWR<Conversation[]>(
    "/api/inbox/conversations",
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
    }
  );

  return {
    conversations: data || [],
    error,
    isLoading,
    mutate,
  };
}
