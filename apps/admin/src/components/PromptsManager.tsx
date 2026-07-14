import React from "react";
import { PromptVersion } from "@/lib/types";
import { FileText } from "lucide-react";

interface PromptsManagerProps {
  promptContent: string;
  setPromptContent: (content: string) => void;
  promptVersions: PromptVersion[];
  onSavePrompt: () => void;
  onSelectPromptVersion: (version: PromptVersion) => void;
}

export function PromptsManager({
  promptContent,
  setPromptContent,
  promptVersions,
  onSavePrompt,
  onSelectPromptVersion,
}: PromptsManagerProps) {
  return (
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
          onClick={onSavePrompt}
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
              onClick={() => onSelectPromptVersion(v)}
              className={`w-full text-left p-3 rounded-xl border text-xs flex items-center justify-between gap-3 transition ${
                v.is_active
                  ? "bg-blue-50 border-blue-200/50 text-blue-700 font-semibold"
                  : "bg-gray-50 border border-gray-150 text-slate-500 hover:bg-gray-100 hover:text-slate-700"
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
  );
}
