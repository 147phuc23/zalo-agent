import React from "react";
import { Message } from "@/lib/types";
import { Smile, Sparkles, CornerUpLeft, Loader2, FileText, Check, CheckCheck } from "lucide-react";

const EMOJI_OPTIONS = [
  { emoji: "❤️", code: "/-heart", label: "Heart" },
  { emoji: "👍", code: "/-strong", label: "Like" },
  { emoji: "😂", code: ":>", label: "Haha" },
  { emoji: "😮", code: ":o", label: "Wow" },
  { emoji: "😢", code: ":-((", label: "Cry" },
  { emoji: "😡", code: ":-h", label: "Angry" },
];

const EMOJI_MAP: Record<string, string> = {
  "/-heart": "❤️",
  "/-strong": "👍",
  ":>": "😂",
  ":o": "😮",
  ":-((": "😢",
  ":-h": "😡",
};

interface MessageBubbleProps {
  message: Message;
  activeAction: "reacting" | "replying" | null;
  activeReactionPickerMessageId: boolean;
  onToggleReactionPicker: (e: React.MouseEvent) => void;
  onManualReact: (reactionCode: string) => void;
  onAiReact: () => void;
  onAiReply: () => void;
}

export const MessageBubble = React.memo(function MessageBubble({
  message: m,
  activeAction,
  activeReactionPickerMessageId,
  onToggleReactionPicker,
  onManualReact,
  onAiReact,
  onAiReply,
}: MessageBubbleProps) {
  const isInbound = m.direction === "inbound";
  const isFile = m.messageType === "file";
  const attachments = m.rawPayload?.attachments || [];
  const fileAttachment = attachments.find((a: any) => a.type === "file");

  const isReacting = activeAction === "reacting";
  const isReplying = activeAction === "replying";
  const isDisabled = !!activeAction;

  const renderActionButtons = () => {
    return (
      <>
        <div className="relative flex items-center" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onToggleReactionPicker}
            disabled={isDisabled}
            className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:bg-gray-50 transition shadow-sm disabled:opacity-50"
            title="React to Message"
          >
            {isReacting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Smile className="w-3.5 h-3.5" />
            )}
          </button>

          {activeReactionPickerMessageId && (
            <div
              className={`absolute bottom-full mb-2 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 flex items-center gap-1.5 ${
                isInbound ? "left-0" : "right-0"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {EMOJI_OPTIONS.map((opt) => (
                <button
                  key={opt.code}
                  onClick={() => onManualReact(opt.code)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-sm transition"
                  title={opt.label}
                >
                  {opt.emoji}
                </button>
              ))}
              <div className="w-px h-5 bg-gray-200 mx-0.5" />
              <button
                onClick={onAiReact}
                className="px-2 py-1 flex items-center gap-1 rounded-lg hover:bg-blue-50 text-blue-600 text-xs font-semibold transition whitespace-nowrap"
                title="Let AI React"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI</span>
              </button>
            </div>
          )}
        </div>
        <button
          onClick={onAiReply}
          disabled={isDisabled}
          className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:bg-gray-50 transition shadow-sm disabled:opacity-50"
          title="Let AI Reply"
        >
          {isReplying ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CornerUpLeft className="w-3.5 h-3.5" />
          )}
        </button>
      </>
    );
  };

  return (
    <div
      className={`flex items-center gap-2 group/msg ${isInbound ? "justify-start" : "justify-end"} ${
        m.rawPayload?.reactions && m.rawPayload.reactions.length > 0 ? "pb-2.5" : ""
      }`}
    >
      {!isInbound && (
        <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex gap-1.5 flex-shrink-0">
          {renderActionButtons()}
        </div>
      )}
      <div
        className={`max-w-[70%] rounded-2xl p-3 px-4 shadow-sm leading-relaxed text-sm relative ${
          isInbound
            ? "bg-white border border-gray-200 text-slate-800 rounded-tl-sm"
            : "bg-[#0068FF] text-white rounded-tr-sm"
        }`}
      >
        {m.rawPayload?.quote && (
          <div
            className={`p-2 mb-2 text-xs rounded border-l-4 font-normal ${
              isInbound
                ? "bg-gray-100 border-gray-400 text-slate-650"
                : "bg-blue-600/50 border-white text-blue-100"
            }`}
          >
            <div className="font-semibold text-[10px] uppercase">Replying to:</div>
            <div className="truncate">{m.rawPayload.quote.msg || m.rawPayload.quote.text}</div>
          </div>
        )}
        {isFile && fileAttachment ? (
          <div className="flex items-center gap-3 py-1">
            <FileText className={`w-8 h-8 ${isInbound ? "text-blue-600" : "text-blue-200"}`} />
            <div className="min-w-0">
              <p className={`font-semibold truncate text-xs ${isInbound ? "text-slate-800" : "text-white"}`}>
                {fileAttachment.name || "Attached CV"}
              </p>
              {fileAttachment.sizeBytes && (
                <p className={`text-[10px] ${isInbound ? "text-slate-500" : "text-blue-200"}`}>
                  {Math.round(fileAttachment.sizeBytes / 1024)} KB
                </p>
              )}
              <a
                href={fileAttachment.url || "#"}
                target="_blank"
                rel="noreferrer"
                className={`text-[11px] font-bold underline mt-1 block ${
                  isInbound ? "text-[#0068FF] hover:text-blue-700" : "text-white hover:text-blue-100"
                }`}
              >
                View / Download CV
              </a>
            </div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words">{m.text}</div>
        )}
        {m.rawPayload?.reactions && m.rawPayload.reactions.length > 0 && (
          <div
            className={`absolute -bottom-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white border border-stone-200 text-slate-600 shadow-sm z-10 select-none ${
              isInbound ? "left-3" : "right-3"
            }`}
          >
            {m.rawPayload.reactions.map((r: any, idx: number) => {
              const emojiChar = EMOJI_MAP[r.emoji] || r.emoji || "❤️";
              return (
                <span key={idx} title={r.emoji}>
                  {emojiChar}
                </span>
              );
            })}
          </div>
        )}
        <div
          className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] select-none ${
            isInbound ? "text-gray-400" : "text-blue-100"
          }`}
        >
          <span>
            {new Date(m.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {!isInbound &&
            (m.isRead ? (
              <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
            ) : (
              <Check className="w-3.5 h-3.5 text-blue-300" />
            ))}
        </div>
      </div>
      {isInbound && (
        <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex gap-1.5 flex-shrink-0">
          {renderActionButtons()}
        </div>
      )}
    </div>
  );
});
