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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
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
      <div ref={messagesEndRef} />
    </div>
  );
}
