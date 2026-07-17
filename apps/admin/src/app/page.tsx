"use client";

import React, { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Briefcase,
  FileCode,
  CheckSquare,
  Bell,
  ChevronDown,
  Sparkles,
  Plus,
  Search,
  Cpu,
  Terminal,
  Sliders,
  ChevronUp,
  Clock,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Send,
  Upload,
  RefreshCw,
  LogOut,
  CheckCircle,
  XCircle,
  Trash2,
  Edit2,
  FileText,
} from "lucide-react";

import { useConversations } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useAudits } from "@/hooks/useAudits";
import { usePrompts } from "@/hooks/usePrompts";
import { Conversation, Message, Audit, PromptVersion } from "@/lib/types";

import { ConversationList } from "@/components/ConversationList";
import { ChatTimeline } from "@/components/ChatTimeline";
import { MessageComposer } from "@/components/MessageComposer";
import { InspectorPanel } from "@/components/InspectorPanel";
import { NewChatModal } from "@/components/NewChatModal";
import { AuditDetailModal } from "@/components/AuditDetailModal";
import { Toast } from "@/components/Toast";

// Static models fallback
const AVAILABLE_MODELS = [
  { id: "tencent/hy3:free", name: "OpenRouter Owl Alpha (Default)" },
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nvidia Nemotron 3 Ultra 550B (Free)" },
  { id: "poolside/laguna-m.1:free", name: "Poolside Laguna M.1 (Free)" },
];

const StatsCardSkeleton = () => (
  <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-sm relative flex flex-col justify-between animate-pulse">
    <div>
      <div className="h-3 bg-stone-200 rounded w-24 mb-3"></div>
      <div className="h-8 bg-stone-200 rounded w-16 mb-2"></div>
    </div>
    <div className="h-3 bg-stone-200 rounded w-28 mt-4"></div>
    <div className="w-5 h-5 bg-stone-200 rounded-full absolute right-6 top-6"></div>
  </div>
);

const FunnelSkeleton = () => (
  <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-sm flex flex-col animate-pulse">
    <div className="h-5 bg-stone-200 rounded w-32 mb-2"></div>
    <div className="h-3 bg-stone-200 rounded w-48 mb-8"></div>
    <div className="space-y-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="flex justify-between">
            <div className="h-3 bg-stone-200 rounded w-16"></div>
            <div className="h-3 bg-stone-200 rounded w-8"></div>
          </div>
          <div className="w-full bg-stone-100 h-3 rounded-full"></div>
        </div>
      ))}
    </div>
  </div>
);

const BotPerformanceSkeleton = () => (
  <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between animate-pulse">
    <div>
      <div className="h-5 bg-stone-200 rounded w-36 mb-2"></div>
      <div className="h-3 bg-stone-200 rounded w-24 mb-6"></div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between py-2 border-b border-stone-100">
            <div className="h-3 bg-stone-200 rounded w-32"></div>
            <div className="h-3 bg-stone-200 rounded w-8"></div>
          </div>
        ))}
      </div>
    </div>
    <div className="border-t border-stone-100 pt-6 mt-6">
      <div className="h-3 bg-stone-200 rounded w-28 mb-3"></div>
      <div className="flex justify-between gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex-1 space-y-2">
            <div className="h-6 bg-stone-200 rounded w-12"></div>
            <div className="h-3 bg-stone-200 rounded w-16"></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

