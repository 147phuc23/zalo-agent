import React from "react";
import { Audit } from "@/lib/types";
import { Terminal } from "lucide-react";

interface AuditDetailModalProps {
  audit: Audit | null;
  onClose: () => void;
}

export function AuditDetailModal({ audit, onClose }: AuditDetailModalProps) {
  if (!audit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-800">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-855 font-mono text-sm">
              {audit.tool_name}
            </h3>
          </div>
          <button
            onClick={onClose}
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
              {JSON.stringify(audit.input, null, 2)}
            </code>
          </div>
          {audit.output && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Output Payload
              </div>
              <code className="block p-3 rounded-xl bg-gray-50 text-slate-700 text-xs font-mono overflow-x-auto border border-gray-150 select-text">
                {JSON.stringify(audit.output, null, 2)}
              </code>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold transition"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
