import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Message } from "@/lib/types";

export function useMessages(conversationId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["messages", conversationId];

  const { data, error, isLoading } = useQuery<Message[]>({
    queryKey,
    queryFn: async () => {
      if (!conversationId) return [];

      const existingMessages = queryClient.getQueryData<Message[]>(queryKey) || [];

      // Ignore optimistic messages when determining the last message timestamp for the 'after' filter
      const realMessages = existingMessages.filter((m) => !m.id.startsWith("optimistic-"));
      const lastMsg = realMessages[realMessages.length - 1];
      const after = lastMsg ? lastMsg.createdAt : "";

      const url = `/api/inbox/conversations/${conversationId}/messages`;
      const fetchUrl = after
        ? `${url}?after=${encodeURIComponent(after)}`
        : url;

      const res = await fetch(fetchUrl);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to fetch messages");

      const newMessages: Message[] = data.messages || [];

      if (after) {
        // Return the merged messages list.
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
    },
    enabled: !!conversationId,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  return {
    messages: data || [],
    error: error as Error | null,
    isLoading,
    mutate: (
      newMessages?: Message[] | ((current?: Message[]) => Message[]),
      options?: any
    ) => {
      if (!conversationId) return;
      if (typeof newMessages === "function") {
        const current = queryClient.getQueryData<Message[]>(queryKey);
        queryClient.setQueryData(queryKey, newMessages(current));
      } else if (newMessages) {
        queryClient.setQueryData(queryKey, newMessages);
      } else {
        queryClient.invalidateQueries({ queryKey });
      }
    },
  };
}
