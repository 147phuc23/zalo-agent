"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare, Cpu, Terminal, Sparkles } from "lucide-react";

import { useConversations } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useAudits } from "@/hooks/useAudits";
import { usePrompts } from "@/hooks/usePrompts";
import { Conversation, Message, Audit, PromptVersion } from "@/lib/types";

import { ConversationList } from "@/components/ConversationList";
import { ChatTimeline } from "@/components/ChatTimeline";
import { MessageComposer } from "@/components/MessageComposer";
import { InspectorPanel } from "@/components/InspectorPanel";
import { NewChatModal, PRESET_CONTEXTS } from "@/components/NewChatModal";
import { AuditDetailModal } from "@/components/AuditDetailModal";
import { Toast } from "@/components/Toast";

const AVAILABLE_MODELS = [
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
  { id: "tencent/hy3:free", name: "OpenRouter Owl Alpha (Default)" },
];

function Dashboard() {
  const searchParams = useSearchParams();

  // Selected conversation state
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // SWR hooks
  const { conversations, error: conversationsError, mutate: mutateConversations } = useConversations();
  const { messages, error: messagesError, mutate: mutateMessages } = useMessages(selectedId);
  const { audits, error: auditsError } = useAudits(selectedId);
  const { promptVersions, error: promptsError, mutate: mutatePrompts } = usePrompts();

  // Local state for dropdown/prompt options and UI modal state
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>(AVAILABLE_MODELS);
  const [promptContent, setPromptContent] = useState("");
  const [activeTab, setActiveTab] = useState<"debugger" | "prompt" | "guests">("debugger");
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [isUploadingCv, setIsUploadingCv] = useState(false);

  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  };

  // Inspect modals
  const [selectedAuditForModal, setSelectedAuditForModal] = useState<Audit | null>(null);

  // New Chat Form State
  const [newThreadId, setNewThreadId] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(-1);

  // Active UI actions for message bubbles (reactions and replies status)
  const [activeActions, setActiveActions] = useState<Record<string, "reacting" | "replying" | null>>({});
  const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] = useState<string | null>(null);

  // Sync selectedId with query param on startup
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

  // Update prompt content when SWR loads prompt versions or an active one is found
  useEffect(() => {
    if (promptVersions.length > 0) {
      const active = promptVersions.find((v) => v.is_active);
      if (active) {
        setPromptContent(active.content);
      }
    }
  }, [promptVersions]);

  // Open inspector by default on desktop screens
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      setShowInspector(true);
    }
  }, []);

  // Bind/unbind global click listener only while picker is active to close reaction picker
  useEffect(() => {
    if (!activeReactionPickerMessageId) return;

    const handleGlobalClick = () => {
      setActiveReactionPickerMessageId(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
    };
  }, [activeReactionPickerMessageId]);

  // Surface SWR errors in UI state (toast)
  useEffect(() => {
    const error = conversationsError || messagesError || auditsError || promptsError;
    if (error) {
      showToast(error.message || "Failed to synchronise data", "error");
    }
  }, [conversationsError, messagesError, auditsError, promptsError]);

  // Mark selected conversation as read
  useEffect(() => {
    if (selectedId) {
      fetch(`/api/conversations/${selectedId}/read`, { method: "POST" }).catch((err) =>
        console.error("Failed to mark as read", err)
      );
    }
  }, [selectedId]);

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
        throw new Error(data.error || "Failed to react");
      }
      if (data.message) {
        mutateMessages(
          (current) => (current ? current.map((msg) => (msg.id === messageId ? data.message : msg)) : []),
          { revalidate: false }
        );
      } else {
        mutateMessages();
      }
    } catch (err: any) {
      showToast(err.message || "Error applying reaction", "error");
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
        throw new Error(data.error || "Failed to trigger AI reaction");
      }
      if (data.message) {
        mutateMessages(
          (current) => (current ? current.map((msg) => (msg.id === messageId ? data.message : msg)) : []),
          { revalidate: false }
        );
      } else {
        mutateMessages();
      }
    } catch (err: any) {
      showToast(err.message || "Error triggering AI reaction", "error");
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
        throw new Error(data.error || "Failed to trigger AI reply");
      }
      if (Array.isArray(data.drafts)) {
        mutateMessages(
          (current) => (current ? [...current, ...data.drafts] : data.drafts),
          { revalidate: false }
        );
      } else {
        mutateMessages();
      }
    } catch (err: any) {
      showToast(err.message || "Error triggering AI reply", "error");
    } finally {
      setActiveActions((prev) => ({ ...prev, [messageId]: null }));
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
    mutateMessages((prev) => [...(prev || []), optimisticMsg], { revalidate: false });

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          threadId: currentConvo.externalThreadId,
          senderExternalId: currentConvo.contact?.externalUserId ?? "simulator-user",
          text: messageText,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || "Failed to send");
      }
      mutateMessages();
    } catch (err: any) {
      showToast(err.message || "Failed to send message", "error");
      mutateMessages();
    }
  };

  const handleUploadCv = async (file: File) => {
    if (!selectedId) return;
    const currentConvo = conversations.find((c) => c.id === selectedId);
    if (!currentConvo) return;

    const formData = new FormData();
    formData.append("file", file);

    setIsUploadingCv(true);
    
    // Optimistic payload
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
            url: "",
            name: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          },
        ],
      },
    };
    mutateMessages((prev) => [...(prev || []), optimisticMsg], { revalidate: false });

    try {
      const res = await fetch(`/api/conversations/${selectedId}/cv`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || "Failed to upload file");
      }
      // Refresh messages after brief delay
      setTimeout(() => {
        mutateMessages();
      }, 1000);
    } catch (err: any) {
      showToast(err.message || "Failed to upload CV", "error");
      mutateMessages();
    } finally {
      setIsUploadingCv(false);
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

        await mutateConversations();
        setSelectedId(data.conversationId);
        setIsNewChatOpen(false);

        // Reset fields
        setNewThreadId("");
        setNewUserId("");
        setNewDisplayName("");
        setSelectedPresetIndex(-1);
        showToast("Conversation created successfully!");
      } else {
        throw new Error(data.error || "Failed to create conversation");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to create conversation", "error");
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
        mutateConversations(
          (prev) =>
            (prev || []).map((c) => (c.id === selectedId ? { ...c, overrideModel: modelId } : c)),
          { revalidate: false }
        );
        showToast("AI model settings updated!");
      } else {
        throw new Error("Failed to update override model");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to update model settings", "error");
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
        showToast("Prompt template version saved successfully!");
        mutatePrompts();
      } else {
        throw new Error("Failed to save prompt template");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to save prompt", "error");
    }
  };

  const handleSelectPromptVersion = (version: PromptVersion) => {
    setPromptContent(version.content);
    // Automatically apply selected version in active state
    fetch("/api/prompts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "assistant", content: version.content }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to activate version");
        showToast(`Activated Prompt Version ${version.version}`);
        mutatePrompts();
      })
      .catch((err) => {
        showToast("Failed to activate version: " + err.message, "error");
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
    content += `**Model:** ${current.overrideModel ?? "Default"}\n`;
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

    // Fetch `/api/export` and trigger download in the browser
    fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, filename }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Export failed on server");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast("Session log exported and downloaded!");
      })
      .catch((err) => {
        console.error("Export error", err);
        showToast(`Failed to export log: ${err.message}`, "error");
      });
  };

  const activeConversation = conversations.find((c) => c.id === selectedId);

  return (
    <div className="flex h-screen bg-[#F0F2F5] font-sans text-slate-800 overflow-hidden">
      {/* 1. Left Sidebar: Chat Sessions List */}
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        onSelectId={setSelectedId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewChatOpen={() => setIsNewChatOpen(true)}
      />

      {/* 2. Middle Pane: Chat Simulator View */}
      <div
        className={`flex-1 min-w-0 flex flex-col h-full bg-[#F4F5F7] relative ${
          selectedId ? "flex" : "hidden md:flex"
        }`}
      >
        {activeConversation ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-slate-600 transition"
                  title="Back to Sessions"
                >
                  <Terminal className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-800 text-base truncate">
                    {activeConversation.contact?.displayName ?? activeConversation.contact?.externalUserId}
                  </h3>
                  <span className="text-xs text-slate-500 truncate block">
                    Zalo Thread: {activeConversation.externalThreadId}
                  </span>
                </div>
              </div>

              {/* Model selection dropdown & Inspector Toggle */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="hidden sm:flex items-center gap-2">
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

                <button
                  type="button"
                  onClick={() => setShowInspector(!showInspector)}
                  className={`p-2 rounded-xl border transition flex items-center gap-1.5 text-xs font-semibold ${
                    showInspector
                      ? "bg-blue-50 border-blue-200/50 text-blue-650"
                      : "bg-white border-gray-200 text-slate-600 hover:bg-gray-50"
                  }`}
                  title="Toggle Inspector"
                >
                  <Terminal className="w-4 h-4" />
                  <span className="hidden md:inline">Inspector</span>
                </button>
              </div>
            </div>

            {/* Chat Messages Panel */}
            <ChatTimeline
              messages={messages}
              audits={audits}
              activeActions={activeActions}
              activeReactionPickerMessageId={activeReactionPickerMessageId}
              setActiveReactionPickerMessageId={setActiveReactionPickerMessageId}
              onManualReactClick={handleManualReactClick}
              onAiReactClick={handleAiReactClick}
              onAiReplyClick={handleAiReplyClick}
              onInspectAudit={setSelectedAuditForModal}
            />

            {/* Inbound Send Box (Simulates Candidate typing) */}
            <MessageComposer
              inputText={inputText}
              setInputText={setInputText}
              onSubmit={handleSendMessage}
              isUploadingCv={isUploadingCv}
              onUploadCv={handleUploadCv}
            />
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
      <InspectorPanel
        showInspector={showInspector}
        onCloseInspector={() => setShowInspector(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedId={selectedId}
        audits={audits}
        onExportSession={handleExportSession}
        onInspectAudit={setSelectedAuditForModal}
        promptContent={promptContent}
        setPromptContent={setPromptContent}
        promptVersions={promptVersions}
        onSavePrompt={handleSavePrompt}
        onSelectPromptVersion={handleSelectPromptVersion}
        showToast={showToast}
      />

      {/* Inspector Backdrop (Mobile/Tablet) */}
      {showInspector && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setShowInspector(false)}
        />
      )}

      {/* 4. New Chat Modal Dialog */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onSubmit={handleCreateChat}
        newThreadId={newThreadId}
        setNewThreadId={setNewThreadId}
        newUserId={newUserId}
        setNewUserId={setNewUserId}
        newDisplayName={newDisplayName}
        setNewDisplayName={setNewDisplayName}
        selectedPresetIndex={selectedPresetIndex}
        onSelectPreset={handlePresetSelect}
        isSubmitting={isSubmitting}
      />

      {/* Audit JSON inspector modal */}
      <AuditDetailModal
        audit={selectedAuditForModal}
        onClose={() => setSelectedAuditForModal(null)}
      />

      {/* Toast Notification overlays */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-slate-500 bg-[#F0F2F5] h-screen">
          Loading Zalo Simulator...
        </div>
      }
    >
      <Dashboard />
    </Suspense>
  );
}
