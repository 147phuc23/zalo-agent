import React from "react";
import { Sparkles } from "lucide-react";

export const PRESET_CONTEXTS = [
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

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  newThreadId: string;
  setNewThreadId: (val: string) => void;
  newUserId: string;
  setNewUserId: (val: string) => void;
  newDisplayName: string;
  setNewDisplayName: (val: string) => void;
  selectedPresetIndex: number;
  onSelectPreset: (index: number) => void;
  isSubmitting: boolean;
}

export function NewChatModal({
  isOpen,
  onClose,
  onSubmit,
  newThreadId,
  setNewThreadId,
  newUserId,
  setNewUserId,
  newDisplayName,
  setNewDisplayName,
  selectedPresetIndex,
  onSelectPreset,
  isSubmitting,
}: NewChatModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 text-slate-800">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <h3 className="font-bold text-lg text-slate-800">Create New Simulator Chat</h3>
          <button
            onClick={onClose}
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
                onClick={() => onSelectPreset(idx)}
                className={`w-full text-left p-3 rounded-2xl border text-xs flex items-center justify-between transition ${
                  selectedPresetIndex === idx
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

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              onClick={onClose}
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
  );
}
