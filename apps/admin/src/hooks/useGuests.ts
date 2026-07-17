import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface GuestAccess {
  id: string;
  tenant_id: string;
  invite_code: string;
  status: "pending" | "claimed" | "revoked";
  password_hash: string | null;
  display_name: string | null;
  profile: Record<string, unknown>;
  contact_id: string | null;
  conversation_id: string | null;
  session_token_hash: string | null;
  created_at: string;
  claimed_at: string | null;
  last_seen_at: string | null;
}

export function useGuests() {
  const queryClient = useQueryClient();
  const queryKey = ["guests"];

  const { data, error, isLoading } = useQuery<GuestAccess[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch("/api/admin/guests");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to fetch guest list");
      return data.guests as GuestAccess[];
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  return {
    guests: data || [],
    error: error as Error | null,
    isLoading,
    mutate: () => queryClient.invalidateQueries({ queryKey }),
  };
}
