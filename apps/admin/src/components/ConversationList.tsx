import React from "react";
import { Conversation } from "@/lib/types";
import { Search, Plus, Sparkles } from "lucide-react";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewChatOpen: () => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelectId,
  searchQuery,
  onSearchChange,
  onNewChatOpen,
}: ConversationListProps) {
  const filteredConversations = conversations.filter((c) => {
    const name = c.contact?.displayName ?? c.contact?.externalUserId ?? "";
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.externalThreadId.includes(searchQuery)
    );
  });

  return (
    <div
      className={`w-full md:w-80 border-r border-gray-200 bg-white flex flex-col h-full flex-shrink-0 ${
        selectedId ? "hidden md:flex" : "flex"
      }`}
    >
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold tracking-tight text-lg text-slate-800">Zalo Simulator</h2>
        </div>
        <button
          onClick={onNewChatOpen}
          className="p-1.5 rounded-lg bg-[#0068FF] hover:bg-blue-500 text-white transition"
          title="Create Simulated Chat"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-gray-200 relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-6 top-6" />
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-800 placeholder-gray-400 focus:outline-none focus:border-blue-600"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredConversations.map((c) => {
          const isSelected = c.id === selectedId;
          const displayName = c.contact?.displayName ?? c.contact?.externalUserId ?? "Unknown User";

          return (
            <button
              key={c.id}
              onClick={() => onSelectId(c.id)}
              className={`w-full text-left p-3.5 rounded-2xl flex items-center justify-between gap-3 transition ${
                isSelected
                  ? "bg-blue-50 border border-blue-200/50 text-blue-755 font-semibold"
                  : "bg-transparent border border-transparent text-slate-500 hover:bg-gray-50 hover:text-slate-800"
              }`}
            >
              <div className="min-w-0">
                <div
                  className={`font-semibold truncate text-sm ${
                    isSelected ? "text-blue-600" : "text-slate-800"
                  }`}
                >
                  {displayName}
                </div>
                <div className="text-xs text-slate-400 truncate mt-1">
                  Thread: {c.externalThreadId}
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <span className="text-[10px] text-slate-400">
                  {new Date(c.lastActivityAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {c.status === "open" && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active conversation" />
                )}
              </div>
            </button>
          );
        })}

        {filteredConversations.length === 0 && (
          <div className="text-center p-6 text-xs text-slate-400 mt-10">
            No simulated chat sections found.
          </div>
        )}
      </div>
    </div>
  );
}
