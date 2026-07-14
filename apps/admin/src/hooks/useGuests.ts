import useSWR from "swr";

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

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Failed to fetch guest list");
  return data.guests as GuestAccess[];
};

export function useGuests() {
  const { data, error, isLoading, mutate } = useSWR<GuestAccess[]>(
    "/api/admin/guests",
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
    }
  );

  return {
    guests: data || [],
    error,
    isLoading,
    mutate,
  };
}
