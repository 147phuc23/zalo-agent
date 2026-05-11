import Link from "next/link";

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  messageType: string;
  text: string | null;
  createdAt: string;
};

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const res = await fetch(`/api/inbox/conversations/${conversationId}/messages`, {
    cache: "no-store",
  });
  const data = (await res.json()) as { ok: boolean; messages?: Message[] };
  const messages = data.messages ?? [];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f8f3ea_0%,_#f3efe8_44%,_#ebe7dd_100%)] p-6 font-sans text-stone-950">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-950">Conversation</h1>
          <p className="text-xs text-stone-500">{conversationId}</p>
        </div>
        <Link href="/" className="text-sm font-medium text-stone-700 hover:text-stone-950">
          Back
        </Link>
      </header>

      <div className="space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={[
              "max-w-[720px] rounded-2xl border p-3 shadow-[0_10px_30px_rgba(71,55,31,0.05)]",
              m.direction === "inbound"
                ? "border-stone-200 bg-white/85"
                : "border-amber-200 bg-amber-50/80",
            ].join(" ")}
          >
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>{m.direction}</span>
              <span>{new Date(m.createdAt).toLocaleString()}</span>
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-950">
              {m.text ?? ""}
            </div>
          </div>
        ))}

        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white/70 p-6 text-sm text-stone-500">
            No messages.
          </div>
        ) : null}
      </div>
    </div>
  );
}
