import React, { useMemo, useEffect, useRef } from "react";
import { Message, Audit } from "@/lib/types";
import { MessageBubble } from "./MessageBubble";
import { AuditCard } from "./AuditCard";

interface ChatTimelineProps {
  messages: Message[];
  audits: Audit[];
  activeActions: Record<string, "reacting" | "replying" | null>;
  activeReactionPickerMessageId: string | null;
  setActiveReactionPickerMessageId: (id: string | null) => void;
  onManualReactClick: (messageId: string, reactionCode: string) => void;
  onAiReactClick: (messageId: string) => void;
  onAiReplyClick: (messageId: string) => void;
  onInspectAudit: (audit: Audit) => void;
  isLoading?: boolean;
}

export function ChatTimeline({
  messages,
  audits,
  activeActions,
  activeReactionPickerMessageId,
  setActiveReactionPickerMessageId,
  onManualReactClick,
  onAiReactClick,
  onAiReplyClick,
  onInspectAudit,
  isLoading,
}: ChatTimelineProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const mergedTimeline = useMemo(() => {
    const items: Array<
      | { type: "message"; data: Message; timestamp: number }
      | { type: "audit"; data: Audit; timestamp: number }
    > = [];

    for (const msg of messages) {
      items.push({
        type: "message",
        data: msg,
        timestamp: new Date(msg.createdAt).getTime(),
      });
    }

    for (const audit of audits) {
      items.push({
        type: "audit",
        data: audit,
        timestamp: new Date(audit.created_at).getTime(),
      });
    }

    return items.sort((a, b) => {
      if (a.timestamp === b.timestamp) {
        if (a.type === "audit" && b.type === "message") return -1;
        if (a.type === "message" && b.type === "audit") return 1;
      }
      return a.timestamp - b.timestamp;
    });
  }, [messages, audits]);

  // Scroll to bottom on load or new message
  useEffect(() => {
    if (!isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
      {isLoading ? (
        <div className="space-y-4 py-2">
          {/* Skeleton message 1 (incoming, left aligned) */}
          <div className="flex justify-start animate-pulse">
            <div className="max-w-[70%] bg-white rounded-2xl p-4 shadow-sm space-y-2 border border-gray-200">
              <div className="h-3 bg-gray-200 rounded w-20"></div>
              <div className="h-4 bg-gray-200 rounded w-48"></div>
              <div className="h-3 bg-gray-100 rounded w-12"></div>
            </div>
          </div>
          {/* Skeleton audit log (centered, dashed border) */}
          <div className="flex justify-center animate-pulse">
            <div className="w-11/12 md:w-3/4 border border-dashed border-gray-200 bg-gray-50/50 rounded-xl p-3.5 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-24 mx-auto"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6 mx-auto"></div>
            </div>
          </div>
          {/* Skeleton message 2 (outgoing, right aligned) */}
          <div className="flex justify-end animate-pulse">
            <div className="max-w-[70%] bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50 space-y-2 shadow-sm">
              <div className="h-3 bg-blue-100 rounded w-16 ml-auto"></div>
              <div className="h-4 bg-blue-100 rounded w-56 ml-auto"></div>
              <div className="h-3 bg-blue-50 rounded w-10 ml-auto"></div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {mergedTimeline.map((item) => {
            if (item.type === "message") {
              const m = item.data;
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  activeAction={activeActions[m.id]}
                  activeReactionPickerMessageId={activeReactionPickerMessageId === m.id}
                  onToggleReactionPicker={(e) => {
                    e.stopPropagation();
                    setActiveReactionPickerMessageId(
                      activeReactionPickerMessageId === m.id ? null : m.id
                    );
                  }}
                  onManualReact={(reactionCode) => onManualReactClick(m.id, reactionCode)}
                  onAiReact={() => onAiReactClick(m.id)}
                  onAiReply={() => onAiReplyClick(m.id)}
                />
              );
            } else {
              return (
                <AuditCard
                  key={item.data.id}
                  audit={item.data}
                  onInspect={onInspectAudit}
                />
              );
            }
          })}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
