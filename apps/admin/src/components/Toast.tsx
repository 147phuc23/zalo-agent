import React, { useEffect } from "react";
import { X, CheckCircle, AlertCircle } from "lucide-react";

interface ToastProps {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
}

export function Toast({ message, type = "success", onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border border-gray-150 bg-white animate-in fade-in slide-in-from-bottom-4 duration-300">
      {type === "success" ? (
        <CheckCircle className="w-5 h-5 text-emerald-500" />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-500" />
      )}
      <span className="text-sm text-slate-800 font-medium">{message}</span>
      <button 
        onClick={onClose} 
        className="p-0.5 rounded hover:bg-slate-100 transition ml-2 text-slate-400 hover:text-slate-600"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
