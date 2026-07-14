import React, { useRef } from "react";
import { Paperclip, Send } from "lucide-react";

interface MessageComposerProps {
  inputText: string;
  setInputText: (text: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isUploadingCv: boolean;
  onUploadCv: (file: File) => void;
}

export function MessageComposer({
  inputText,
  setInputText,
  onSubmit,
  isUploadingCv,
  onUploadCv,
}: MessageComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadCvClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadCv(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <form onSubmit={onSubmit} className="p-4 border-t border-gray-200 bg-white">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx"
        className="hidden"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleUploadCvClick}
          disabled={isUploadingCv}
          className="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 disabled:bg-gray-50 text-slate-600 px-3.5 rounded-xl flex items-center justify-center transition border border-gray-200"
          title="Attach CV File"
        >
          {isUploadingCv ? (
            <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Paperclip className="w-4 h-4" />
          )}
        </button>
        <input
          type="text"
          placeholder="Type a simulated message bubble as Candidate..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-gray-400 focus:outline-none focus:border-blue-600"
        />
        <button
          type="submit"
          className="bg-[#0068FF] hover:bg-blue-500 active:bg-blue-700 text-white px-4 rounded-xl flex items-center justify-center transition"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
