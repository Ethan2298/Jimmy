import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./theme-provider";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [apiKey, setApiKey] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    window.api?.getApiKey?.()?.then((key) => {
      if (key) setApiKey(key);
    });
  }, []);

  async function saveApiKey() {
    try {
      const result = await window.api.setApiKey(apiKey);
      if (result?.ok) {
        setSaveMsg("Saved");
        setTimeout(() => setSaveMsg(null), 2000);
      } else {
        setSaveMsg(result?.error ?? "Failed to save");
      }
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Failed to save");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section className="mt-8">
        <h2 className="text-lg font-medium">AI</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your API key is stored securely on this device.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setSaveMsg(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveApiKey();
            }}
            placeholder="sk-ant-..."
            className="w-80 rounded-md border bg-transparent px-3 py-1.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={saveApiKey}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
              "bg-accent text-accent-foreground hover:brightness-125"
            )}
          >
            Save
          </button>
          {saveMsg && (
            <span className={cn(
              "text-sm",
              saveMsg === "Saved" ? "text-muted-foreground" : "text-red-400"
            )}>
              {saveMsg}
            </span>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose your preferred theme.
        </p>

        <div className="mt-4 flex gap-4">
          <button
            onClick={() => setTheme("light")}
            className={cn(
              "flex flex-col items-center gap-3 rounded-lg border-2 px-8 py-6 transition-colors",
              theme === "light"
                ? "border-foreground bg-accent"
                : "border-border hover:border-muted-foreground"
            )}
          >
            <Sun className="h-6 w-6" />
            <span className="text-sm font-medium">Light</span>
          </button>

          <button
            onClick={() => setTheme("dark")}
            className={cn(
              "flex flex-col items-center gap-3 rounded-lg border-2 px-8 py-6 transition-colors",
              theme === "dark"
                ? "border-foreground bg-accent"
                : "border-border hover:border-muted-foreground"
            )}
          >
            <Moon className="h-6 w-6" />
            <span className="text-sm font-medium">Dark</span>
          </button>
        </div>
      </section>
    </div>
  );
}
