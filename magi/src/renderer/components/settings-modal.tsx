import { useState } from "react";
import { X } from "lucide-react";
import type { AIProvider } from "../../shared/ai-provider";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  keyStatus: {
    anthropicConfigured: boolean;
    openaiConfigured: boolean;
  };
  onSaveApiKey: (provider: AIProvider, key: string) => Promise<void>;
}

export function SettingsModal({
  isOpen,
  onClose,
  keyStatus,
  onSaveApiKey,
}: SettingsModalProps) {
  const [provider, setProvider] = useState<AIProvider>("openai");
  const [value, setValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-center justify-center px-4">
      <div className="w-full max-w-[460px] rounded-[14px] border border-white/[0.12] bg-[#121214] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-medium">Settings</h2>
          <button
            onClick={onClose}
            className="magi-no-drag w-7 h-7 rounded-md hover:bg-white/[0.08] text-white/70 hover:text-white grid place-items-center"
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
            placeholder={
              provider === "openai"
                ? keyStatus.openaiConfigured
                  ? "••••••••••••••••"
                  : "sk-..."
                : keyStatus.anthropicConfigured
                  ? "••••••••••••••••"
                  : "sk-ant-..."
            }
            className="w-full h-10 rounded-[10px] border border-white/[0.12] bg-black/20 px-3 text-[13px] text-white outline-none focus:border-white/35"
          />
          <p className="text-[12px] text-white/45">
            {provider === "openai"
              ? keyStatus.openaiConfigured
                ? "OpenAI key is already configured."
                : "No OpenAI key saved yet."
              : keyStatus.anthropicConfigured
                ? "Anthropic key is already configured."
                : "No Anthropic key saved yet."}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-white/[0.08]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked={localStorage.getItem("outcome-ai:activity-context-v1") === "true"}
              onChange={(e) => {
                localStorage.setItem("outcome-ai:activity-context-v1", String(e.target.checked));
              }}
              className="rounded border-white/30"
            />
            <span className="text-[13px] text-white/70">Share activity context with AI</span>
          </label>
          <p className="mt-1 ml-5 text-[12px] text-white/35">
            Includes recent app usage (app names, typing sessions) in the system prompt. No clipboard content or window titles are shared.
          </p>
        </div>

        {error && <p className="mt-2 text-[12px] text-red-300">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="magi-no-drag h-9 px-3 rounded-[9px] border border-white/[0.12] text-[13px] text-white/75 hover:text-white hover:bg-white/[0.06]"
          >
            Cancel
          </button>
          <button
            disabled={!value.trim() || isSaving}
            onClick={async () => {
              try {
                setIsSaving(true);
                setError(null);
                await onSaveApiKey(provider, value.trim());
                setValue("");
                onClose();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to save key");
              } finally {
                setIsSaving(false);
              }
            }}
            className="magi-no-drag h-9 px-3 rounded-[9px] bg-white text-black text-[13px] disabled:opacity-40"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
