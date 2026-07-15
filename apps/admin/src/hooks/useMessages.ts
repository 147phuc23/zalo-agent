import useSWR, { useSWRConfig } from "swr";
import { Message } from "@/lib/types";

export function useMessages(conversationId: string | null) {
  const { cache, mutate } = useSWRConfig();

  const fetcher = async (url: string) => {
    // SWR v2 cache stores state as { data, error, isValidating }
    const cachedState = cache.get(url);
    const existingMessages: Message[] = cachedState?.data || [];
    
    // Ignore optimistic messages when determining the last message timestamp for the 'after' filter
    const realMessages = existingMessages.filter((m) => !m.id.startsWith("optimistic-"));
    const lastMsg = realMessages[realMessages.length - 1];
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
      const updatedMessages = [...existingMessages];
      const filteredNew = newMessages.filter((newMsg) => {
        // Skip if ID already exists
        if (existingMessages.some((m) => m.id === newMsg.id)) {
          return false;
        }
        // If it matches an optimistic message by idempotencyKey, replace it in-place
        if (newMsg.idempotencyKey) {
          const idx = updatedMessages.findIndex(
            (m) => m.idempotencyKey === newMsg.idempotencyKey && m.id.startsWith("optimistic-")
          );
          if (idx !== -1) {
            updatedMessages[idx] = newMsg;
            return false;
          }
        }
        return true;
      });
      return [...updatedMessages, ...filteredNew];
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
