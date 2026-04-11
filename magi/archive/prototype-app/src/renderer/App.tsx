import { useState, useEffect, useCallback } from "react";
import { cn } from "./lib/utils";
import { SidebarProvider, useSidebar } from "./components/ui/sidebar";
import { ThemeProvider } from "./components/theme-provider";
import { TitleBar } from "./components/title-bar";
import { AreasSidebar } from "./components/areas-sidebar";
import { GoalsSidebar } from "./components/app-sidebar";
import { SettingsPage } from "./components/settings-page";
import { ObjectivePage } from "./components/objective-page";

export type Task = {
  id: string;
  title: string;
  description: string;
  status: "pending" | "completed" | "skipped";
  completedAt?: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "ai";
  type?: "system";
  text: string;
  createdAt: string;
};

export type ChatThread = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
};

export type Goal = {
  id: string;
  areaId: string;
  title: string;
  context: string[];
  tasks: Task[];
  chatThreads: ChatThread[];
  activeChatThreadId: string | null;
  createdAt: string;
};

export type Area = {
  id: string;
  title: string;
  icon?: string;
  iconColor?: string;
  createdAt: string;
};

type AppData = {
  areas: Area[];
  goals: Goal[];
};

type Page = "home" | "goal" | "settings";

const STORAGE_KEY = "outcome-ai:goals";
const OLD_STORAGE_KEY = "outcome-ai:outcomes";

function makeDefaultThread(): ChatThread {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    messages: [],
    createdAt: new Date().toISOString(),
  };
}

function migrateGoal(o: Record<string, unknown>, areaId: string): Goal {
  const base = o as any;
  const thread = makeDefaultThread();
  return {
    id: base.id,
    areaId: base.areaId ?? areaId,
    title: base.title,
    context: base.context ?? [],
    tasks: (base.tasks ?? []).map((t: any) => ({
      ...t,
      title: t.title ?? t.action ?? "",
      description: t.description ?? t.context ?? "",
    })),
    chatThreads: base.chatThreads ?? [thread],
    activeChatThreadId: base.activeChatThreadId ?? (base.chatThreads ? null : thread.id),
    createdAt: base.createdAt ?? new Date().toISOString(),
  };
}

const DEFAULT_AREA_ID = "default-general";

function parseRawData(parsed: any): AppData | null {
  // New format: { areas, goals }
  if (parsed && typeof parsed === "object" && "areas" in parsed) {
    const data = parsed as { areas: Area[]; goals?: Record<string, unknown>[]; outcomes?: Record<string, unknown>[] };
    const items = data.goals ?? data.outcomes ?? [];
    return {
      areas: data.areas,
      goals: items.map((o) => migrateGoal(o, DEFAULT_AREA_ID)),
    };
  }
  // Old format: Goal[]
  if (Array.isArray(parsed)) {
    const generalArea: Area = {
      id: DEFAULT_AREA_ID,
      title: "General",
      createdAt: new Date().toISOString(),
    };
    return {
      areas: [generalArea],
      goals: parsed.map((o) => migrateGoal(o, DEFAULT_AREA_ID)),
    };
  }
  return null;
}

function loadAppData(): AppData {
  try {
    // Try new key first
    let raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const result = parseRawData(JSON.parse(raw));
      if (result) return result;
    }
    // Fall back to old key
    raw = localStorage.getItem(OLD_STORAGE_KEY);
    if (raw) {
      const result = parseRawData(JSON.parse(raw));
      if (result) return result;
    }
  } catch {}
  const generalArea: Area = {
    id: DEFAULT_AREA_ID,
    title: "General",
    createdAt: new Date().toISOString(),
  };
  return { areas: [generalArea], goals: [] };
}

function saveAppData(data: AppData) {
  const json = JSON.stringify(data);
  localStorage.setItem(STORAGE_KEY, json);
  window.api?.saveData(json);
}

