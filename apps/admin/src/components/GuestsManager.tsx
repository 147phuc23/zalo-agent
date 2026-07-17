import React, { useState } from "react";
import { useGuests, GuestAccess } from "@/hooks/useGuests";
import { Link, Copy, Check, Trash2, Plus, Clock, AlertCircle } from "lucide-react";

interface GuestsManagerProps {
  showToast?: (msg: string, type: "success" | "error") => void;
}

export function GuestsManager({ showToast }: GuestsManagerProps) {
  const { guests, isLoading, error, mutate } = useGuests();
  const [isGenerating, setIsGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/admin/guests", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        mutate();
        if (showToast) showToast("Đã tạo liên kết mời thành công!", "success");
      } else {
        if (showToast) showToast(data.error || "Không thể tạo liên kết mời", "error");
      }
    } catch (err) {
      if (showToast) showToast("Lỗi mạng khi tạo liên kết", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      const res = await fetch(`/api/admin/guests/${id}/revoke`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        mutate();
        if (showToast) showToast("Đã thu hồi liên kết mời thành công!", "success");
      } else {
        if (showToast) showToast(data.error || "Không thể thu hồi liên kết", "error");
      }
    } catch (err) {
      if (showToast) showToast("Lỗi mạng khi thu hồi liên kết", "error");
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopy = (code: string) => {
    const url = `${window.location.origin}/guest/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-xs tracking-wider uppercase text-slate-500">
          Danh sách liên kết mời
        </h4>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-1.5 px-3 rounded-lg flex items-center gap-1 font-semibold transition"
        >
          <Plus className="w-3.5 h-3.5" />
          {isGenerating ? "Đang tạo..." : "Tạo liên kết"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>Lỗi tải danh sách liên kết mời.</span>
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div
              key={`skeleton-guest-${i}`}
              className="rounded-xl border border-gray-205 p-3.5 bg-gray-50 animate-pulse flex flex-col space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="h-8 bg-gray-200 rounded w-full"></div>
              <div className="space-y-1.5 py-1">
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200/50">
                <div className="h-6 bg-gray-200 rounded w-28"></div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
              </div>
            </div>
          ))
        ) : (
          <>
            {guests.map((g) => {
              const isPending = g.status === "pending";
              const isClaimed = g.status === "claimed";
              const isRevoked = g.status === "revoked";

              return (
                <div
                  key={g.id}
                  className={`rounded-xl border p-3.5 bg-gray-50 flex flex-col space-y-2.5 transition ${
                    isRevoked ? "opacity-60 border-gray-200" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Link className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="font-mono text-xs font-bold text-slate-800 truncate">
                        {g.invite_code}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                        isPending
                          ? "bg-amber-50 text-amber-700 border border-amber-200/50"
                          : isClaimed
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-250/50"
                          : "bg-gray-150 text-gray-500 border border-gray-300"
                      }`}
                    >
                      {g.status}
                    </span>
                  </div>

                  {isClaimed && g.display_name && (
                    <div className="text-xs text-slate-700 font-semibold bg-white border border-gray-200/60 rounded-lg p-2 flex items-center justify-between">
                       <span className="truncate">Ứng viên: {g.display_name}</span>
                       {!!g.profile?.desiredRole && (
                         <span className="text-[10px] text-slate-400 font-medium shrink-0">
                           {g.profile.desiredRole as string}
                         </span>
                       )}
                    </div>
                  )}

                  <div className="text-[10px] text-slate-450 space-y-1 bg-white/40 p-2 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Tạo: {new Date(g.created_at).toLocaleDateString()} {new Date(g.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    {g.claimed_at && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Kích hoạt: {new Date(g.claimed_at).toLocaleDateString()} {new Date(g.claimed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    )}
                    {g.last_seen_at && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Hoạt động cuối: {new Date(g.last_seen_at).toLocaleDateString()} {new Date(g.last_seen_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-200/50">
                    <button
                      onClick={() => handleCopy(g.invite_code)}
                      className="text-[11px] text-slate-650 hover:text-slate-900 border border-gray-200 bg-white py-1 px-2.5 rounded-lg flex items-center gap-1 font-semibold transition"
                    >
                      {copiedCode === g.invite_code ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          Đã sao chép
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Sao chép liên kết
                        </>
                      )}
                    </button>

                    {!isRevoked && (
                      <button
                        onClick={() => handleRevoke(g.id)}
                        disabled={revokingId === g.id}
                        className="text-[11px] text-red-650 hover:text-red-700 border border-red-100 hover:border-red-200 bg-red-50/30 hover:bg-red-50 py-1 px-2.5 rounded-lg flex items-center gap-1 font-semibold transition"
                      >
                        <Trash2 className="w-3 h-3" />
                        {revokingId === g.id ? "Đang hủy..." : "Thu hồi"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {guests.length === 0 && (
              <div className="text-center p-8 text-xs text-slate-400 bg-gray-50 border border-gray-200 rounded-xl">
                Chưa có liên kết mời nào được tạo.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