function DashboardMain() {
  const searchParams = useSearchParams();

  // Selected view tab
  const [activeView, setActiveView] = useState<
    "dashboard" | "chats" | "candidates" | "jobs" | "prompts" | "todo" | "notifications"
  >("dashboard");

  // Selected conversation state for chats view
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // React Query hooks
  const { conversations, error: conversationsError, isLoading: isConversationsLoading, mutate: mutateConversations } = useConversations();
  const { messages, error: messagesError, isLoading: isMessagesLoading, mutate: mutateMessages } = useMessages(selectedId);
  const { audits, error: auditsError, isLoading: isAuditsLoading } = useAudits(selectedId);
  const { promptVersions, error: promptsError, isLoading: isPromptsLoading, mutate: mutatePrompts } = usePrompts();

  // Local state for dropdown/prompt options and UI modal state
  const [availableModels, setAvailableModels] = useState(AVAILABLE_MODELS);
  const [promptContent, setPromptContent] = useState("");
  const [activeInspectorTab, setActiveInspectorTab] = useState<"debugger" | "prompt" | "guests">("debugger");
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [isUploadingCv, setIsUploadingCv] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Inspect modals
  const [selectedAuditForModal, setSelectedAuditForModal] = useState<Audit | null>(null);

  // New Chat Form State
  const [newThreadId, setNewThreadId] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(-1);

  const handlePresetSelect = (index: number) => {
    setSelectedPresetIndex(index);
    if (index !== -1) {
      const preset = [
        { name: "Frontend Junior", userId: "zalo-dev-front", displayName: "Trần Anh Tú", text: "Chào bạn, mình muốn ứng tuyển Frontend Engineer. Đây là CV của mình." },
        { name: "NodeJS Backend", userId: "zalo-dev-node", displayName: "Phạm Minh Hoàng", text: "Alo, bên mình còn tuyển NodeJS Developer không ạ?" },
        { name: "Fresh Graduate", userId: "zalo-fresh-grad", displayName: "Lê Thị Hồng", text: "Dạ em mới ra trường, muốn tìm cơ hội thực tập phát triển web." }
      ][index];
      setNewThreadId(`thread-${preset.userId}`);
      setNewUserId(preset.userId);
      setNewDisplayName(preset.displayName);
    }
  };

  // Active UI actions for message bubbles (reactions and replies status)
  const [activeActions, setActiveActions] = useState<Record<string, "reacting" | "replying" | null>>({});
  const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] = useState<string | null>(null);

  // Dynamic candidate list state
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [isCandidatesLoading, setIsCandidatesLoading] = useState(true);
  const [candidateSearch, setCandidateSearch] = useState("");

  // Dynamic jobs list state
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [draftJobs, setDraftJobs] = useState<any[]>([]);
  const [isJobsLoading, setIsJobsLoading] = useState(true);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newJobCompany, setNewJobCompany] = useState("");
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [isUploadingJd, setIsUploadingJd] = useState(false);

  // Dynamic knowledge gaps state
  const [gaps, setGaps] = useState<any[]>([]);
  const [gapAnswers, setGapAnswers] = useState<Record<string, string>>({});
  const [isGapsLoading, setIsGapsLoading] = useState(true);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);

  // Notification logs state
  const [notifications, setNotifications] = useState<any[]>([]);

  // Analytics date range filter state
  const [analyticsRange, setAnalyticsRange] = useState<"week" | "month" | "quarter">("month");

  // Real backend analytics state
  const [analytics, setAnalytics] = useState<any>({
    totalCandidates: 247,
    newCandidatesThisMonth: 12,
    totalConversations: 38,
    openGapsNeedReview: 4,
    avgResponseTimeSec: "1.8",
    botResponseRate: "94.2",
    funnel: {
      applied: 247,
      screened: 120,
      interviewed: 42,
      offered: 18,
      hired: 11,
    },
    totalMessages: 1204,
    estimatedCost: "42.80",
    rangeLabel: "this month",
    prevRangeLabel: "last month",
  });

  const loadAnalytics = async (range = analyticsRange) => {
    setIsAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/analytics?range=${range}`);
      const data = await res.json();
      if (data.ok && data.analytics) {
        setAnalytics(data.analytics);
      }
    } catch (err: any) {
      console.error("Failed to load analytics", err);
    } finally {
      setIsAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeView === "dashboard") {
      loadAnalytics(analyticsRange);
    }
  }, [activeView, analyticsRange]);

  // SWR Sync
  useEffect(() => {
    const queryId = searchParams.get("id");
    if (queryId) {
      setSelectedId(queryId);
      setActiveView("chats");
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

  // Toast notifier helper
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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

  // Close reaction picker on click
  useEffect(() => {
    if (!activeReactionPickerMessageId) return;
    const handleGlobalClick = () => setActiveReactionPickerMessageId(null);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, [activeReactionPickerMessageId]);

  // -------------------------------------------------------------
  // Data Loaders
  // -------------------------------------------------------------
  const loadCandidates = async () => {
    setIsCandidatesLoading(true);
    try {
      const res = await fetch("/api/candidates");
      const data = await res.json();
      if (data.ok) {
        setCandidates(data.candidates || []);
      }
    } catch (err: any) {
      showToast("Failed to load candidates: " + err.message, "error");
    } finally {
      setIsCandidatesLoading(false);
    }
  };

  const loadJobs = async () => {
    setIsJobsLoading(true);
    try {
      const resActive = await fetch("/api/jobs?status=active");
      const dataActive = await resActive.json();
      const resDraft = await fetch("/api/jobs?status=draft");
      const dataDraft = await resDraft.json();

      if (dataActive.ok) setActiveJobs(dataActive.jobs || []);
      if (dataDraft.ok) setDraftJobs(dataDraft.jobs || []);
    } catch (err: any) {
      showToast("Failed to load jobs: " + err.message, "error");
    } finally {
      setIsJobsLoading(false);
    }
  };

  const loadGaps = async () => {
    setIsGapsLoading(true);
    try {
      const res = await fetch("/api/gaps");
      const data = await res.json();
      if (data.ok) {
        setGaps(data.gaps || []);
      }
    } catch (err: any) {
      showToast("Failed to load knowledge gaps: " + err.message, "error");
    } finally {
      setIsGapsLoading(false);
    }
  };

  const generateNotifications = () => {
    // Generate notification stream from SWR/loaded databases
    const items: any[] = [];
    candidates.forEach((c) => {
      if (c.flagged_at) {
        items.push({
          id: `flag-${c.id}`,
          title: "User Profile Flagged",
          desc: `${c.full_name || "Candidate"} was flagged for fraud (risk score: ${c.risk_score}).`,
          time: c.flagged_at,
          type: "warning",
        });
      }
      c.riskSignals?.forEach((s: any) => {
        items.push({
          id: s.id,
          title: `Risk Signal: ${s.rule_name}`,
          desc: `Rule trigger registered for ${c.full_name || "Candidate"} (${s.severity} severity).`,
          time: s.created_at,
          type: s.severity === "high" ? "warning" : "info",
        });
      });
    });

    gaps.forEach((g) => {
      if (g.status === "open") {
        items.push({
          id: `gap-${g.id}`,
          title: "Unanswered Candidate Question",
          desc: `Question about ${g.company_name || "partner company"}: "${g.question}"`,
          time: g.created_at,
          type: "gap",
        });
      }
    });

    items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    setNotifications(items.slice(0, 30));
  };

  useEffect(() => {
    if (activeView === "dashboard") loadAnalytics();
    if (activeView === "candidates") loadCandidates();
    if (activeView === "jobs") loadJobs();
    if (activeView === "todo") loadGaps();
  }, [activeView]);

  useEffect(() => {
    // Sync notifications whenever lists update
    generateNotifications();
  }, [candidates, gaps]);

  useEffect(() => {
    // Run initial data fetch for analytics counters
    loadAnalytics();
    loadCandidates();
    loadJobs();
    loadGaps();
  }, []);

  // -------------------------------------------------------------
  // Operations & Handlers
  // -------------------------------------------------------------
  const handleTransitionApplication = async (appId: string, stage: string, status: string, noteText: string) => {
    try {
      const res = await fetch(`/api/applications/${appId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStage: stage, toStatus: status, note: noteText }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("Application stage updated successfully!");
        loadCandidates();
        if (selectedCandidate) {
          // Refresh selected candidate reference
          const updated = candidates.find(c => c.id === selectedCandidate.id);
          if (updated) setSelectedCandidate(updated);
        }
      } else {
        throw new Error(data.error || "Transition failed");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleToggleJobStatus = async (jobId: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === "active" ? "archived" : "active";
      // To activate, we use activate endpoint
      const url = nextStatus === "active" ? `/api/jobs/${jobId}/activate` : `/api/jobs/${jobId}`;
      const method = nextStatus === "active" ? "POST" : "PATCH";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: nextStatus === "active" ? undefined : JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Job status updated to ${nextStatus}!`);
        loadJobs();
      } else {
        throw new Error(data.error || "Failed to update status");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleUploadJd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jdFile) return;

    setIsUploadingJd(true);
    const formData = new FormData();
    formData.append("file", jdFile);
    if (newJobTitle) formData.append("title", newJobTitle);
    if (newJobCompany) formData.append("company", newJobCompany);

    try {
      const res = await fetch("/api/jobs/jd", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.ok) {
        showToast("Job Description parsed and draft job created!");
        setJdFile(null);
        setNewJobTitle("");
        setNewJobCompany("");
        loadJobs();
      } else {
        throw new Error(data.error || "Parsing failed");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsUploadingJd(false);
    }
  };

  const handleSubmitAnswer = async (gapId: string) => {
    const answer = gapAnswers[gapId];
    if (!answer || !answer.trim()) return;

    try {
      const res = await fetch("/api/gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gapId, answer }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("Question answered and logged to Zalo database!");
        setGapAnswers((prev) => ({ ...prev, [gapId]: "" }));
        loadGaps();
      } else {
        throw new Error(data.error || "Failed to answer gap");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // -------------------------------------------------------------
  // Zalo Simulator Chat Actions
  // -------------------------------------------------------------
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
      if (!data.ok) throw new Error(data.error || "Failed to react");
      if (data.message) {
        mutateMessages(
          (current) => (current ? current.map((msg) => (msg.id === messageId ? data.message : msg)) : []),
          { revalidate: false }
        );
      } else {
        mutateMessages();
      }
    } catch (err: any) {
      showToast(err.message, "error");
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
      if (!data.ok) throw new Error(data.error || "Failed to trigger AI reaction");
      if (data.message) {
        mutateMessages(
          (current) => (current ? current.map((msg) => (msg.id === messageId ? data.message : msg)) : []),
          { revalidate: false }
        );
      } else {
        mutateMessages();
      }
    } catch (err: any) {
      showToast(err.message, "error");
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
      if (!data.ok) throw new Error(data.error || "Failed to trigger AI reply");
      if (Array.isArray(data.drafts)) {
        mutateMessages((current) => (current ? [...current, ...data.drafts] : data.drafts), {
          revalidate: false,
        });
      } else {
        mutateMessages();
      }
    } catch (err: any) {
      showToast(err.message, "error");
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
      if (!data.ok) throw new Error(data.error || "Failed to send");
      if (data.messageId) {
        const realMsg: Message = { ...optimisticMsg, id: data.messageId };
        const drafts: Message[] = Array.isArray(data.drafts) ? data.drafts : [];
        mutateMessages(
          (current) => {
            if (!current) return [realMsg, ...drafts];
            const filtered = current.filter((m) => m.id !== optimisticMsg.id && m.id !== data.messageId);
            return [...filtered, realMsg, ...drafts];
          },
          { revalidate: false }
        );
      } else {
        mutateMessages();
      }
    } catch (err: any) {
      showToast(err.message, "error");
      mutateMessages((prev) => (prev ? prev.filter((m) => m.id !== optimisticMsg.id) : []), {
        revalidate: false,
      });
    }
  };

  const handleUploadCv = async (file: File) => {
    if (!selectedId) return;
    const currentConvo = conversations.find((c) => c.id === selectedId);
    if (!currentConvo) return;

    const formData = new FormData();
    formData.append("file", file);

    setIsUploadingCv(true);

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
      if (!data.ok) throw new Error(data.error || "Failed to upload file");
      const eventResult = data.eventResult;
      if (eventResult && eventResult.messageId) {
        const realMsg: Message = {
          ...optimisticMsg,
          id: eventResult.messageId,
          rawPayload: {
            attachments: [
              {
                type: "file",
                url: data.fileUrl || "",
                name: data.fileName || file.name,
                mimeType: file.type,
                sizeBytes: file.size,
              },
            ],
          },
        };
        const drafts: Message[] = Array.isArray(eventResult.drafts) ? eventResult.drafts : [];
        mutateMessages(
          (current) => {
            if (!current) return [realMsg, ...drafts];
            const filtered = current.filter((m) => m.id !== optimisticMsg.id && m.id !== eventResult.messageId);
            return [...filtered, realMsg, ...drafts];
          },
          { revalidate: false }
        );
      } else {
        mutateMessages();
      }
    } catch (err: any) {
      showToast(err.message, "error");
      mutateMessages((prev) => (prev ? prev.filter((m) => m.id !== optimisticMsg.id) : []), {
        revalidate: false,
      });
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
        if (selectedPresetIndex !== -1) {
          // Applying preset applied content
          const preset = [
            { name: "Frontend Junior", userId: "zalo-dev-front", displayName: "Trần Anh Tú", text: "Chào bạn, mình muốn ứng tuyển Frontend Engineer. Đây là CV của mình." },
            { name: "NodeJS Backend", userId: "zalo-dev-node", displayName: "Phạm Minh Hoàng", text: "Alo, bên mình còn tuyển NodeJS Developer không ạ?" },
            { name: "Fresh Graduate", userId: "zalo-fresh-grad", displayName: "Lê Thị Hồng", text: "Dạ em mới ra trường, muốn tìm cơ hội thực tập phát triển web." }
          ][selectedPresetIndex];

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
        setNewThreadId("");
        setNewUserId("");
        setNewDisplayName("");
        setSelectedPresetIndex(-1);
        showToast("Conversation created successfully!");
        setActiveView("chats");
      } else {
        throw new Error(data.error || "Failed to create conversation");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsSubmitting(false);
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
      }
    } catch (err: any) {
      showToast("Failed to update model settings: " + err.message, "error");
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
      }
    } catch (err: any) {
      showToast("Failed to save prompt: " + err.message, "error");
    }
  };

  const handleSelectPromptVersion = (version: PromptVersion) => {
    setPromptContent(version.content);
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
      .catch((err) => showToast("Failed to activate version: " + err.message, "error"));
  };

  const handleExportSession = () => {
    if (!selectedId) return;
    const current = conversations.find((c) => c.id === selectedId);
    if (!current) return;

    let content = `# Conversation Session Log\n\n`;
    content += `**Conversation ID:** ${selectedId}\n`;
    content += `**Zalo Thread:** ${current.externalThreadId}\n`;
    content += `**Candidate:** ${current.contact?.displayName ?? current.contact?.externalUserId}\n`;
    content += `**Model:** ${current.overrideModel ?? "Default"}\n\nChat transcript and audits included.`;

    const filename = `zalo_session_${selectedId.slice(0, 8)}.md`;

    fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, filename }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Export failed");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast("Session log exported and downloaded!");
      })
      .catch((err) => showToast("Export error: " + err.message, "error"));
  };

  const activeConversation = conversations.find((c) => c.id === selectedId);

  // Filtered candidate list
  const filteredCandidates = useMemo(() => {
    if (!candidateSearch) return candidates;
    const s = candidateSearch.toLowerCase();
    return candidates.filter(
      (c) =>
        (c.full_name || "").toLowerCase().includes(s) ||
        (c.email || "").toLowerCase().includes(s) ||
        (c.phone || "").toLowerCase().includes(s)
    );
  }, [candidates, candidateSearch]);

  return (
    <div className="flex h-screen bg-stone-50 font-sans text-stone-900 overflow-hidden w-full">
      {/* ------------------------------------------------------------- */}
      {/* 1. Global Navigation Sidebar (Styled exactly like shadcn)   */}
      {/* ------------------------------------------------------------- */}
      <div className="w-16 lg:w-56 border-r border-stone-200 bg-white flex flex-col h-full flex-shrink-0 select-none transition-all duration-300">
        {/* Workspace Swapper Header */}
        <div className="p-4 border-b border-stone-200 flex items-center justify-center lg:justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              Z
            </div>
            <div className="min-w-0 hidden lg:block">
              <div className="font-bold text-sm text-stone-850 truncate leading-tight">
                Zalo HR Admin
              </div>
              <span className="text-[10px] text-stone-400 font-semibold tracking-wider uppercase block">
                Workspace
              </span>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-stone-400 hidden lg:block" />
        </div>

        {/* Menu Nav Links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <span className="px-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-2 hidden lg:block">
            Main Console
          </span>

          <button
            onClick={() => setActiveView("dashboard")}
            className={`w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeView === "dashboard"
                ? "bg-stone-100 text-stone-900 shadow-sm"
                : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
            }`}
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            <span className="hidden lg:block">Dashboard</span>
          </button>

          <button
            onClick={() => setActiveView("chats")}
            className={`w-full flex items-center justify-center lg:justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeView === "chats"
                ? "bg-stone-100 text-stone-900 shadow-sm"
                : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
            }`}
          >
            <div className="flex items-center gap-3 relative">
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              {conversations.filter(c => c.status === "unread").length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-600 rounded-full border-2 border-white lg:hidden" />
              )}
              <span className="hidden lg:block">Inbox / Chats</span>
            </div>
            {conversations.filter(c => c.status === "unread").length > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full hidden lg:block">
                {conversations.filter(c => c.status === "unread").length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveView("candidates")}
            className={`w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeView === "candidates"
                ? "bg-stone-100 text-stone-900 shadow-sm"
                : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
            }`}
          >
            <Users className="w-4 h-4 flex-shrink-0" />
            <span className="hidden lg:block">Candidates</span>
          </button>

          <button
            onClick={() => setActiveView("jobs")}
            className={`w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeView === "jobs"
                ? "bg-stone-100 text-stone-900 shadow-sm"
                : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
            }`}
          >
            <Briefcase className="w-4 h-4 flex-shrink-0" />
            <span className="hidden lg:block">Manage Jobs</span>
          </button>

          <button
            onClick={() => setActiveView("prompts")}
            className={`w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeView === "prompts"
                ? "bg-stone-100 text-stone-900 shadow-sm"
                : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
            }`}
          >
            <FileCode className="w-4 h-4 flex-shrink-0" />
            <span className="hidden lg:block">Agent Prompts</span>
          </button>

          <button
            onClick={() => setActiveView("todo")}
            className={`w-full flex items-center justify-center lg:justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeView === "todo"
                ? "bg-stone-100 text-stone-900 shadow-sm"
                : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
            }`}
          >
            <div className="flex items-center gap-3 relative">
              <CheckSquare className="w-4 h-4 flex-shrink-0" />
              {gaps.filter(g => g.status === "open").length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white lg:hidden" />
              )}
              <span className="hidden lg:block">Gaps Todo</span>
            </div>
            {gaps.filter(g => g.status === "open").length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full hidden lg:block">
                {gaps.filter(g => g.status === "open").length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveView("notifications")}
            className={`w-full flex items-center justify-center lg:justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeView === "notifications"
                ? "bg-stone-100 text-stone-900 shadow-sm"
                : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
            }`}
          >
            <div className="flex items-center gap-3 relative">
              <Bell className="w-4 h-4 flex-shrink-0" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-600 rounded-full border-2 border-white lg:hidden" />
              )}
              <span className="hidden lg:block">Notifications</span>
            </div>
            {notifications.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse hidden lg:block" />
            )}
          </button>
        </div>

        {/* User Account Footer Profile (Shadcn pattern) */}
        <div className="p-4 border-t border-stone-200 flex items-center justify-center lg:justify-between bg-stone-50/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-stone-200 border border-stone-300 flex-shrink-0 flex items-center justify-center font-bold text-stone-700">
              JD
            </div>
            <div className="min-w-0 text-left hidden lg:block">
              <div className="text-xs font-bold text-stone-800 truncate">Jon Doe</div>
              <div className="text-[10px] text-stone-500 truncate">joe@acmecorp.com</div>
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-stone-400 hidden lg:block" />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. Main Content Panels Swap                                    */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-stone-50 overflow-hidden relative">
        {/* Toast Notifier Overlay */}
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {/* 2.1 View: Dashboard (Recruiting Analytics - Mockup replication) */}
        {activeView === "dashboard" && (
          <div className="flex-1 overflow-y-auto p-8 space-y-8 select-text">
            {/* Header Title Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight">
                  Recruiting Analytics
                </h1>
                <p className="text-stone-500 text-sm mt-1">
                  Monitor candidate pipeline metrics, bot performance, and agent workloads.
                </p>
              </div>
              <div className="bg-stone-200/60 p-1.5 rounded-xl flex gap-1.5 text-xs font-bold text-stone-600 self-start">
                <button
                  onClick={() => setAnalyticsRange("week")}
                  className={`px-3.5 py-1.5 rounded-lg transition ${
                    analyticsRange === "week"
                      ? "bg-white text-stone-950 shadow-sm"
                      : "hover:bg-white/45 hover:text-stone-900"
                  }`}
                >
                  This Week
                </button>
                <button
                  onClick={() => setAnalyticsRange("month")}
                  className={`px-3.5 py-1.5 rounded-lg transition ${
                    analyticsRange === "month"
                      ? "bg-white text-stone-950 shadow-sm"
                      : "hover:bg-white/45 hover:text-stone-900"
                  }`}
                >
                  This Month
                </button>
                <button
                  onClick={() => setAnalyticsRange("quarter")}
                  className={`px-3.5 py-1.5 rounded-lg transition ${
                    analyticsRange === "quarter"
                      ? "bg-white text-stone-950 shadow-sm"
                      : "hover:bg-white/45 hover:text-stone-900"
                  }`}
                >
                  This Quarter
                </button>
              </div>
            </div>

            {isAnalyticsLoading ? (
              <>
                {/* Skeletons for Quick Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatsCardSkeleton />
                  <StatsCardSkeleton />
                  <StatsCardSkeleton />
                  <StatsCardSkeleton />
                </div>
                {/* Skeletons for Split rows */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <FunnelSkeleton />
                  <BotPerformanceSkeleton />
                </div>
              </>
            ) : (
              <>
                {/* Quick Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-sm relative flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
                        Total Candidates
                      </span>
                      <div className="text-4xl font-extrabold text-stone-900 mt-2 tracking-tight">
                        {analytics.totalCandidates}
                      </div>
                    </div>
                    <div className="text-xs text-stone-500 mt-4 flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">+{analytics.newCandidatesThisMonth}</span> {analytics.rangeLabel || "this month"}
                    </div>
                    <Users className="w-5 h-5 text-stone-400 absolute right-6 top-6" />
                  </div>

                  <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-sm relative flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
                        Active Chats Today
                      </span>
                      <div className="text-4xl font-extrabold text-stone-900 mt-2 tracking-tight">
                        {analytics.totalConversations}
                      </div>
                    </div>
                    <div className="text-xs text-stone-500 mt-4 flex items-center gap-1.5">
                      <span className="text-amber-600 font-bold">{analytics.openGapsNeedReview}</span> need review
                    </div>
                    <MessageSquare className="w-5 h-5 text-stone-400 absolute right-6 top-6" />
                  </div>

                  <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-sm relative flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
                        Bot Response Rate
                      </span>
                      <div className="text-4xl font-extrabold text-stone-900 mt-2 tracking-tight">
                        {analytics.botResponseRate}%
                      </div>
                    </div>
                    <div className="text-xs text-stone-500 mt-4 flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">+1.3%</span> vs {analytics.prevRangeLabel || "last month"}
                    </div>
                    <Sparkles className="w-5 h-5 text-stone-400 absolute right-6 top-6" />
                  </div>

                  <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-sm relative flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
                        Avg Response Time
                      </span>
                      <div className="text-4xl font-extrabold text-stone-900 mt-2 tracking-tight">
                        {analytics.avgResponseTimeSec}s
                      </div>
                    </div>
                    <div className="text-xs text-stone-500 mt-4 flex items-center gap-1.5">
                      Target &lt; 2s
                    </div>
                    <Clock className="w-5 h-5 text-stone-400 absolute right-6 top-6" />
                  </div>
                </div>

                {/* Split cards row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Hiring Funnel Card */}
                  <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-sm flex flex-col">
                    <h3 className="font-bold text-stone-900 text-lg">Hiring Funnel</h3>
                    <p className="text-stone-500 text-xs mt-1">
                      {analyticsRange === "week" ? "Last 7 days" : analyticsRange === "quarter" ? "Last 90 days" : "Last 30 days"} - {analytics.funnel.applied} total applicants
                    </p>

                    <div className="mt-8 space-y-4 flex-1 flex flex-col justify-center">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-stone-700">
                          <span>Applied</span>
                          <span className="font-bold">{analytics.funnel.applied}</span>
                        </div>
                        <div className="w-full bg-stone-100 h-3 rounded-full overflow-hidden">
                          <div className="bg-stone-900 h-full rounded-full" style={{ width: "100%" }} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-stone-700">
                          <span>Screened</span>
                          <span className="font-bold">{analytics.funnel.screened}</span>
                        </div>
                        <div className="w-full bg-stone-100 h-3 rounded-full overflow-hidden">
                          <div className="bg-stone-650 h-full rounded-full" style={{ width: `${Math.round((analytics.funnel.screened / Math.max(analytics.funnel.applied || 1, 1)) * 100)}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-stone-700">
                          <span>Interviewed</span>
                          <span className="font-bold">{analytics.funnel.interviewed}</span>
                        </div>
                        <div className="w-full bg-stone-100 h-3 rounded-full overflow-hidden">
                          <div className="bg-stone-650 h-full rounded-full" style={{ width: `${Math.round((analytics.funnel.interviewed / Math.max(analytics.funnel.applied || 1, 1)) * 100)}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-stone-700">
                          <span>Offered</span>
                          <span className="font-bold">{analytics.funnel.offered}</span>
                        </div>
                        <div className="w-full bg-stone-100 h-3 rounded-full overflow-hidden">
                          <div className="bg-stone-650 h-full rounded-full" style={{ width: `${Math.round((analytics.funnel.offered / Math.max(analytics.funnel.applied || 1, 1)) * 100)}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-stone-700">
                          <span>Hired</span>
                          <span className="font-bold text-emerald-600">{analytics.funnel.hired}</span>
                        </div>
                        <div className="w-full bg-stone-100 h-3 rounded-full overflow-hidden">
                          <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${Math.round((analytics.funnel.hired / Math.max(analytics.funnel.applied || 1, 1)) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bot Performance Card */}
                  <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-stone-900 text-lg">Bot Performance</h3>
                      <p className="text-stone-500 text-xs mt-1">AI agent quality metrics</p>

                      <div className="mt-6 space-y-4">
                        <div className="flex items-center justify-between text-sm py-1.5 border-b border-stone-100">
                          <span className="font-semibold text-stone-600">CV Parsing Accuracy</span>
                          <span className="font-bold text-stone-900">94%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm py-1.5 border-b border-stone-100">
                          <span className="font-semibold text-stone-600">Job Match Success Rate</span>
                          <span className="font-bold text-stone-900">78%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm py-1.5 border-b border-stone-100">
                          <span className="font-semibold text-stone-600">Candidate Onboarding</span>
                          <span className="font-bold text-stone-900">87%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm py-1.5 border-b border-stone-100">
                          <span className="font-semibold text-stone-600">Bot Satisfaction Score</span>
                          <span className="font-bold text-stone-900">92%</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-stone-100 pt-6 mt-6">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-3">
                        Usage This Month
                      </span>
                      <div className="flex justify-between items-center gap-6">
                        <div>
                          <div className="text-2xl font-black text-stone-900">2,847</div>
                          <span className="text-[10px] font-semibold text-stone-500">Avg tokens/conv</span>
                        </div>
                        <div>
                          <div className="text-2xl font-black text-stone-900">{analytics.totalMessages}</div>
                          <span className="text-[10px] font-semibold text-stone-500">Conversations</span>
                        </div>
                        <div>
                          <div className="text-2xl font-black text-stone-900">${analytics.estimatedCost}</div>
                          <span className="text-[10px] font-semibold text-stone-500">API cost</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 2.2 View: Chats (Zalo Simulator Chat Room) */}
        {activeView === "chats" && (
          <div className="flex-1 flex h-full bg-[#F4F5F7] overflow-hidden">
            {/* Left Sidebar: Conversations */}
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelectId={setSelectedId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onNewChatOpen={() => setIsNewChatOpen(true)}
              isLoading={isConversationsLoading}
            />

            {/* Middle: Chat Feed */}
            <div className="flex-1 flex flex-col h-full min-w-0 bg-stone-100 relative">
              {activeConversation ? (
                <>
                  <div className="p-4 border-b border-stone-200 bg-white flex items-center justify-between gap-4 select-none">
                    <div className="min-w-0">
                      <h3 className="font-bold text-stone-800 text-sm truncate">
                        {activeConversation.contact?.displayName ?? activeConversation.contact?.externalUserId}
                      </h3>
                      <span className="text-[10px] text-stone-500 font-mono truncate block mt-0.5">
                        Zalo Thread: {activeConversation.externalThreadId}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Cpu className="w-3.5 h-3.5 text-stone-400" />
                      <select
                        value={activeConversation.overrideModel ?? "default"}
                        onChange={(e) => handleUpdateModel(e.target.value === "default" ? null : e.target.value)}
                        className="bg-white border border-stone-200 rounded-lg text-[10px] py-1.5 px-2 text-stone-700 focus:outline-none"
                      >
                        <option value="default">Default Model</option>
                        {availableModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => setShowInspector(!showInspector)}
                        className={`p-2 rounded-lg border text-[10px] font-bold uppercase transition flex items-center gap-1.5 ${
                          showInspector
                            ? "bg-indigo-50 border-indigo-200/50 text-indigo-650"
                            : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                        }`}
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Inspector</span>
                      </button>
                    </div>
                  </div>

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
                    isLoading={isMessagesLoading || isAuditsLoading}
                  />

                  <MessageComposer
                    inputText={inputText}
                    setInputText={setInputText}
                    onSubmit={handleSendMessage}
                    isUploadingCv={isUploadingCv}
                    onUploadCv={handleUploadCv}
                  />
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-stone-500 select-none">
                  <MessageSquare className="w-10 h-10 text-stone-450 mb-3" />
                  <h3 className="font-semibold text-stone-700 text-sm">Zalo Sandbox Chatroom</h3>
                  <p className="text-xs text-stone-500 max-w-xs mt-1">
                    Select a conversation thread or mock a new one to trigger tools and test AI rules.
                  </p>
                </div>
              )}
            </div>

            {/* Right: Collapsible Inspector */}
            <InspectorPanel
              showInspector={showInspector}
              onCloseInspector={() => setShowInspector(false)}
              activeTab={activeInspectorTab}
              setActiveTab={setActiveInspectorTab}
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
              isPromptsLoading={isPromptsLoading}
              isAuditsLoading={isAuditsLoading}
            />

            {/* Mobile Inspector Backdrop */}
            {showInspector && (
              <div
                className="fixed inset-0 bg-black/40 z-30 lg:hidden"
                onClick={() => setShowInspector(false)}
              />
            )}
          </div>
        )}

        {/* 2.3 View: Candidates (Durable profiles, job matches, change logs & risk auditing) */}
        {activeView === "candidates" && (
          <div className="flex-1 flex h-full overflow-hidden select-text">
            {/* Candidates List Column */}
            <div className="w-80 border-r border-stone-200 bg-white flex flex-col h-full flex-shrink-0">
              <div className="p-4 border-b border-stone-200 flex items-center gap-2">
                <Search className="w-4 h-4 text-stone-450" />
                <input
                  type="text"
                  placeholder="Search candidates..."
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
                />
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {isCandidatesLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={`cand-skeleton-${i}`}
                      className="p-3.5 rounded-xl border border-transparent flex flex-col gap-2.5 animate-pulse bg-stone-50/70"
                    >
                      <div className="flex justify-between items-center">
                        <div className="h-3.5 bg-stone-200 rounded w-2/3"></div>
                        <div className="h-3 bg-stone-200 rounded w-10"></div>
                      </div>
                      <div className="h-3 bg-stone-200 rounded w-1/2"></div>
                      <div className="flex gap-1 mt-1">
                        <div className="h-4 bg-stone-200 rounded w-12"></div>
                        <div className="h-4 bg-stone-200 rounded w-10"></div>
                        <div className="h-4 bg-stone-200 rounded w-14"></div>
                      </div>
                    </div>
                  ))
                ) : filteredCandidates.length === 0 ? (
                  <div className="p-4 text-center text-xs text-stone-500">No candidates found.</div>
                ) : (
                  filteredCandidates.map((cand) => {
                    const isSelected = selectedCandidate?.id === cand.id;
                    const isHighRisk = cand.risk_score > 50;

                    return (
                      <button
                        key={cand.id}
                        onClick={() => setSelectedCandidate(cand)}
                        className={`w-full text-left p-3.5 rounded-xl border transition flex flex-col gap-1.5 ${
                          isSelected
                            ? "bg-stone-100 border-stone-300 text-stone-900 shadow-xs"
                            : "bg-transparent border-transparent text-stone-600 hover:bg-stone-50"
                        }`}
                      >
                        <div className="flex justify-between items-start w-full">
                          <div className="font-bold text-xs text-stone-850 truncate">
                            {cand.full_name || cand.display_name || "Anonymous Candidate"}
                          </div>
                          {isHighRisk && (
                            <span className="bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-200 uppercase tracking-wider">
                              Risk
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-450 truncate">
                          {cand.email || "No email"} • {cand.phone || cand.contact_phone || "No phone"}
                        </div>
                        {cand.skills?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {cand.skills.slice(0, 3).map((s: string) => (
                              <span
                                key={s}
                                className="text-[9px] bg-stone-100 border border-stone-200/60 text-stone-600 px-1.5 py-0.2 rounded"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Candidate details panel */}
            <div className="flex-1 overflow-y-auto p-6 bg-stone-50">
              {isCandidatesLoading ? (
                <div className="space-y-6 animate-pulse">
                  <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-sm flex justify-between items-start">
                    <div className="space-y-3 flex-1">
                      <div className="h-6 bg-stone-200 rounded w-1/3"></div>
                      <div className="h-3.5 bg-stone-200 rounded w-1/2"></div>
                      <div className="h-3 bg-stone-200 rounded w-1/4"></div>
                    </div>
                    <div className="h-10 bg-stone-200 rounded w-24"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-sm space-y-4">
                      <div className="h-4 bg-stone-200 rounded w-1/4"></div>
                      <div className="space-y-2">
                        <div className="h-3 bg-stone-200 rounded w-full"></div>
                        <div className="h-3 bg-stone-200 rounded w-5/6"></div>
                      </div>
                    </div>
                    <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-sm space-y-4">
                      <div className="h-4 bg-stone-200 rounded w-1/4"></div>
                      <div className="space-y-2">
                        <div className="h-3 bg-stone-200 rounded w-full"></div>
                        <div className="h-3 bg-stone-200 rounded w-5/6"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedCandidate ? (
                <div className="space-y-6">
                  {/* Warning Header if Flagged */}
                  {selectedCandidate.risk_score > 50 && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4 shadow-xs">
                      <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-red-800 text-sm">
                          Warning: High Fraud Risk Score ({selectedCandidate.risk_score})
                        </h4>
                        <p className="text-red-750 text-xs mt-1">
                          This candidate has been automatically flagged due to multiple contact phone links or rapid profile name/email updates. Verify their identity before progressing.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Profile Info block */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center font-bold text-stone-650 text-lg">
                        {selectedCandidate.full_name?.slice(0, 2) || "AC"}
                      </div>
                      <div>
                        <h2 className="font-black text-stone-900 text-lg">
                          {selectedCandidate.full_name || "Anonymous Candidate"}
                        </h2>
                        <span className="text-stone-400 text-xs">
                          Profile ID: {selectedCandidate.id}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 border-t border-stone-100 pt-6 text-xs">
                      <div>
                        <span className="font-semibold text-stone-450 block mb-1">Email</span>
                        <span className="text-stone-800 font-semibold">{selectedCandidate.email || "—"}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-stone-450 block mb-1">Phone</span>
                        <span className="text-stone-800 font-semibold">{selectedCandidate.phone || selectedCandidate.contact_phone || "—"}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-stone-450 block mb-1">Location</span>
                        <span className="text-stone-800 font-semibold">{selectedCandidate.location || "—"}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-stone-450 block mb-1">Experience</span>
                        <span className="text-stone-800 font-semibold">
                          {selectedCandidate.years_of_experience ? `${selectedCandidate.years_of_experience} years` : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-stone-450 block mb-1">Current Title</span>
                        <span className="text-stone-800 font-semibold">{selectedCandidate.current_title || "—"}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-stone-450 block mb-1">Availability</span>
                        <span className="text-stone-800 font-semibold">{selectedCandidate.availability || "—"}</span>
                      </div>
                    </div>

                    {selectedCandidate.skills?.length > 0 && (
                      <div className="mt-6 border-t border-stone-100 pt-6">
                        <span className="font-bold text-stone-450 text-[10px] uppercase tracking-wider block mb-2.5">
                          Extracted Skills
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {selectedCandidate.skills.map((s: string) => (
                            <span
                              key={s}
                              className="text-xs bg-stone-50 border border-stone-200 text-stone-700 px-2.5 py-1 rounded-lg"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Submitted Jobs & Application Progress */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-stone-900 text-base mb-4">
                      Submitted Jobs & Pipeline Progress
                    </h3>

                    {selectedCandidate.applications?.length > 0 ? (
                      <div className="space-y-4">
                        {selectedCandidate.applications.map((app: any) => (
                          <div
                            key={app.id}
                            className="p-4 bg-stone-50 rounded-xl border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                          >
                            <div>
                              <div className="font-bold text-stone-900 text-sm">
                                {app.job_title}
                              </div>
                              <div className="text-stone-500 mt-1">
                                {app.company_name} • Applied via {app.applied_via} on {new Date(app.created_at).toLocaleDateString()}
                              </div>
                              {app.note && (
                                <div className="mt-2 text-stone-600 bg-white border border-stone-200/60 p-2 rounded-lg italic">
                                  "{app.note}"
                                </div>
                              )}
                            </div>

                            {/* Dropdown controls for operator transitions */}
                            <div className="flex items-center gap-3">
                              <div>
                                <span className="text-[10px] font-bold text-stone-400 block mb-1">
                                  Funnel Stage
                                </span>
                                <select
                                  value={app.stage}
                                  onChange={(e) =>
                                    handleTransitionApplication(app.id, e.target.value, app.status, "")
                                  }
                                  className="bg-white border border-stone-200 rounded-lg p-1.5 text-xs text-stone-700"
                                >
                                  <option value="submitted">Submitted</option>
                                  <option value="screening">Screening</option>
                                  <option value="interviewing">Interviewing</option>
                                  <option value="offer">Offer</option>
                                </select>
                              </div>

                              <div>
                                <span className="text-[10px] font-bold text-stone-400 block mb-1">
                                  Status
                                </span>
                                <select
                                  value={app.status}
                                  onChange={(e) =>
                                    handleTransitionApplication(app.id, app.stage, e.target.value, "")
                                  }
                                  className="bg-white border border-stone-200 rounded-lg p-1.5 text-xs text-stone-700"
                                >
                                  <option value="active">Active</option>
                                  <option value="hired">Hired</option>
                                  <option value="rejected">Rejected</option>
                                  <option value="withdrawn">Withdrawn</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-stone-500 text-xs italic">
                        No jobs submitted for this candidate.
                      </p>
                    )}
                  </div>

                  {/* Audit details split grid (change logs & risk signals) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Change logs */}
                    <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-sm">
                      <h3 className="font-bold text-stone-900 text-sm mb-4">Profile Audit Trail</h3>
                      {selectedCandidate.changeLogs?.length > 0 ? (
                        <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
                          {selectedCandidate.changeLogs.map((log: any) => (
                            <div key={log.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200/60 text-xs">
                              <div className="flex justify-between items-center text-stone-450 font-mono text-[10px] mb-2">
                                <span>By: {log.changed_by}</span>
                                <span>{new Date(log.created_at).toLocaleString()}</span>
                              </div>
                              <div className="space-y-1.5">
                                {Object.entries(log.changed_fields).map(([key, val]: any) => (
                                  <div key={key} className="flex justify-between items-start gap-4">
                                    <span className="font-semibold text-stone-600">{key}</span>
                                    <span className="text-stone-500 truncate max-w-[200px]">
                                      {val.old} &rarr; <span className="font-semibold text-stone-850">{val.new}</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-stone-500 text-xs italic">No profile changes logged.</p>
                      )}
                    </div>

                    {/* Risk signals */}
                    <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-sm">
                      <h3 className="font-bold text-stone-900 text-sm mb-4">Fraud Indicators</h3>
                      {selectedCandidate.riskSignals?.length > 0 ? (
                        <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
                          {selectedCandidate.riskSignals.map((sig: any) => (
                            <div
                              key={sig.id}
                              className="p-3 rounded-xl border border-stone-250 flex items-start justify-between gap-3 text-xs"
                            >
                              <div className="space-y-1">
                                <div className="font-bold text-stone-800">{sig.rule_name}</div>
                                {sig.details && (
                                  <code className="block text-[10px] bg-stone-100 p-1.5 rounded font-mono text-stone-600 mt-1">
                                    {JSON.stringify(sig.details)}
                                  </code>
                                )}
                              </div>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                  sig.severity === "high"
                                    ? "bg-red-50 text-red-650"
                                    : sig.severity === "medium"
                                    ? "bg-amber-50 text-amber-600"
                                    : "bg-stone-100 text-stone-600"
                                }`}
                              >
                                {sig.severity}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-emerald-700 text-xs font-semibold flex items-center gap-1.5">
                          ✓ No risk flags logged. Clean profile status.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-12 text-stone-500 h-96">
                  <Users className="w-12 h-12 text-stone-400 mb-3" />
                  <h3 className="font-bold text-stone-700 text-base">Select Candidate</h3>
                  <p className="text-xs text-stone-500 max-w-sm mt-1">
                    Select a candidate from the left panel to inspect their detailed CV fields, applications, progress, and audit logs.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2.4 View: Jobs (List job postings, active vs drafts, upload JD form) */}
        {activeView === "jobs" && (
          <div className="flex-1 flex h-full overflow-hidden select-text">
            {/* Left Jobs List Column */}
            <div className="w-80 border-r border-stone-200 bg-white flex flex-col h-full flex-shrink-0">
              <div className="p-4 border-b border-stone-200">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-2.5">
                  Job Postings
                </span>
                <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-lg">
                  <button className="flex-1 text-center py-1.5 text-xs font-bold rounded-md bg-white border border-stone-200/50 shadow-xs text-stone-850">
                    Active ({activeJobs.length})
                  </button>
                  <button className="flex-1 text-center py-1.5 text-xs font-semibold rounded-md text-stone-500 hover:text-stone-800 transition">
                    Drafts ({draftJobs.length})
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-3">
                {isJobsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={`job-skeleton-${i}`}
                      className="p-3.5 rounded-xl border border-transparent flex flex-col gap-2.5 animate-pulse bg-stone-50/70"
                    >
                      <div className="h-3.5 bg-stone-200 rounded w-2/3"></div>
                      <div className="h-3 bg-stone-200 rounded w-1/3"></div>
                      <div className="h-4 bg-stone-200 rounded w-10"></div>
                    </div>
                  ))
                ) : (
                  <>
                    {/* Active section */}
                    {activeJobs.map((j) => (
                      <button
                        key={j.id}
                        onClick={() => setSelectedJob(j)}
                        className={`w-full text-left p-3.5 rounded-xl border transition flex flex-col gap-1 ${
                          selectedJob?.id === j.id
                            ? "bg-stone-100 border-stone-300 text-stone-900 shadow-xs"
                            : "bg-transparent border-transparent text-stone-600 hover:bg-stone-50"
                        }`}
                      >
                        <div className="font-bold text-xs text-stone-850 truncate">{j.title}</div>
                        <div className="text-[10px] text-stone-450">{j.company}</div>
                        <span className="bg-emerald-50 text-emerald-600 text-[8px] font-bold px-1.5 py-0.5 rounded border border-emerald-150 uppercase tracking-wider block w-fit mt-1">
                          Active
                        </span>
                      </button>
                    ))}

                    {/* Draft section */}
                    {draftJobs.length > 0 && (
                      <div className="pt-2 border-t border-stone-100">
                        <span className="px-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-2">
                          Draft Postings
                        </span>
                        {draftJobs.map((j) => (
                          <button
                            key={j.id}
                            onClick={() => setSelectedJob(j)}
                            className={`w-full text-left p-3.5 rounded-xl border transition flex flex-col gap-1 ${
                              selectedJob?.id === j.id
                                ? "bg-stone-100 border-stone-300 text-stone-900 shadow-xs"
                                : "bg-transparent border-transparent text-stone-600 hover:bg-stone-50"
                            }`}
                          >
                            <div className="font-bold text-xs text-stone-850 truncate">{j.title}</div>
                            <div className="text-[10px] text-stone-450">{j.company}</div>
                            <span className="bg-stone-100 text-stone-500 text-[8px] font-bold px-1.5 py-0.5 rounded border border-stone-200 uppercase tracking-wider block w-fit mt-1">
                              Draft
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Right details / Actions panel */}
            <div className="flex-1 overflow-y-auto p-6 bg-stone-50">
              {/* Upload JD Section */}
              <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-sm mb-6">
                <h3 className="font-bold text-stone-900 text-base mb-2">Import Job Description</h3>
                <p className="text-stone-500 text-xs mb-4">
                  Upload a PDF or Word document JD to automatically parse requirements and create a draft job posting.
                </p>

                <form onSubmit={handleUploadJd} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-450 uppercase mb-1">
                        Optional override Title
                      </label>
                      <input
                        type="text"
                        value={newJobTitle}
                        onChange={(e) => setNewJobTitle(e.target.value)}
                        placeholder="e.g. Senior NodeJS Developer"
                        className="w-full bg-stone-50 border border-stone-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-450 uppercase mb-1">
                        Optional override Company
                      </label>
                      <input
                        type="text"
                        value={newJobCompany}
                        onChange={(e) => setNewJobCompany(e.target.value)}
                        placeholder="e.g. Atlas Studio"
                        className="w-full bg-stone-50 border border-stone-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                      type="file"
                      id="jd-upload-input"
                      onChange={(e) => setJdFile(e.target.files?.[0] || null)}
                      className="hidden"
                      accept=".pdf,.docx,.doc,.txt"
                    />
                    <label
                      htmlFor="jd-upload-input"
                      className="cursor-pointer bg-stone-50 border border-dashed border-stone-300 hover:bg-stone-100 transition rounded-xl p-3 flex items-center justify-center gap-2 text-xs font-semibold text-stone-600 flex-1 min-w-[200px]"
                    >
                      <Upload className="w-4 h-4 text-stone-400" />
                      <span>{jdFile ? jdFile.name : "Select JD document file"}</span>
                    </label>
                    <button
                      type="submit"
                      disabled={!jdFile || isUploadingJd}
                      className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl text-xs transition flex items-center justify-center gap-2"
                    >
                      {isUploadingJd ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>Parse & Upload JD</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Selected Job details block */}
              {isJobsLoading ? (
                <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-sm space-y-4 animate-pulse">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="h-5 bg-stone-200 rounded w-1/3"></div>
                      <div className="h-3.5 bg-stone-200 rounded w-1/4"></div>
                    </div>
                    <div className="h-8 bg-stone-200 rounded w-20"></div>
                  </div>
                  <div className="h-px bg-stone-100 my-4"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-stone-200 rounded w-1/4 mb-2"></div>
                    <div className="h-3 bg-stone-200 rounded w-full"></div>
                    <div className="h-3 bg-stone-200 rounded w-5/6"></div>
                    <div className="h-3 bg-stone-200 rounded w-4/5"></div>
                  </div>
                </div>
              ) : selectedJob ? (
                <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm relative">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h2 className="font-black text-stone-900 text-lg">{selectedJob.title}</h2>
                      <p className="text-stone-450 text-xs mt-1">{selectedJob.company}</p>
                    </div>

                    <button
                      onClick={() => handleToggleJobStatus(selectedJob.id, selectedJob.status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        selectedJob.status === "active"
                          ? "bg-red-50 hover:bg-red-100 text-red-650 border border-red-200"
                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-150"
                      }`}
                    >
                      {selectedJob.status === "active" ? "Deactivate" : "Activate Draft"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 mt-6 border-t border-stone-100 pt-6 text-xs">
                    <div>
                      <span className="font-semibold text-stone-450 block mb-1">Work Mode</span>
                      <span className="font-bold text-stone-800 capitalize">{selectedJob.work_mode || "—"}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-stone-450 block mb-1">Seniority</span>
                      <span className="font-bold text-stone-800 capitalize">{selectedJob.seniority || "—"}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-stone-450 block mb-1">Salary Range</span>
                      <span className="font-bold text-stone-850">
                        {selectedJob.salary_min_vnd
                          ? `${(selectedJob.salary_min_vnd / 1000000).toFixed(0)}m - ${(selectedJob.salary_max_vnd / 1000000).toFixed(0)}m VND`
                          : "Competitive"}
                      </span>
                    </div>
                  </div>

                  {selectedJob.required_skills?.length > 0 && (
                    <div className="mt-6 border-t border-stone-100 pt-6">
                      <span className="font-bold text-stone-450 text-[10px] uppercase tracking-wider block mb-2.5">
                        Required Skills
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {selectedJob.required_skills.map((s: string) => (
                          <span
                            key={s}
                            className="text-xs bg-stone-50 border border-stone-200 text-stone-700 px-2.5 py-1 rounded-lg"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 border-t border-stone-100 pt-6">
                    <span className="font-bold text-stone-450 text-[10px] uppercase tracking-wider block mb-2.5">
                      Job Description
                    </span>
                    <div className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap">
                      {selectedJob.description}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-12 text-stone-500 h-64 bg-white border border-stone-200 rounded-2xl">
                  <Briefcase className="w-10 h-10 text-stone-400 mb-3" />
                  <h3 className="font-bold text-stone-700 text-sm">Select Job Posting</h3>
                  <p className="text-xs text-stone-500 max-w-sm mt-1">
                    Select a job posting from the left panel to inspect its fields, status, description, or activate draft jobs.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2.5 View: Prompts Manager */}
        {activeView === "prompts" && (
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto space-y-8 select-text w-full">
            <div>
              <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight">
                AI Agent Prompt Templates
              </h1>
              <p className="text-stone-500 text-sm mt-1">
                Customize the system prompt instructions used by the recruitment chatbot to respond to candidates.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Template Editor */}
              <div className="lg:col-span-2 bg-white border border-stone-200 rounded-2xl p-6 shadow-sm flex flex-col h-[600px]">
                <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-4 select-none">
                  <span className="font-bold text-stone-800 text-sm flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-stone-500" />
                    <span>Active System Prompt Editor</span>
                  </span>
                  <button
                    onClick={handleSavePrompt}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-1.5 px-4 rounded-lg text-xs transition"
                  >
                    Save & Deploy Version
                  </button>
                </div>
                <textarea
                  value={promptContent}
                  onChange={(e) => setPromptContent(e.target.value)}
                  className="flex-1 w-full p-4 rounded-xl border border-stone-200 font-mono text-xs text-stone-700 bg-stone-50 focus:outline-none focus:bg-white resize-none"
                  placeholder="Paste system instructions here..."
                />
              </div>

              {/* Version History */}
              <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm flex flex-col h-[600px]">
                <span className="font-bold text-stone-850 text-sm block mb-4 select-none">
                  Version History Log
                </span>

                <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                  {promptVersions.map((v) => (
                    <div
                      key={v.id}
                      className={`p-3.5 rounded-xl border text-xs transition flex flex-col gap-2 ${
                        v.is_active
                          ? "bg-indigo-50/50 border-indigo-250 text-indigo-950 font-semibold"
                          : "bg-transparent border-stone-200 text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-bold">v{v.version}</span>
                        {v.is_active ? (
                          <span className="bg-indigo-100 text-indigo-700 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Active
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSelectPromptVersion(v)}
                            className="text-[10px] text-indigo-600 hover:text-indigo-500 font-bold uppercase"
                          >
                            Rollback
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-stone-450 line-clamp-3 font-mono">
                        {v.content}
                      </p>
                      <div className="text-[9px] text-stone-400 text-right mt-1">
                        {new Date(v.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2.6 View: Gaps Todo (Candidate unanswered questions resolution interface) */}
        {activeView === "todo" && (
          <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto space-y-8 select-text w-full">
            <div>
              <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight">
                Knowledge Gaps Todo List
              </h1>
              <p className="text-stone-500 text-sm mt-1">
                Factual questions candidates asked that the AI agent could not answer. Type answers here to update knowledge logs.
              </p>
            </div>

            {gaps.length > 0 ? (
              <div className="space-y-6">
                {gaps.map((gap) => {
                  const isOpen = gap.status === "open";
                  return (
                    <div
                      key={gap.id}
                      className={`p-6 bg-white rounded-2xl border shadow-sm flex flex-col gap-4 ${
                        isOpen ? "border-stone-200" : "border-emerald-100 bg-emerald-50/50"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="bg-stone-100 border border-stone-200 text-stone-600 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                              {gap.topic || "general"}
                            </span>
                            {gap.company_name && (
                              <span className="text-stone-450 text-xs font-semibold">
                                Company: {gap.company_name}
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-stone-900 text-sm mt-2">
                            "{gap.question}"
                          </h4>
                          <span className="text-[10px] text-stone-400 block mt-1">
                            Asked {gap.ask_count} times • Created {new Date(gap.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <span
                          className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                            isOpen
                              ? "bg-amber-100 text-amber-700 border border-amber-200"
                              : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {gap.status}
                        </span>
                      </div>

                      {isOpen ? (
                        <div className="flex items-center gap-3 pt-2">
                          <input
                            type="text"
                            value={gapAnswers[gap.id] || ""}
                            onChange={(e) =>
                              setGapAnswers((prev) => ({ ...prev, [gap.id]: e.target.value }))
                            }
                            placeholder="Type verified answer here..."
                            className="flex-1 bg-stone-50 border border-stone-200 rounded-lg py-2 px-3 text-xs focus:outline-none"
                          />
                          <button
                            onClick={() => handleSubmitAnswer(gap.id)}
                            disabled={!gapAnswers[gap.id]?.trim()}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-xs transition whitespace-nowrap"
                          >
                            Submit Answer
                          </button>
                        </div>
                      ) : (
                        <div className="bg-white border border-emerald-200 p-3.5 rounded-xl text-xs text-stone-700 italic">
                          <strong>Answer:</strong> "{gap.answer}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-12 text-stone-500 bg-white border border-stone-200 rounded-2xl h-80">
                <CheckSquare className="w-12 h-12 text-stone-400 mb-3" />
                <h3 className="font-bold text-stone-700 text-base">All Clear!</h3>
                <p className="text-xs text-stone-500 max-w-sm mt-1">
                  There are no open knowledge gaps. The recruitment bot has successfully answered all candidate queries!
                </p>
              </div>
            )}
          </div>
        )}

        {/* 2.7 View: Notifications Center */}
        {activeView === "notifications" && (
          <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto space-y-8 select-text w-full">
            <div>
              <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight">
                System Event Notifications
              </h1>
              <p className="text-stone-500 text-sm mt-1">
                Real-time security logs, CV processing statuses, and candidate fraud assessment flags.
              </p>
            </div>

            {notifications.length > 0 ? (
              <div className="space-y-4">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 rounded-xl border flex items-start gap-3.5 text-xs bg-white ${
                      n.type === "warning" ? "border-red-150 shadow-xs bg-red-50/20" : "border-stone-200 shadow-xs"
                    }`}
                  >
                    {n.type === "warning" ? (
                      <AlertTriangle className="w-5 h-5 text-red-650 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Sparkles className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-stone-900">{n.title}</div>
                      <p className="text-stone-500 mt-1">{n.desc}</p>
                      <span className="text-[10px] text-stone-400 block mt-2">
                        {new Date(n.time).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-12 text-stone-500 bg-white border border-stone-200 rounded-2xl h-80">
                <Bell className="w-12 h-12 text-stone-400 mb-3" />
                <h3 className="font-bold text-stone-700 text-base">No notifications</h3>
                <p className="text-xs text-stone-500 max-w-sm mt-1">
                  There are no recent security logs or CV upload alerts.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Workspace new simulated chat modal */}
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

      {/* Collapsible Inspector Modal for Full payload inspection */}
      <AuditDetailModal
        audit={selectedAuditForModal}
        onClose={() => setSelectedAuditForModal(null)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-stone-500 bg-[#F0F2F5] h-screen flex items-center justify-center font-semibold">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          <span>Loading Recruiting Admin Workspace...</span>
        </div>
      }
    >
      <DashboardMain />
    </Suspense>
  );
}
