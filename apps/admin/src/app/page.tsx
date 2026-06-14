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
  const searchParams = useSearchParams();

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

    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zalo_session_${selectedId.slice(0, 8)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const getUnreadCount = (convo: Conversation) => {
    // If not selected, show count of inbound unread messages if tracked or computed
    return messages.filter((m) => m.conversationId === convo.id && m.direction === "inbound" && !m.isRead).length;
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
    <div className="flex h-screen bg-[#110e0c] font-sans text-stone-100 overflow-hidden">
      {/* 1. Left Sidebar: Chat Sessions List */}
      <div className="w-80 border-r border-stone-800 bg-[#161210] flex flex-col h-full">
        <div className="p-4 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold tracking-tight text-lg">Zalo Simulator</h2>
          </div>
          <button
            onClick={() => setIsNewChatOpen(true)}
            className="p-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-100 transition"
            title="Create Simulated Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-stone-800 relative">
          <Search className="w-4 h-4 text-stone-500 absolute left-6 top-6" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-900 border border-stone-800 rounded-xl py-2 pl-9 pr-4 text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-600"
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
                className={`w-full text-left p-3.5 rounded-2xl flex items-center justify-between gap-3 transition ${
                  isSelected
                    ? "bg-amber-600/15 border border-amber-600/30 text-stone-100"
                    : "bg-transparent border border-transparent text-stone-400 hover:bg-stone-900/40 hover:text-stone-200"
                }`}
              >
                <div className="min-w-0">
                  <div className={`font-semibold truncate text-sm ${isSelected ? "text-amber-500" : "text-stone-200"}`}>
                    {displayName}
                  </div>
                  <div className="text-xs text-stone-500 truncate mt-1">
                    Thread: {c.externalThreadId}
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span className="text-[10px] text-stone-500">
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
            <div className="text-center p-6 text-xs text-stone-600 mt-10">
              No simulated chat sections found.
            </div>
          )}
        </div>
      </div>

      {/* 2. Middle Pane: Chat Simulator View */}
      <div className="flex-1 flex flex-col h-full bg-[#110e0c] relative">
        {activeConversation ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b border-stone-800 bg-[#161210]/60 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-stone-100 text-base">
                  {activeConversation.contact?.displayName ?? activeConversation.contact?.externalUserId}
                </h3>
                <span className="text-xs text-stone-500">
                  Zalo Thread: {activeConversation.externalThreadId}
                </span>
              </div>

              {/* Model selection dropdown */}
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-stone-400" />
                <select
                  value={activeConversation.overrideModel ?? "default"}
                  onChange={(e) => handleUpdateModel(e.target.value === "default" ? null : e.target.value)}
                  className="bg-stone-900 border border-stone-800 rounded-lg text-xs py-1.5 px-3 text-stone-300 focus:outline-none focus:border-amber-600"
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
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isInbound ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 px-4 shadow-lg leading-relaxed text-sm ${
                          isInbound
                            ? "bg-stone-900 border border-stone-800 text-stone-200 rounded-tl-sm"
                            : "bg-amber-600 text-stone-100 rounded-tr-sm"
                        }`}
                      >
                        <div>{m.text}</div>
                        <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] text-stone-400 select-none">
                          <span>
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {!isInbound && (
                            m.isRead ? (
                              <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-stone-500" />
                            )
                          )}
                        </div>
                      </div>
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
                        className="max-w-[90%] w-full bg-stone-950/40 border border-dashed border-stone-850 rounded-xl p-3 cursor-pointer hover:bg-stone-950/60 transition group"
                      >
                        <div className="flex items-center justify-between gap-2 select-none">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Terminal className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            <span className="font-mono text-xs font-semibold text-stone-300 truncate">
                              {a.tool_name}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-stone-500 group-hover:text-stone-300 transition" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-stone-500 group-hover:text-stone-300 transition" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                                a.status === "ok"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-red-500/10 text-red-400"
                              }`}
                            >
                              {a.status}
                            </span>
                            <button
                              onClick={() => setSelectedAuditForModal(a)}
                              className="text-[10px] text-amber-500 hover:text-amber-400 hover:underline font-semibold"
                            >
                              Inspect
                            </button>
                          </div>
                        </div>

                        {!isExpanded && a.input && Object.keys(a.input).length > 0 && (
                          <div className="mt-1.5 text-[11px] text-stone-500 font-mono truncate max-w-full">
                            args: {JSON.stringify(a.input)}
                          </div>
                        )}

                        {isExpanded && (
                          <div className="mt-2.5 space-y-2 text-left" onClick={(e) => e.stopPropagation()}>
                            {a.input && Object.keys(a.input).length > 0 && (
                              <div>
                                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-1">
                                  Arguments
                                </div>
                                <code className="block p-2.5 rounded-lg bg-stone-950 text-stone-300 text-[11px] font-mono overflow-x-auto border border-stone-850 max-h-48 select-text">
                                  {inputStr}
                                </code>
                              </div>
                            )}
                            {a.output && (
                              <div>
                                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-1">
                                  Response
                                </div>
                                <code className="block p-2.5 rounded-lg bg-stone-950 text-stone-300 text-[11px] font-mono overflow-x-auto border border-stone-850 max-h-48 select-text">
                                  {outputStr}
                                </code>
                              </div>
                            )}
                            {isLong && (
                              <div className="flex justify-end pt-1">
                                <button
                                  onClick={() => setSelectedAuditForModal(a)}
                                  className="text-[11px] bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 px-2.5 py-1 rounded-lg border border-amber-500/20 font-semibold flex items-center gap-1 transition"
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
            <form onSubmit={handleSendMessage} className="p-4 border-t border-stone-800 bg-[#161210]/40">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a simulated message bubble as Candidate..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-4 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-600"
                />
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-stone-100 px-4 rounded-xl flex items-center justify-center transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-stone-500">
            <MessageSquare className="w-12 h-12 text-stone-700 mb-3" />
            <h3 className="font-semibold text-stone-400 text-base">Zalo Sandbox Chatroom</h3>
            <p className="text-xs text-stone-600 max-w-sm mt-1">
              Select an existing chat thread or create a new mock section to trigger toolcalls and debug AI prompts.
            </p>
          </div>
        )}
      </div>

      {/* 3. Right Pane: Debugger Inspector & Prompts panel */}
      <div className="w-96 border-l border-stone-800 bg-[#161210] flex flex-col h-full">
        {/* Tab Header */}
        <div className="flex border-b border-stone-800 text-sm">
          <button
            onClick={() => setActiveTab("debugger")}
            className={`flex-1 py-3 text-center font-medium border-b-2 transition ${
              activeTab === "debugger"
                ? "border-amber-500 text-amber-500 bg-amber-500/[0.02]"
                : "border-transparent text-stone-400 hover:text-stone-200"
            }`}
          >
            <Terminal className="w-4 h-4 inline mr-2" />
            Agentic Inspector
          </button>
          <button
            onClick={() => setActiveTab("prompt")}
            className={`flex-1 py-3 text-center font-medium border-b-2 transition ${
              activeTab === "prompt"
                ? "border-amber-500 text-amber-500 bg-amber-500/[0.02]"
                : "border-transparent text-stone-400 hover:text-stone-200"
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
                <h4 className="font-semibold text-xs tracking-wider uppercase text-stone-400">
                  Tool Calls & Audits
                </h4>
                {selectedId && (
                  <button
                    onClick={handleExportSession}
                    className="text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1 font-semibold"
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
                    className={`rounded-xl border p-3 bg-stone-950/50 ${
                      a.status === "ok" ? "border-stone-850" : "border-red-900/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-amber-500" />
                        <span className="font-mono text-xs font-bold text-stone-200">
                          {a.tool_name}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          a.status === "ok"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {a.status}
                      </span>
                    </div>

                    <div className="text-[10px] text-stone-500 flex items-center gap-1 mb-2">
                      <Clock className="w-3 h-3" />
                      {new Date(a.created_at).toLocaleTimeString()}
                    </div>

                    <details className="mt-2 text-xs group">
                      <summary className="cursor-pointer text-[11px] text-stone-400 select-none hover:text-stone-300 font-semibold">
                        View parameters / results
                      </summary>
                      <div className="mt-2 space-y-2">
                        <div>
                          <div className="text-[10px] text-stone-500 mb-1">Inputs:</div>
                          <code className="block p-2 rounded bg-stone-900 text-[10px] text-stone-300 overflow-x-auto border border-stone-800 select-text">
                            {JSON.stringify(a.input, null, 2)}
                          </code>
                        </div>
                        {a.output && (
                          <div>
                            <div className="text-[10px] text-stone-500 mb-1">Outputs:</div>
                            <code className="block p-2 rounded bg-stone-900 text-[10px] text-stone-300 overflow-x-auto border border-stone-800 select-text">
                              {JSON.stringify(a.output, null, 2)}
                            </code>
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                ))}

                {audits.length === 0 && (
                  <div className="text-center p-6 text-xs text-stone-600 bg-stone-950/20 border border-stone-900 rounded-xl">
                    No tool execution calls captured yet.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
                  System Instruction Prompt Template
                </label>
                <div className="text-[11px] text-stone-500 mb-2 leading-relaxed">
                  Modify the instructions variables using double curly brackets (e.g. `{'{{contact_name}}'}`, `{'{{tenant_id}}'}`) to seed them dynamically.
                </div>
                <textarea
                  value={promptContent}
                  onChange={(e) => setPromptContent(e.target.value)}
                  className="w-full h-80 bg-stone-900 border border-stone-800 rounded-xl p-3 text-xs font-mono text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-600 resize-none leading-relaxed"
                />
                <button
                  onClick={handleSavePrompt}
                  className="mt-2.5 w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-stone-100 font-semibold text-xs py-2 px-4 rounded-xl transition"
                >
                  Save New Version Template
                </button>
              </div>

              {/* Version History List */}
              <div className="border-t border-stone-800 pt-4">
                <h5 className="font-semibold text-xs text-stone-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-stone-400" />
                  Version History
                </h5>
                <div className="space-y-2">
                  {promptVersions.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => handleSelectPromptVersion(v)}
                      className={`w-full text-left p-3 rounded-xl border text-xs flex items-center justify-between gap-3 transition ${
                        v.is_active
                          ? "bg-amber-600/10 border-amber-600/30 text-amber-500 font-semibold"
                          : "bg-stone-950/40 border-stone-900 text-stone-400 hover:bg-stone-900/40 hover:text-stone-300"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-stone-200">
                          Version {v.version} {v.is_active && "(Active)"}
                        </div>
                        <div className="text-[10px] text-stone-500 mt-1 truncate">
                          {v.content.slice(0, 80)}...
                        </div>
                      </div>
                      <span className="text-[9px] text-stone-500 whitespace-nowrap">
                        {new Date(v.created_at).toLocaleDateString()}
                      </span>
                    </button>
                  ))}

                  {promptVersions.length === 0 && (
                    <div className="text-center p-6 text-xs text-stone-600 bg-stone-950/20 border border-stone-900 rounded-xl">
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
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161210] border border-stone-850 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-bold text-lg text-stone-200">Create New Simulator Chat</h3>
              <button
                onClick={() => setIsNewChatOpen(false)}
                className="text-stone-500 hover:text-stone-300 transition text-sm font-semibold"
              >
                Close
              </button>
            </div>

            {/* Presets Selection */}
            <div>
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
                Quick Preset Templates (Candidate Context)
              </label>
              <div className="grid grid-cols-1 gap-2">
                {PRESET_CONTEXTS.map((p, idx) => (
                  <button
                    key={p.userId}
                    type="button"
                    onClick={() => handlePresetSelect(idx)}
                    className={`w-full text-left p-3 rounded-2xl border text-xs flex items-center justify-between transition ${
                      selectedPresetIndex === idx
                        ? "bg-amber-600/10 border-amber-600/30 text-amber-500"
                        : "bg-stone-950/50 border-stone-900 text-stone-400 hover:bg-stone-900/40 hover:text-stone-300"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-stone-200">{p.name}</div>
                      <div className="text-[10px] text-stone-500 mt-1 truncate max-w-xs">{p.text}</div>
                    </div>
                    {selectedPresetIndex === idx && <Sparkles className="w-4 h-4 text-amber-500" />}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateChat} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
                    External Thread ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. thread-12345"
                    value={newThreadId}
                    onChange={(e) => setNewThreadId(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-200 focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
                    External User ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. user-abc"
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-200 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
                  Display Contact Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Candidate Nguyen Van A"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-200 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="pt-2 border-t border-stone-800 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsNewChatOpen(false)}
                  className="px-4 py-2.5 border border-stone-800 text-stone-400 rounded-xl hover:bg-stone-900 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-amber-600 text-stone-100 rounded-xl font-semibold hover:bg-amber-500 transition disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#161210] border border-stone-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-stone-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-stone-800 bg-stone-950/20">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-stone-200 font-mono text-sm">
                  {selectedAuditForModal.tool_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAuditForModal(null)}
                className="text-stone-400 hover:text-stone-200 text-sm font-semibold p-1"
              >
                Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4">
              <div>
                <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">
                  Input Parameters
                </div>
                <code className="block p-3 rounded-xl bg-stone-950 text-stone-300 text-xs font-mono overflow-x-auto border border-stone-850 select-text">
                  {JSON.stringify(selectedAuditForModal.input, null, 2)}
                </code>
              </div>
              {selectedAuditForModal.output && (
                <div>
                  <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">
                    Output Payload
                  </div>
                  <code className="block p-3 rounded-xl bg-stone-950 text-stone-300 text-xs font-mono overflow-x-auto border border-stone-850 select-text">
                    {JSON.stringify(selectedAuditForModal.output, null, 2)}
                  </code>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-stone-800 flex justify-end">
              <button
                onClick={() => setSelectedAuditForModal(null)}
                className="bg-stone-800 hover:bg-stone-750 text-stone-200 px-4 py-2.5 rounded-xl text-xs font-semibold transition"
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
    <Suspense fallback={<div className="p-6 text-sm text-stone-500 bg-[#110e0c] h-screen">Loading Zalo Simulator...</div>}>
      <Dashboard />
    </Suspense>
  );
}
