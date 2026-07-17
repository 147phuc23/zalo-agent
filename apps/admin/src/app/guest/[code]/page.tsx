"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Send,
  Loader2,
  Lock,
  User,
  Sliders,
  DollarSign,
  AlertCircle,
  LogOut,
  Sparkles,
  Clock,
} from "lucide-react";

interface GuestInfo {
  id: string;
  display_name: string | null;
  profile: {
    desiredRole?: string;
    experienceYears?: string | number;
    expectedSalary?: string;
  };
  status: string;
}

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  text: string | null;
  createdAt: string;
}

export default function GuestChatPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [stateStatus, setStateStatus] = useState<"loading" | "pending" | "claimed" | "revoked" | "error">("loading");
  const [sessionSecret, setSessionSecret] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(false);

  // Forms
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [desiredRole, setDesiredRole] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Chat
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const verifySession = async (secret: string) => {
    setIsVerifyingSession(true);
    try {
      const res = await fetch(`/api/guest/${code}/me`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await res.json();
      if (data.ok) {
        setSessionSecret(secret);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem(`guest:${code}`);
      }
    } catch (err) {
      console.error("Session verification failed:", err);
    } finally {
      setIsVerifyingSession(false);
    }
  };

  // Check state & localStorage session on mount
  useEffect(() => {
    async function checkState() {
      try {
        const res = await fetch(`/api/guest/${code}/state`);
        const data = await res.json();
        if (!data.ok) {
          setStateStatus("error");
          return;
        }
        setStateStatus(data.status);

        if (data.status === "revoked") {
          return;
        }

        // Check localStorage
        const stored = localStorage.getItem(`guest:${code}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.v === 1 && parsed.secret) {
              await verifySession(parsed.secret);
            }
          } catch (e) {
            localStorage.removeItem(`guest:${code}`);
          }
        }
      } catch (err) {
        setStateStatus("error");
      }
    }
    if (code) {
      checkState();
    }
  }, [code]);

  // React Query Message Polling
  const queryClient = useQueryClient();
  const queryKey = ["guestMessages", code, sessionSecret];
  const { data: messageData } = useQuery<{ ok: boolean; messages: Message[] }>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/guest/${code}/messages`, {
        headers: { Authorization: `Bearer ${sessionSecret}` },
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to fetch messages");
      return data;
    },
    enabled: !!(isAuthenticated && sessionSecret),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const mutateMessages = (
    updater?: { ok: boolean; messages: Message[] } | ((prev: { ok: boolean; messages: Message[] } | undefined) => { ok: boolean; messages: Message[] }),
    options?: any
  ) => {
    if (typeof updater === "function") {
      const current = queryClient.getQueryData<{ ok: boolean; messages: Message[] }>(queryKey);
      queryClient.setQueryData(queryKey, updater(current));
    } else if (updater !== undefined) {
      queryClient.setQueryData(queryKey, updater);
    } else {
      queryClient.invalidateQueries({ queryKey });
    }
  };

  const messages = messageData?.messages || [];

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!displayName || !password || !confirmPassword) {
      setFormError("Vui lòng điền đầy đủ các thông tin bắt buộc.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Mật khẩu xác nhận không khớp.");
      return;
    }

    if (password.length < 6) {
      setFormError("Mật khẩu phải dài ít nhất 6 ký tự.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/guest/${code}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          password,
          profile: {
            desiredRole: desiredRole || undefined,
            experienceYears: experienceYears ? parseInt(experienceYears, 10) : undefined,
            expectedSalary: expectedSalary || undefined,
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem(`guest:${code}`, JSON.stringify({ v: 1, secret: data.secret }));
        setSessionSecret(data.secret);
        setIsAuthenticated(true);
        setStateStatus("claimed");
      } else {
        setFormError(data.error || "Có lỗi xảy ra khi kích hoạt tài khoản.");
      }
    } catch (err) {
      setFormError("Lỗi kết nối mạng, vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!password) {
      setFormError("Vui lòng nhập mật khẩu.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/guest/${code}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem(`guest:${code}`, JSON.stringify({ v: 1, secret: data.secret }));
        setSessionSecret(data.secret);
        setIsAuthenticated(true);
      } else {
        setFormError(data.error || "Mật khẩu không chính xác.");
      }
    } catch (err) {
      setFormError("Lỗi kết nối mạng, vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending || !sessionSecret) return;

    const textToSend = inputText;
    setInputText("");
    setIsSending(true);

    // Optimistic Update
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      direction: "inbound",
      text: textToSend,
      createdAt: new Date().toISOString(),
    };
    mutateMessages(
      (prev) => ({
        ok: true,
        messages: [...(prev?.messages || []), optimisticMessage],
      }),
      false
    );

    try {
      const res = await fetch(`/api/guest/${code}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionSecret}`,
        },
        body: JSON.stringify({ text: textToSend }),
      });
      const data = await res.json();
      if (!data.ok) {
        console.error("Failed to send message:", data.error);
      }
      mutateMessages();
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(`guest:${code}`);
    setSessionSecret(null);
    setIsAuthenticated(false);
    setPassword("");
  };

  // Rendering States
  if (stateStatus === "loading" || isVerifyingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-slate-400 font-medium">Đang tải thông tin phiên chat...</p>
      </div>
    );
  }

  if (stateStatus === "revoked") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
          <AlertCircle className="h-16 w-16 text-rose-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Liên kết đã hết hạn</h1>
          <p className="text-slate-400 mb-6">Liên kết mời tham gia phỏng vấn này đã bị thu hồi hoặc đã hết hiệu lực.</p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition font-medium"
          >
            Quay lại trang chủ
          </button>
        </div>
      </div>
    );
  }

  if (stateStatus === "error") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
          <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Không tìm thấy phòng chat</h1>
          <p className="text-slate-400 mb-6">Đường dẫn không hợp lệ hoặc đã có lỗi xảy ra trong quá trình kết nối.</p>
        </div>
      </div>
    );
  }

  // Pending State (Registration Form)
  if (stateStatus === "pending") {
    return (
      <div className="min-h-screen bg-slate-950 py-12 px-4 flex items-center justify-center font-sans">
        <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight flex items-center justify-center gap-2">
              <Sparkles className="h-6 w-6 text-indigo-400" />
              Chào mừng ứng viên
            </h1>
            <p className="text-slate-400 mt-2 text-sm">Vui lòng thiết lập hồ sơ và mật khẩu để bắt đầu trò chuyện với trợ lý.</p>
          </div>

          <form onSubmit={handleClaim} className="space-y-5">
            <div>
              <label className="block text-slate-300 font-medium text-sm mb-1.5 flex items-center gap-1.5">
                <User className="h-4 w-4 text-indigo-400" />
                Họ và tên *
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="VD: Nguyễn Văn A"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium text-sm mb-1.5 flex items-center gap-1.5">
                  <Sliders className="h-4 w-4 text-indigo-400" />
                  Vị trí ứng tuyển
                </label>
                <input
                  type="text"
                  value={desiredRole}
                  onChange={(e) => setDesiredRole(e.target.value)}
                  placeholder="VD: Frontend Dev"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium text-sm mb-1.5 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-indigo-400" />
                  Số năm kinh nghiệm
                </label>
                <input
                  type="number"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  placeholder="VD: 3"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium text-sm mb-1.5 flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-indigo-400" />
                Mức lương mong muốn (VND)
              </label>
              <input
                type="text"
                value={expectedSalary}
                onChange={(e) => setExpectedSalary(e.target.value)}
                placeholder="VD: 25,000,000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <hr className="border-slate-800 my-6" />

            <div>
              <label className="block text-slate-300 font-medium text-sm mb-1.5 flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-indigo-400" />
                Mật khẩu đăng nhập *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu của bạn (ít nhất 6 ký tự)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium text-sm mb-1.5 flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-indigo-400" />
                Xác nhận mật khẩu *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                required
              />
            </div>

            {formError && (
              <div className="bg-rose-950/50 border border-rose-800 text-rose-300 p-4 rounded-xl text-sm flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/35"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Đang khởi tạo tài khoản...
                </>
              ) : (
                "Bắt đầu phỏng vấn & Trò chuyện"
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Password Prompt (Claimed but unauthorized)
  if (stateStatus === "claimed" && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 py-12 px-4 flex items-center justify-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-100 flex items-center justify-center gap-2">
              <Lock className="h-6 w-6 text-indigo-400" />
              Yêu cầu mật khẩu
            </h1>
            <p className="text-slate-400 mt-2 text-sm">Hồ sơ đã được kích hoạt. Nhập mật khẩu của bạn để tiếp tục trò chuyện.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-slate-300 font-medium text-sm mb-1.5">Mật khẩu truy cập</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu đã đăng ký"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                required
              />
            </div>

            {formError && (
              <div className="bg-rose-950/50 border border-rose-800 text-rose-300 p-4 rounded-xl text-sm flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Đang kiểm tra...
                </>
              ) : (
                "Đăng nhập & Tiếp tục"
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Active Chat Screen
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-100">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800/60 sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 flex items-center gap-1.5">
              Phỏng vấn ứng viên
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </h1>
            <p className="text-slate-400 text-xs font-medium">Trò chuyện trực tiếp với Trợ lý AI</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 py-2 px-3 text-slate-400 hover:text-slate-200 border border-slate-800 bg-slate-950/40 hover:bg-slate-800 rounded-lg text-sm transition"
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </button>
      </header>

      {/* Messages Main Window */}
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-4 max-w-4xl w-full mx-auto flex flex-col">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
            <p className="text-slate-400 font-medium">Đang tải lịch sử hội thoại...</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.direction === "inbound";
            return (
              <div
                key={msg.id}
                className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4.5 py-3 shadow-md ${
                    isUser
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-slate-900 border border-slate-800/80 text-slate-100 rounded-bl-none"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  <span
                    className={`block text-[10px] mt-1.5 text-right ${
                      isUser ? "text-indigo-200/80" : "text-slate-500"
                    }`}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Footer Message Input */}
      <footer className="bg-slate-900/60 border-t border-slate-800/50 p-4 sticky bottom-0 z-30">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Nhập nội dung tin nhắn của bạn..."
            className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm transition"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="bg-indigo-600 hover:bg-indigo-500 text-white p-3.5 rounded-xl transition flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </form>
      </footer>
    </div>
  );
}
