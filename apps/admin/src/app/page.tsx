import Link from "next/link";

type Conversation = {
  id: string;
  channel: string;
  externalThreadId: string;
  status: string;
  lastActivityAt: string;
  contact: { displayName: string | null; externalUserId: string } | null;
};

export default async function Home() {
  const res = await fetch("/api/inbox/conversations", { cache: "no-store" });
  const data = (await res.json()) as { ok: boolean; conversations?: Conversation[] };
  const conversations = data.conversations ?? [];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,208,130,0.18),_transparent_34%),linear-gradient(180deg,_#f8f3ea_0%,_#f3efe8_44%,_#ebe7dd_100%)] p-6 font-sans text-stone-950">
      <header className="mb-6 max-w-5xl">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
          Zalo x Twenty
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Inbox</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Read-only operator view for the seeded demo tenants. Conversations update
          from the API proxy and internal Supabase-backed runtime.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {conversations.map((c) => (
          <Link
            key={c.id}
            href={`/conversation/${c.id}`}
            className="rounded-2xl border border-stone-200/80 bg-white/80 p-4 shadow-[0_18px_45px_rgba(71,55,31,0.06)] transition hover:-translate-y-0.5 hover:border-stone-300 hover:bg-white"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium text-stone-950">
                {c.contact?.displayName ?? c.contact?.externalUserId ?? "Unknown contact"}
              </div>
              <div className="text-xs text-stone-500">
                {new Date(c.lastActivityAt).toLocaleString()}
              </div>
            </div>
            <div className="mt-1 text-sm text-stone-600">
              {c.channel} · {c.status} · {c.externalThreadId}
            </div>
          </Link>
        ))}

        {conversations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white/70 p-6 text-sm text-stone-500">
            No conversations yet. Send a Zalo message or POST `/internal/events`.
          </div>
        ) : null}
      </div>
    </div>
  );
}
