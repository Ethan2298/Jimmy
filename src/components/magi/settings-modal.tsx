"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { AIProvider } from "@/lib/magi/ai-provider";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveApiKey: (provider: AIProvider, key: string) => void;
}

export function SettingsModal({ isOpen, onClose, onSaveApiKey }: SettingsModalProps) {
  const [provider, setProvider] = useState<AIProvider>("openai");
  const [value, setValue] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-center justify-center px-4">
      <div className="w-full max-w-[460px] rounded-[14px] border border-white/[0.12] bg-[#121214] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-medium text-white">Settings</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-white/[0.08] text-white/70 hover:text-white grid place-items-center"
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-[13px] text-white/70">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as AIProvider)}
              className="w-full h-10 rounded-[10px] border border-white/[0.12] bg-black/20 px-3 text-[13px] text-white outline-none focus:border-white/35"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>
          <label className="text-[13px] text-white/70">
            {provider === "openai" ? "OpenAI API Key" : "Anthropic API Key"}
          </label>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type="password"
            placeholder={provider === "openai" ? "sk-..." : "sk-ant-..."}
            className="w-full h-10 rounded-[10px] border border-white/[0.12] bg-black/20 px-3 text-[13px] text-white outline-none focus:border-white/35"
          />
          <p className="text-[12px] text-white/45">
            Key is stored in your browser only. Or set OPENAI_API_KEY / ANTHROPIC_API_KEY server-side.
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 px-3 rounded-[9px] border border-white/[0.12] text-[13px] text-white/75 hover:text-white hover:bg-white/[0.06]"
          >
            Cancel
          </button>
          <button
            disabled={!value.trim()}
            onClick={() => {
              onSaveApiKey(provider, value.trim());
              setValue("");
              onClose();
            }}
            className="h-9 px-3 rounded-[9px] bg-white text-black text-[13px] disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
