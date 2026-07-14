import React, { useState, useMemo } from "react";
import { Audit } from "@/lib/types";
import { Terminal, ChevronUp, ChevronDown, Sliders } from "lucide-react";

interface AuditCardProps {
  audit: Audit;
  onInspect: (audit: Audit) => void;
}

export const AuditCard = React.memo(function AuditCard({ audit, onInspect }: AuditCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const inputStr = useMemo(() => {
    return audit.input ? JSON.stringify(audit.input, null, 2) : "{}";
  }, [audit.input]);

  const outputStr = useMemo(() => {
    return audit.output ? JSON.stringify(audit.output, null, 2) : "";
  }, [audit.output]);

  const isLong = useMemo(() => {
    return inputStr.length > 150 || outputStr.length > 150;
  }, [inputStr, outputStr]);

  const handleToggleExpand = (e: React.MouseEvent) => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="flex justify-center my-2">
      <div
        onClick={handleToggleExpand}
        className="max-w-[70%] w-full bg-white border border-dashed border-gray-200 rounded-xl p-3 cursor-pointer hover:bg-gray-50 transition group"
      >
        <div className="flex items-center justify-between gap-2 select-none">
          <div className="flex items-center gap-1.5 min-w-0">
            <Terminal className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <span className="font-mono text-xs font-semibold text-slate-700 truncate">
              {audit.tool_name}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase border ${
                audit.status === "ok"
                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                  : "bg-red-50 text-red-650 border-red-100"
              }`}
            >
              {audit.status}
            </span>
            <button
              onClick={() => onInspect(audit)}
              className="text-[10px] text-blue-600 hover:text-blue-500 hover:underline font-semibold"
            >
              Inspect
            </button>
          </div>
        </div>

        {!isExpanded && audit.input && Object.keys(audit.input).length > 0 && (
          <div className="mt-1.5 text-[11px] text-slate-450 font-mono truncate max-w-full">
            args: {JSON.stringify(audit.input)}
          </div>
        )}

        {isExpanded && (
          <div className="mt-2.5 space-y-2 text-left" onClick={(e) => e.stopPropagation()}>
            {audit.input && Object.keys(audit.input).length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Arguments
                </div>
                <code className="block p-2.5 rounded-lg bg-gray-50 text-slate-700 text-[11px] font-mono overflow-x-auto border border-gray-200 max-h-48 select-text">
                  {inputStr}
                </code>
              </div>
            )}
            {audit.output && (
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
                  onClick={() => onInspect(audit)}
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
});