function AppInner() {
  const [activePage, setActivePage] = useState<Page>("home");
  const [data, setData] = useState<AppData>(loadAppData);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(
    () => loadAppData().areas[0]?.id ?? null
  );
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const { collapsed } = useSidebar();

  // On mount, try loading from file (git-synced) — overrides localStorage if present
  useEffect(() => {
    window.api?.loadData().then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        const migrated = parseRawData(parsed);
        if (migrated && (migrated.goals.length > 0 || migrated.areas.length > 0)) {
          setData(migrated);
          localStorage.setItem(STORAGE_KEY, raw);
          if (!activeAreaId && migrated.areas.length > 0) {
            setActiveAreaId(migrated.areas[0].id);
          }
        }
      } catch {}
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => saveAppData(data), 200);
    return () => clearTimeout(timer);
  }, [data]);

  const activeArea = data.areas.find((a) => a.id === activeAreaId) ?? null;
  const areaGoals = data.goals.filter((o) => o.areaId === activeAreaId);
  const activeGoal = data.goals.find((o) => o.id === activeGoalId) ?? null;

  // --- Area handlers ---
  const handleSelectArea = useCallback((id: string) => {
    setActiveAreaId(id);
    setActiveGoalId(null);
    setActivePage("home");
  }, []);

  const handleAddArea = useCallback((title: string) => {
    const id = crypto.randomUUID();
    const area: Area = { id, title, createdAt: new Date().toISOString() };
    setData((prev) => ({ ...prev, areas: [...prev.areas, area] }));
    setActiveAreaId(id);
    setActiveGoalId(null);
    setActivePage("home");
  }, []);

  const handleUpdateArea = useCallback((id: string, partial: Partial<Area>) => {
    setData((prev) => ({
      ...prev,
      areas: prev.areas.map((a) => (a.id === id ? { ...a, ...partial } : a)),
    }));
  }, []);

  const handleDeleteArea = useCallback((id: string) => {
    setData((prev) => ({
      areas: prev.areas.filter((a) => a.id !== id),
      goals: prev.goals.filter((o) => o.areaId !== id),
    }));
    if (activeAreaId === id) {
      setActiveAreaId((prev) => {
        const remaining = data.areas.filter((a) => a.id !== id);
        return remaining[0]?.id ?? null;
      });
      setActiveGoalId(null);
      setActivePage("home");
    }
  }, [activeAreaId, data.areas]);

  // --- Goal handlers ---
  const handleSelectGoal = useCallback((id: string) => {
    setActiveGoalId(id);
    setActivePage("goal");
  }, []);

  const handleAddGoal = useCallback((title: string) => {
    if (!activeAreaId) return;
    const id = crypto.randomUUID();
    const thread = makeDefaultThread();
    const goal: Goal = {
      id,
      areaId: activeAreaId,
      title,
      context: [],
      tasks: [],
      chatThreads: [thread],
      activeChatThreadId: thread.id,
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({ ...prev, goals: [...prev.goals, goal] }));
    setActiveGoalId(id);
    setActivePage("goal");
  }, [activeAreaId]);

  const handleUpdateGoal = useCallback((id: string, partial: Partial<Goal>) => {
    setData((prev) => ({
      ...prev,
      goals: prev.goals.map((o) => (o.id === id ? { ...o, ...partial } : o)),
    }));
  }, []);

  const handleDeleteGoal = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      goals: prev.goals.filter((o) => o.id !== id),
    }));
    if (activeGoalId === id) {
      setActiveGoalId(null);
      setActivePage("home");
    }
  }, [activeGoalId]);

  const handleReorderGoals = useCallback((orderedIds: string[]) => {
    setData((prev) => {
      const idSet = new Set(orderedIds);
      const byId = new Map(prev.goals.map((o) => [o.id, o]));
      const reordered = orderedIds.map((id) => byId.get(id)!);
      const rest = prev.goals.filter((o) => !idSet.has(o.id));
      return { ...prev, goals: [...reordered, ...rest] };
    });
  }, []);

  const handleNavigate = useCallback((page: Page) => {
    setActivePage(page);
    if (page !== "goal") setActiveGoalId(null);
  }, []);

  const goalsCollapsed = !activeAreaId;

  return (
    <div className="flex h-screen w-screen overflow-hidden relative">
      <TitleBar />
      {window.api?.platform === "darwin" && (
        <div className="titlebar-drag absolute top-0 left-0 right-0 h-8 z-40" />
      )}
      <AreasSidebar
        activePage={activePage}
        activeAreaId={activeAreaId}
        areas={data.areas}
        onNavigate={handleNavigate}
        onSelectArea={handleSelectArea}
        onAddArea={handleAddArea}
        onUpdateArea={handleUpdateArea}
        onDeleteArea={handleDeleteArea}
      />
      <div className={cn("flex-1 flex flex-col pt-8 pb-2 pr-2 bg-sidebar min-w-0 transition-[padding] duration-200", collapsed && "pl-2")}>
        <div className="flex-1 flex overflow-hidden rounded-sm bg-background border border-border" style={{ boxShadow: '0 2px 3px -3px rgba(0,0,0,0.2)' }}>
          <GoalsSidebar
            collapsed={goalsCollapsed}
            activeGoalId={activeGoalId}
            goals={areaGoals}
            onSelectGoal={handleSelectGoal}
            onAddGoal={handleAddGoal}
            onDeleteGoal={handleDeleteGoal}
            onReorderGoals={handleReorderGoals}
          />
          <main className="flex-1 overflow-auto p-8 pt-6">
            {activePage === "settings" ? (
              <SettingsPage />
            ) : activePage === "goal" && activeGoal ? (
              <ObjectivePage
                goal={activeGoal}
                onUpdate={(partial) => handleUpdateGoal(activeGoal.id, partial)}
              />
            ) : (
              <>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {activeArea ? activeArea.title : "Outcome AI"}
                </h1>
                <p className="mt-2 text-muted-foreground">
                  {activeArea
                    ? areaGoals.length === 0
                      ? "No goals yet. Create one from the sidebar."
                      : "Select a goal from the sidebar."
                    : "Select an area to get started."}
                </p>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <AppInner />
      </SidebarProvider>
    </ThemeProvider>
  );
}
