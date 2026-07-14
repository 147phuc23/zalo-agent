import useSWR, { useSWRConfig } from "swr";
import { Message } from "@/lib/types";

export function useMessages(conversationId: string | null) {
  const { cache, mutate } = useSWRConfig();

  const fetcher = async (url: string) => {
    // SWR v2 cache stores state as { data, error, isValidating }
    const cachedState = cache.get(url);
    const existingMessages: Message[] = cachedState?.data || [];
    
    const lastMsg = existingMessages[existingMessages.length - 1];
    const after = lastMsg ? lastMsg.createdAt : "";

    const fetchUrl = after 
      ? `${url}?after=${encodeURIComponent(after)}` 
      : url;

    const res = await fetch(fetchUrl);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Failed to fetch messages");

    const newMessages: Message[] = data.messages || [];

    if (after) {
      // Return the merged messages list. SWR will cache this new merged array.
      // Filter out duplicates in case of timing/clock race conditions.
      const existingIds = new Set(existingMessages.map((m) => m.id));
      const filteredNew = newMessages.filter((m) => !existingIds.has(m.id));
      return [...existingMessages, ...filteredNew];
    }
    return newMessages;
  };

  const { data, error, isLoading } = useSWR<Message[]>(
    conversationId ? `/api/inbox/conversations/${conversationId}/messages` : null,
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      // Keep previous conversation's messages showing while loading the next one
      keepPreviousData: false,
    }
  );

  return {
    messages: data || [],
    error,
    isLoading,
    mutate: (
      newMessages?: Message[] | ((current?: Message[]) => Message[]),
      options?: any
    ) => {
      if (conversationId) {
        return mutate(
          `/api/inbox/conversations/${conversationId}/messages`,
          newMessages,
          options
        );
      }
    },
  };
}
