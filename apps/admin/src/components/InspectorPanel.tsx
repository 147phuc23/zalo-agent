import React from "react";
import { Audit, PromptVersion } from "@/lib/types";
import { Terminal, Settings, Download, X, Clock, Sliders, Users } from "lucide-react";
import { PromptsManager } from "./PromptsManager";
import { GuestsManager } from "./GuestsManager";

interface InspectorPanelProps {
  showInspector: boolean;
  onCloseInspector: () => void;
  activeTab: "debugger" | "prompt" | "guests";
  setActiveTab: (tab: "debugger" | "prompt" | "guests") => void;
  selectedId: string | null;
  audits: Audit[];
  onExportSession: () => void;
  onInspectAudit: (audit: Audit) => void;
  // Prompts Manager props
  promptContent: string;
  setPromptContent: (content: string) => void;
  promptVersions: PromptVersion[];
  onSavePrompt: () => void;
  onSelectPromptVersion: (version: PromptVersion) => void;
  showToast?: (msg: string, type: "success" | "error") => void;
  isPromptsLoading?: boolean;
  isAuditsLoading?: boolean;
}

export function InspectorPanel({
  showInspector,
  onCloseInspector,
  activeTab,
  setActiveTab,
  selectedId,
  audits,
  onExportSession,
  onInspectAudit,
  promptContent,
  setPromptContent,
  promptVersions,
  onSavePrompt,
  onSelectPromptVersion,
  showToast,
  isPromptsLoading,
  isAuditsLoading,
}: InspectorPanelProps) {
  if (!showInspector) return null;

  return (
    <div
      className="border-l border-gray-200 bg-white flex flex-col h-full fixed inset-y-0 right-0 z-40 w-full sm:w-96 shadow-2xl lg:shadow-none lg:static lg:w-96 lg:flex"
    >
      {/* Tab Header */}
      <div className="flex items-center border-b border-gray-200 text-sm">
        <div className="flex flex-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("debugger")}
            className={`flex-1 py-3 px-2 text-center font-medium border-b-2 transition flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === "debugger"
                ? "border-blue-600 text-blue-600 bg-blue-50/20"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Terminal className="w-4 h-4" />
            Inspector
          </button>
          <button
            onClick={() => setActiveTab("prompt")}
            className={`flex-1 py-3 px-2 text-center font-medium border-b-2 transition flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === "prompt"
                ? "border-blue-600 text-blue-600 bg-blue-50/20"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Settings className="w-4 h-4" />
            Prompts
          </button>
          <button
            onClick={() => setActiveTab("guests")}
            className={`flex-1 py-3 px-2 text-center font-medium border-b-2 transition flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === "guests"
                ? "border-blue-600 text-blue-600 bg-blue-50/20"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            Guests
          </button>
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={onCloseInspector}
          className="lg:hidden p-3 border-l border-gray-200 text-slate-400 hover:text-slate-650 transition shrink-0"
          title="Close Inspector"
        >
          <X className="w-5 h-5" />
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
              {selectedId && !isAuditsLoading && audits.length > 0 && (
                <button
                  onClick={onExportSession}
                  className="text-xs text-blue-600 hover:text-blue-500 flex items-center gap-1 font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Trace
                </button>
              )}
            </div>

            {/* Collapsible Tool Audit list */}
            <div className="space-y-2.5">
              {isAuditsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={`skeleton-audit-${i}`}
                    className="rounded-xl border border-gray-200 p-3 bg-gray-50/70 animate-pulse space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-3.5 bg-gray-200 rounded w-1/3"></div>
                      <div className="h-3.5 bg-gray-200 rounded w-12"></div>
                    </div>
                    <div className="h-2.5 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                  </div>
                ))
              ) : (
                <>
                  {audits.map((a) => (
                    <div
                      key={a.id}
                      className={`rounded-xl border p-3 bg-gray-50 ${
                        a.status === "ok" ? "border-gray-200" : "border-red-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-blue-600" />
                          <span className="font-mono text-xs font-bold text-slate-800 font-semibold truncate block max-w-[200px]">
                            {a.tool_name}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            a.status === "ok" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-650"
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
                </>
              )}
            </div>
          </div>
        ) : activeTab === "prompt" ? (
          <PromptsManager
            promptContent={promptContent}
            setPromptContent={setPromptContent}
            promptVersions={promptVersions}
            onSavePrompt={onSavePrompt}
            onSelectPromptVersion={onSelectPromptVersion}
            isLoading={isPromptsLoading}
          />
        ) : (
          <GuestsManager showToast={showToast} />
        )}
      </div>
    </div>
  );
}
