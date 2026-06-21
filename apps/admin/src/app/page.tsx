"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  RefreshCw,
  Plus,
  Layers,
  Settings,
  Download,
  Check,
  CheckCheck,
  Cpu,
  Clock,
  Terminal,
  FileText,
  User,
  Sliders,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Smile,
  CornerUpLeft,
  Loader2,
} from "lucide-react";

type Conversation = {
  id: string;
  tenantId: string;
  channel: string;
  externalThreadId: string;
  status: string;
  assigneeUserId: string | null;
  overrideModel: string | null;
  lastActivityAt: string;
  createdAt: string;

  contact: { displayName: string | null; externalUserId: string } | null;
};

type Message = {
  id: string;
  tenantId: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  messageType: string;
  text: string | null;
  externalMessageId: string | null;
  idempotencyKey: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  rawPayload?: any;
};

type Audit = {
  id: string;
  tenant_id: string;
  conversation_id: string | null;
  run_id: string | null;
  tool_name: string;
  input: Record<string, any>;
  output: Record<string, any> | null;
  status: "ok" | "error";
  created_at: string;
};

type PromptVersion = {
  id: string;
  tenant_id: string;
  key: string;
  content: string;
  version: number;
  is_active: boolean;
  created_at: string;
};

const PRESET_CONTEXTS = [
  {
    name: "Nguyen Van A - Senior Frontend Developer",
    text: "Xin chào, tôi là Nguyễn Văn A, ứng tuyển vị trí Senior Frontend. Tôi có 5 năm kinh nghiệm React, Next.js và TypeScript.",
    displayName: "Nguyen Van A (Frontend)",
    userId: "candidate-frontend-a",
  },
  {
    name: "Tran Thi B - Senior Java Backend Engineer",
    text: "Chào bộ phận tuyển dụng, tôi là Trần Thị B, muốn tìm hiểu về vị trí Senior Java. Tôi có kinh nghiệm Spring Boot, K8s và AWS.",
    displayName: "Tran Thi B (Backend)",
    userId: "candidate-backend-b",
  },
  {
    name: "Le Van C - Junior Mobile Developer",
    text: "Dạ em chào anh chị, em là Lê Văn C, em ứng tuyển vị trí Fresher/Junior React Native ạ.",
    displayName: "Le Van C (Mobile)",
    userId: "candidate-mobile-c",
  },
];

const AVAILABLE_MODELS = [
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
  { id: "openrouter/owl-alpha", name: "OpenRouter Owl Alpha (Default)" },
];

const EMOJI_OPTIONS = [
  { emoji: "❤️", code: "/-heart", label: "Heart" },
  { emoji: "👍", code: "/-strong", label: "Like" },
  { emoji: "😂", code: ":>", label: "Haha" },
  { emoji: "😮", code: ":o", label: "Wow" },
  { emoji: "😢", code: ":-((", label: "Cry" },
  { emoji: "😡", code: ":-h", label: "Angry" },
];

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ... PRESET_CONTEXTS and AVAILABLE_MODELS declarations ...

function Dashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [selectedAuditForModal, setSelectedAuditForModal] = useState<Audit | null>(null);
  const [expandedAudits, setExpandedAudits] = useState<Record<string, boolean>>({});

  // Prompt State
  const [promptContent, setPromptContent] = useState("");
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([]);
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>(AVAILABLE_MODELS);

  // UI States
  const [activeTab, setActiveTab] = useState<"debugger" | "prompt">("debugger");
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Chat Form State
  const [newThreadId, setNewThreadId] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(-1);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const [isUploadingCv, setIsUploadingCv] = useState(false);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/inbox/conversations");
      const data = await res.json();
      if (data.ok && data.conversations) {
        setConversations(data.conversations);
      }
    } catch (err) {
      console.error("Failed to fetch conversations", err);
    }
  };

  const fetchMessages = async (id: string, isSilent = false) => {
    try {
      const res = await fetch(`/api/inbox/conversations/${id}/messages`);
      const data = await res.json();
      if (data.ok && data.messages) {
        setMessages(data.messages);
        if (!isSilent) {
          scrollToBottom();
        }
      }
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  };

  const fetchAudits = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}/audits`);
      const data = await res.json();
      if (data.ok && data.audits) {
        setAudits(data.audits);
      }
    } catch (err) {
      console.error("Failed to fetch audits", err);
    }
  };

  const fetchPromptTemplates = async () => {
    try {
      const res = await fetch("/api/prompts?listAll=true");
      const data = await res.json();
      if (data.ok) {
        setPromptVersions(data.versions ?? []);
        const active = data.versions?.find((v: PromptVersion) => v.is_active);
        if (active) {
          setPromptContent(active.content);
        }
      }
    } catch (err) {
      console.error("Failed to fetch prompts", err);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}/read`, { method: "POST" });
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  // Load conversation ID from URL params on startup
  useEffect(() => {
    const queryId = searchParams.get("id");
    if (queryId) {
      setSelectedId(queryId);
    }
  }, [searchParams]);

  // Load models from backend
  useEffect(() => {
    fetch("/api/conversations/models")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.models)) {
          setAvailableModels(data.models);
        }
      })
      .catch((err) => console.error("Failed to load models from backend", err));
  }, []);

  // Fetch conversation list on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  // Poll conversations, messages, and audits every 10 seconds (visibility-gated)
  useEffect(() => {
    const handlePoll = () => {
      if (document.hidden) return;
      fetchConversations();
      if (selectedId) {
        fetchMessages(selectedId, true);
        fetchAudits(selectedId);
      }
    };

    const interval = setInterval(handlePoll, 10000);
    return () => clearInterval(interval);
  }, [selectedId]);

  // Fetch messages and audits when conversation changes
  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId);
      fetchAudits(selectedId);
      markAsRead(selectedId);
    }
  }, [selectedId]);

  // Connect to SSE stream
  useEffect(() => {
    const eventSource = new EventSource("/api/sse");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[SSE] Received event:", data);

        if (data.type === "message_created") {
          if (data.payload.conversationId === selectedId) {
            setMessages((prev) => {
              const hasMessage = prev.some(
                (m) =>
                  m.id === data.payload.message.id ||
                  (m.idempotencyKey && m.idempotencyKey === data.payload.message.idempotencyKey)
              );
              if (hasMessage) {
                return prev.map((m) =>
                  (m.idempotencyKey === data.payload.message.idempotencyKey || m.id === data.payload.message.id)
                    ? data.payload.message
                    : m
                );
              }
              return [...prev, data.payload.message];
            });
            scrollToBottom();
          }
          fetchConversations();
        } else if (data.type === "audit_created") {
          if (data.payload.conversationId === selectedId) {
            setAudits((prev) => {
              if (prev.some((a) => a.id === data.payload.audit.id)) {
                return prev;
              }
              return [...prev, data.payload.audit];
            });
          }
        } else if (data.type === "message_updated") {
          if (data.payload.conversationId === selectedId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === data.payload.messageId
                  ? { ...m, rawPayload: data.payload.rawPayload }
                  : m
              )
            );
          }
        } else if (data.type === "conversation_updated") {
          fetchConversations();
        }
      } catch (err) {
        console.error("[SSE] Failed to parse event data", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("[SSE] EventSource connection error, will auto-reconnect", err);
    };

    return () => {
      eventSource.close();
    };
  }, [selectedId]);

  // Fetch Prompt versions on startup
  useEffect(() => {
    fetchPromptTemplates();
  }, []);

  const [activeActions, setActiveActions] = useState<Record<string, "reacting" | "replying" | null>>({});
  const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveReactionPickerMessageId(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
    };
  }, []);

  const handleManualReactClick = async (messageId: string, reactionCode: string) => {
    if (!selectedId) return;
    setActiveReactionPickerMessageId(null);
    setActiveActions((prev) => ({ ...prev, [messageId]: "reacting" }));
    try {
      const res = await fetch(`/api/conversations/${selectedId}/messages/${messageId}/ai-react`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reaction: reactionCode }),
      });
      const data = await res.json();
      if (!data.ok) {
        console.error("Failed to apply manual reaction:", data.error);
      }
    } catch (err) {
      console.error("Error applying manual reaction:", err);
    } finally {
      setActiveActions((prev) => ({ ...prev, [messageId]: null }));
    }
  };

  const handleAiReactClick = async (messageId: string) => {
    if (!selectedId) return;
    setActiveReactionPickerMessageId(null);
    setActiveActions((prev) => ({ ...prev, [messageId]: "reacting" }));
    try {
      const res = await fetch(`/api/conversations/${selectedId}/messages/${messageId}/ai-react`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.ok) {
        console.error("Failed to trigger AI react:", data.error);
      }
    } catch (err) {
      console.error("Error triggering AI react:", err);
    } finally {
      setActiveActions((prev) => ({ ...prev, [messageId]: null }));
    }
  };

  const handleAiReplyClick = async (messageId: string) => {
    if (!selectedId) return;
    setActiveActions((prev) => ({ ...prev, [messageId]: "replying" }));
    try {
      const res = await fetch(`/api/conversations/${selectedId}/messages/${messageId}/ai-reply`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.ok) {
        console.error("Failed to trigger AI reply:", data.error);
      }
    } catch (err) {
      console.error("Error triggering AI reply:", err);
    } finally {
      setActiveActions((prev) => ({ ...prev, [messageId]: null }));
    }
  };

  const renderActionButtons = (m: Message) => {
    const isReacting = activeActions[m.id] === "reacting";
    const isReplying = activeActions[m.id] === "replying";
    const isDisabled = !!activeActions[m.id];

    return (
      <>
        <div className="relative flex items-center" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveReactionPickerMessageId(activeReactionPickerMessageId === m.id ? null : m.id);
            }}
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

          {activeReactionPickerMessageId === m.id && (
            <div
              className={`absolute bottom-full mb-2 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 flex items-center gap-1.5 ${m.direction === "inbound" ? "left-0" : "right-0"
                }`}
              onClick={(e) => e.stopPropagation()}
            >
              {EMOJI_OPTIONS.map((opt) => (
                <button
                  key={opt.code}
                  onClick={() => handleManualReactClick(m.id, opt.code)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-sm transition"
                  title={opt.label}
                >
                  {opt.emoji}
                </button>
              ))}
              <div className="w-px h-5 bg-gray-200 mx-0.5" />
              <button
                onClick={() => handleAiReactClick(m.id)}
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
          onClick={() => handleAiReplyClick(m.id)}
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedId) return;

    const currentConvo = conversations.find((c) => c.id === selectedId);
    if (!currentConvo) return;

    const messageText = inputText;
    setInputText("");
    const idempotencyKey = `opt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      // Optimistically add message
      const optimisticMsg: Message = {
        id: `optimistic-${Date.now()}`,
        tenantId: currentConvo.tenantId,
        conversationId: selectedId,
        direction: "inbound",
        messageType: "text",
        text: messageText,
        externalMessageId: null,
        idempotencyKey,
        isRead: true,
        readAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      scrollToBottom();

      await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          threadId: currentConvo.externalThreadId,
          senderExternalId: currentConvo.contact?.externalUserId ?? "simulator-user",
          text: messageText,
          idempotencyKey,
        }),
      });
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const handleUploadCvClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;

    const currentConvo = conversations.find((c) => c.id === selectedId);
    if (!currentConvo) return;

    const formData = new FormData();
    formData.append("file", file);

    setIsUploadingCv(true);
    try {
      // Optimistically add message
      const optimisticMsg: Message = {
        id: `optimistic-file-${Date.now()}`,
        tenantId: currentConvo.tenantId,
        conversationId: selectedId,
        direction: "inbound",
        messageType: "file",
        text: `Uploaded CV: ${file.name}`,
        externalMessageId: null,
        idempotencyKey: `optimistic-key-${Date.now()}`,
        isRead: true,
        readAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        rawPayload: {
          attachments: [
            {
              type: "file",
              url: "", // will be set by server
              name: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
            }
          ]
        }
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      scrollToBottom();

      const res = await fetch(`/api/conversations/${selectedId}/cv`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.ok) {
        console.error("Failed to upload CV:", data.error);
      } else {
        // Refresh messages after brief delay
        setTimeout(() => {
          fetchMessages(selectedId, true);
        }, 1000);
      }
    } catch (err) {
      console.error("Failed to upload CV", err);
    } finally {
      setIsUploadingCv(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThreadId.trim() || !newUserId.trim()) return;

    setIsSubmitting(true);
    try {
      const display = newDisplayName || `Contact ${newUserId.slice(0, 6)}`;
      const res = await fetch("/api/conversations/new", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: "zalo",
          externalThreadId: newThreadId,
          externalUserId: newUserId,
          displayName: display,
        }),
      });

      const data = await res.json();
      if (data.ok && data.conversationId) {
        // Preset greeting context
        if (selectedPresetIndex !== -1) {
          const preset = PRESET_CONTEXTS[selectedPresetIndex];
          await fetch("/api/events", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              threadId: newThreadId,
              senderExternalId: newUserId,
              text: preset.text,
              context: { presetApplied: preset.name },
            }),
          });
        }

        await fetchConversations();
        setSelectedId(data.conversationId);
        setIsNewChatOpen(false);

        // Reset fields
        setNewThreadId("");
        setNewUserId("");
        setNewDisplayName("");
        setSelectedPresetIndex(-1);
      }
    } catch (err) {
      console.error("Failed to create conversation", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePresetSelect = (index: number) => {
    setSelectedPresetIndex(index);
    if (index !== -1) {
      const preset = PRESET_CONTEXTS[index];
      setNewThreadId(`thread-${preset.userId}`);
      setNewUserId(preset.userId);
      setNewDisplayName(preset.displayName);
    }
  };

  const handleUpdateModel = async (modelId: string | null) => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/conversations/${selectedId}/model`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: modelId }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedId ? { ...c, overrideModel: modelId } : c))
        );
      }
    } catch (err) {
      console.error("Failed to update model", err);
    }
  };

  const handleSavePrompt = async () => {
    if (!promptContent.trim()) return;
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "assistant", content: promptContent }),
      });
      if (res.ok) {
        alert("Prompt template version saved successfully!");
        fetchPromptTemplates();
      }
    } catch (err) {
      console.error("Failed to save prompt", err);
    }
  };

  const handleSelectPromptVersion = (version: PromptVersion) => {
    setPromptContent(version.content);
    // Automatically apply selected version in active state
    fetch("/api/prompts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "assistant", content: version.content }),
    }).then(() => {
      fetchPromptTemplates();
    });
  };

  const handleExportSession = () => {
    if (!selectedId) return;
    const current = conversations.find((c) => c.id === selectedId);
    if (!current) return;

    let content = `# Conversation Session Log\n\n`;
    content += `**Conversation ID:** ${selectedId}\n`;
    content += `**Zalo Thread:** ${current.externalThreadId}\n`;
    content += `**Candidate:** ${current.contact?.displayName ?? current.contact?.externalUserId}\n`;
    content += `**Model:** ${current.overrideModel ?? "Default (GPT-4o Mini)"}\n`;
    content += `**Exported At:** ${new Date().toLocaleString()}\n\n`;
    content += `--- \n\n## Chat Transcript\n\n`;

    for (const msg of messages) {
      const time = new Date(msg.createdAt).toLocaleTimeString();
      const speaker = msg.direction === "inbound" ? "Candidate" : "AI Agent";
      content += `**[${time}] ${speaker}:** ${msg.text}\n\n`;
    }

    content += `--- \n\n## Agentic Audits (Tool Execution Logs)\n\n`;

    for (const audit of audits) {
      content += `### Tool: \`${audit.tool_name}\` [${audit.status.toUpperCase()}]\n`;
      content += `**Time:** ${new Date(audit.created_at).toLocaleTimeString()}\n`;
      content += `**Input Parameters:**\n\`\`\`json\n${JSON.stringify(audit.input, null, 2)}\n\`\`\`\n`;
      content += `**Output Payload:**\n\`\`\`json\n${JSON.stringify(audit.output, null, 2)}\n\`\`\`\n\n`;
    }

    const filename = `zalo_session_${selectedId.slice(0, 8)}.md`;

    fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, filename }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          alert(`Trace successfully exported to local file:\n${data.filePath}`);
        } else {
          alert(`Failed to export trace: ${data.error}`);
        }
      })
      .catch((err) => {
        console.error("Export error", err);
        alert(`Failed to export trace: ${err.message}`);
      });
  };

  const filteredConversations = conversations.filter((c) => {
    const name = c.contact?.displayName ?? c.contact?.externalUserId ?? "";
    return name.toLowerCase().includes(searchQuery.toLowerCase()) || c.externalThreadId.includes(searchQuery);
  });

  const activeConversation = conversations.find((c) => c.id === selectedId);

  const mergedTimeline = React.useMemo(() => {
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

  return (
    <div className="flex h-screen bg-[#F0F2F5] font-sans text-slate-800 overflow-hidden">
      {/* 1. Left Sidebar: Chat Sessions List */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold tracking-tight text-lg text-slate-800">Zalo Simulator</h2>
          </div>
          <button
            onClick={() => setIsNewChatOpen(true)}
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
            onChange={(e) => setSearchQuery(e.target.value)}
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
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left p-3.5 rounded-2xl flex items-center justify-between gap-3 transition ${isSelected
                    ? "bg-blue-50 border border-blue-200/50 text-blue-755 font-semibold"
                    : "bg-transparent border border-transparent text-slate-500 hover:bg-gray-50 hover:text-slate-800"
                  }`}
              >
                <div className="min-w-0">
                  <div className={`font-semibold truncate text-sm ${isSelected ? "text-blue-600" : "text-slate-800"}`}>
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

      {/* 2. Middle Pane: Chat Simulator View */}
      <div className="flex-1 min-w-0 flex flex-col h-full bg-[#F4F5F7] relative">
        {activeConversation ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  {activeConversation.contact?.displayName ?? activeConversation.contact?.externalUserId}
                </h3>
                <span className="text-xs text-slate-500">
                  Zalo Thread: {activeConversation.externalThreadId}
                </span>
              </div>

              {/* Model selection dropdown */}
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-slate-400" />
                <select
                  value={activeConversation.overrideModel ?? "default"}
                  onChange={(e) => handleUpdateModel(e.target.value === "default" ? null : e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg text-xs py-1.5 px-3 text-slate-700 focus:outline-none focus:border-blue-600"
                >
                  <option value="default">Default Model</option>
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Chat Messages Panel */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {mergedTimeline.map((item) => {
                if (item.type === "message") {
                  const m = item.data;
                  const isInbound = m.direction === "inbound";
                  const isFile = m.messageType === "file";
                  const attachments = m.rawPayload?.attachments || [];
                  const fileAttachment = attachments.find((a: any) => a.type === "file");
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center gap-2 group/msg ${isInbound ? "justify-start" : "justify-end"}`}
                    >
                      {!isInbound && (
                        <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex gap-1.5 flex-shrink-0">
                          {renderActionButtons(m)}
                        </div>
                      )}
                      <div
                        className={`max-w-[70%] rounded-2xl p-3 px-4 shadow-sm leading-relaxed text-sm relative ${isInbound
                            ? "bg-white border border-gray-200 text-slate-800 rounded-tl-sm"
                            : "bg-[#0068FF] text-white rounded-tr-sm"
                          }`}
                      >
                        {m.rawPayload?.quote && (
                          <div className={`p-2 mb-2 text-xs rounded border-l-4 font-normal ${isInbound
                              ? "bg-gray-105 bg-gray-100 border-gray-400 text-slate-650"
                              : "bg-blue-600/50 border-white text-blue-100"
                            }`}>
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
                                className={`text-[11px] font-bold underline mt-1 block ${isInbound ? "text-[#0068FF] hover:text-blue-700" : "text-white hover:text-blue-100"
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
                          <div className={`flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-xs w-fit shadow-xs ${isInbound
                              ? "bg-gray-50 border border-gray-150 text-slate-600"
                              : "bg-blue-700 text-blue-100"
                            }`}>
                            {m.rawPayload.reactions.map((r: any, idx: number) => {
                              let emojiChar = "❤️";
                              if (r.emoji === "/-strong") emojiChar = "👍";
                              else if (r.emoji === ":>") emojiChar = "😂";
                              else if (r.emoji === ":o") emojiChar = "😮";
                              else if (r.emoji === ":-((") emojiChar = "😢";
                              else if (r.emoji === ":-h") emojiChar = "😡";
                              else if (r.emoji === "/-heart") emojiChar = "❤️";
                              else emojiChar = r.emoji;
                              return <span key={idx} title={r.emoji}>{emojiChar}</span>;
                            })}
                          </div>
                        )}
                        <div className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] select-none ${isInbound ? "text-gray-400" : "text-blue-100"
                          }`}>
                          <span>
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {!isInbound && (
                            m.isRead ? (
                              <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-blue-300" />
                            )
                          )}
                        </div>
                      </div>
                      {isInbound && (
                        <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex gap-1.5 flex-shrink-0">
                          {renderActionButtons(m)}
                        </div>
                      )}
                    </div>
                  );
                } else {
                  const a = item.data;
                  const isExpanded = !!expandedAudits[a.id];
                  const toggleExpand = () => {
                    setExpandedAudits((prev) => ({
                      ...prev,
                      [a.id]: !prev[a.id],
                    }));
                  };
                  const inputStr = JSON.stringify(a.input, null, 2);
                  const outputStr = a.output ? JSON.stringify(a.output, null, 2) : "";
                  const isLong = inputStr.length > 150 || outputStr.length > 150;

                  return (
                    <div key={a.id} className="flex justify-center my-2">
                      <div
                        onClick={toggleExpand}
                        className="max-w-[70%] w-full bg-white border border-dashed border-gray-200 rounded-xl p-3 cursor-pointer hover:bg-gray-50 transition group"
                      >
                        <div className="flex items-center justify-between gap-2 select-none">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Terminal className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            <span className="font-mono text-xs font-semibold text-slate-700 truncate">
                              {a.tool_name}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase border ${a.status === "ok"
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                  : "bg-red-50 text-red-650 border-red-100"
                                }`}
                            >
                              {a.status}
                            </span>
                            <button
                              onClick={() => setSelectedAuditForModal(a)}
                              className="text-[10px] text-blue-600 hover:text-blue-500 hover:underline font-semibold"
                            >
                              Inspect
                            </button>
                          </div>
                        </div>

                        {!isExpanded && a.input && Object.keys(a.input).length > 0 && (
                          <div className="mt-1.5 text-[11px] text-slate-450 font-mono truncate max-w-full">
                            args: {JSON.stringify(a.input)}
                          </div>
                        )}

                        {isExpanded && (
                          <div className="mt-2.5 space-y-2 text-left" onClick={(e) => e.stopPropagation()}>
                            {a.input && Object.keys(a.input).length > 0 && (
                              <div>
                                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                  Arguments
                                </div>
                                <code className="block p-2.5 rounded-lg bg-gray-50 text-slate-700 text-[11px] font-mono overflow-x-auto border border-gray-200 max-h-48 select-text">
                                  {inputStr}
                                </code>
                              </div>
                            )}
                            {a.output && (
                              <div>
                                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                  Response
                                </div>
                                <code className="block p-2.5 rounded-lg bg-gray-50 text-slate-700 text-[11px] font-mono overflow-x-auto border border-gray-200 max-h-48 select-text">
                                  {outputStr}
                                </code>
                              </div>
                            )}
                            {isLong && (
                              <div className="flex justify-end pt-1">
                                <button
                                  onClick={() => setSelectedAuditForModal(a)}
                                  className="text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-600 px-2.5 py-1 rounded-lg border border-blue-200/50 font-semibold flex items-center gap-1 transition"
                                >
                                  <Sliders className="w-3 h-3" />
                                  Inspect Full Payload
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Inbound Send Box (Simulates Candidate typing) */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx"
                className="hidden"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleUploadCvClick}
                  disabled={isUploadingCv}
                  className="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 disabled:bg-gray-50 text-slate-600 px-3.5 rounded-xl flex items-center justify-center transition border border-gray-200"
                  title="Attach CV File"
                >
                  {isUploadingCv ? (
                    <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Paperclip className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="text"
                  placeholder="Type a simulated message bubble as Candidate..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-gray-400 focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  className="bg-[#0068FF] hover:bg-blue-500 active:bg-blue-700 text-white px-4 rounded-xl flex items-center justify-center transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <MessageSquare className="w-12 h-12 text-slate-400 mb-3" />
            <h3 className="font-semibold text-slate-700 text-base">Zalo Sandbox Chatroom</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Select an existing chat thread or create a new mock section to trigger toolcalls and debug AI prompts.
            </p>
          </div>
        )}
      </div>

      {/* 3. Right Pane: Debugger Inspector & Prompts panel */}
      <div className="w-96 border-l border-gray-200 bg-white flex flex-col h-full">
        {/* Tab Header */}
        <div className="flex border-b border-gray-200 text-sm">
          <button
            onClick={() => setActiveTab("debugger")}
            className={`flex-1 py-3 text-center font-medium border-b-2 transition ${activeTab === "debugger"
                ? "border-blue-600 text-blue-600 bg-blue-50/20"
                : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <Terminal className="w-4 h-4 inline mr-2" />
            Agentic Inspector
          </button>
          <button
            onClick={() => setActiveTab("prompt")}
            className={`flex-1 py-3 text-center font-medium border-b-2 transition ${activeTab === "prompt"
                ? "border-blue-600 text-blue-600 bg-blue-50/20"
                : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Prompts Manager
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "debugger" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-xs tracking-wider uppercase text-slate-500">
                  Tool Calls & Audits
                </h4>
                {selectedId && (
                  <button
                    onClick={handleExportSession}
                    className="text-xs text-blue-600 hover:text-blue-500 flex items-center gap-1 font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Trace
                  </button>
                )}
              </div>

              {/* Collapsible Tool Audit list */}
              <div className="space-y-2.5">
                {audits.map((a) => (
                  <div
                    key={a.id}
                    className={`rounded-xl border p-3 bg-gray-50 ${a.status === "ok" ? "border-gray-200" : "border-red-200"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-mono text-xs font-bold text-slate-800">
                          {a.tool_name}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${a.status === "ok"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-red-50 text-red-650"
                          }`}
                      >
                        {a.status}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-2">
                      <Clock className="w-3 h-3" />
                      {new Date(a.created_at).toLocaleTimeString()}
                    </div>

                    <details className="mt-2 text-xs group">
                      <summary className="cursor-pointer text-[11px] text-slate-500 select-none hover:text-slate-700 font-semibold">
                        View parameters / results
                      </summary>
                      <div className="mt-2 space-y-2">
                        <div>
                          <div className="text-[10px] text-slate-500 mb-1">Inputs:</div>
                          <code className="block p-2 rounded bg-white text-[10px] text-slate-700 overflow-x-auto border border-gray-200 select-text">
                            {JSON.stringify(a.input, null, 2)}
                          </code>
                        </div>
                        {a.output && (
                          <div>
                            <div className="text-[10px] text-slate-500 mb-1">Outputs:</div>
                            <code className="block p-2 rounded bg-white text-[10px] text-slate-700 overflow-x-auto border border-gray-200 select-text">
                              {JSON.stringify(a.output, null, 2)}
                            </code>
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                ))}

                {audits.length === 0 && (
                  <div className="text-center p-6 text-xs text-slate-400 bg-gray-50 border border-gray-200 rounded-xl">
                    No tool execution calls captured yet.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  System Instruction Prompt Template
                </label>
                <div className="text-[11px] text-slate-455 mb-2 leading-relaxed">
                  Modify the instructions variables using double curly brackets (e.g. `{'{{contact_name}}'}`, `{'{{tenant_id}}'}`) to seed them dynamically.
                </div>
                <textarea
                  value={promptContent}
                  onChange={(e) => setPromptContent(e.target.value)}
                  className="w-full h-80 bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-mono text-slate-800 placeholder-gray-400 focus:outline-none focus:border-blue-600 resize-none leading-relaxed"
                />
                <button
                  onClick={handleSavePrompt}
                  className="mt-2.5 w-full bg-[#0068FF] hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs py-2 px-4 rounded-xl transition"
                >
                  Save New Version Template
                </button>
              </div>

              {/* Version History List */}
              <div className="border-t border-gray-200 pt-4">
                <h5 className="font-semibold text-xs text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Version History
                </h5>
                <div className="space-y-2">
                  {promptVersions.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => handleSelectPromptVersion(v)}
                      className={`w-full text-left p-3 rounded-xl border text-xs flex items-center justify-between gap-3 transition ${v.is_active
                          ? "bg-blue-50 border-blue-200/50 text-blue-700 font-semibold"
                          : "bg-gray-50 border-gray-150 text-slate-500 hover:bg-gray-100 hover:text-slate-700"
                        }`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800">
                          Version {v.version} {v.is_active && "(Active)"}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 truncate">
                          {v.content.slice(0, 80)}...
                        </div>
                      </div>
                      <span className="text-[9px] text-slate-400 whitespace-nowrap">
                        {new Date(v.created_at).toLocaleDateString()}
                      </span>
                    </button>
                  ))}

                  {promptVersions.length === 0 && (
                    <div className="text-center p-6 text-xs text-slate-400 bg-gray-50 border border-gray-200 rounded-xl">
                      No prompt history logged.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. New Chat Modal Dialog */}
      {isNewChatOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 text-slate-800">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h3 className="font-bold text-lg text-slate-800">Create New Simulator Chat</h3>
              <button
                onClick={() => setIsNewChatOpen(false)}
                className="text-slate-500 hover:text-slate-700 transition text-sm font-semibold"
              >
                Close
              </button>
            </div>

            {/* Presets Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Quick Preset Templates (Candidate Context)
              </label>
              <div className="grid grid-cols-1 gap-2">
                {PRESET_CONTEXTS.map((p, idx) => (
                  <button
                    key={p.userId}
                    type="button"
                    onClick={() => handlePresetSelect(idx)}
                    className={`w-full text-left p-3 rounded-2xl border text-xs flex items-center justify-between transition ${selectedPresetIndex === idx
                        ? "bg-blue-50 border-blue-200/50 text-blue-750 font-semibold"
                        : "bg-gray-50 border border-gray-150 text-slate-500 hover:bg-gray-100 hover:text-slate-800"
                      }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-800">{p.name}</div>
                      <div className="text-[10px] text-slate-450 mt-1 truncate max-w-xs">{p.text}</div>
                    </div>
                    {selectedPresetIndex === idx && <Sparkles className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateChat} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    External Thread ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. thread-12345"
                    value={newThreadId}
                    onChange={(e) => setNewThreadId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    External User ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. user-abc"
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Display Contact Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Candidate Nguyen Van A"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-2 border-t border-gray-200 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsNewChatOpen(false)}
                  className="px-4 py-2.5 border border-gray-200 text-slate-500 rounded-xl hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-[#0068FF] text-white rounded-xl font-semibold hover:bg-blue-500 transition disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Chat Section"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit JSON inspector modal */}
      {selectedAuditForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-800">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-slate-850 font-mono text-sm">
                  {selectedAuditForModal.tool_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAuditForModal(null)}
                className="text-slate-500 hover:text-slate-700 text-sm font-semibold p-1"
              >
                Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Input Parameters
                </div>
                <code className="block p-3 rounded-xl bg-gray-50 text-slate-700 text-xs font-mono overflow-x-auto border border-gray-150 select-text">
                  {JSON.stringify(selectedAuditForModal.input, null, 2)}
                </code>
              </div>
              {selectedAuditForModal.output && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Output Payload
                  </div>
                  <code className="block p-3 rounded-xl bg-gray-50 text-slate-700 text-xs font-mono overflow-x-auto border border-gray-150 select-text">
                    {JSON.stringify(selectedAuditForModal.output, null, 2)}
                  </code>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedAuditForModal(null)}
                className="bg-gray-100 hover:bg-gray-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500 bg-[#F0F2F5] h-screen">Loading Zalo Simulator...</div>}>
      <Dashboard />
    </Suspense>
  );
}
