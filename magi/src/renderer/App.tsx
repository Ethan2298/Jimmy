import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { readUIMessageStream, type UIMessageChunk } from "ai";
import { LeftSidebar } from "./components/left-sidebar";
import { TopBar } from "./components/top-bar";
import { ComposerDock } from "./components/composer-dock";
import { Message } from "./components/message";
import { SettingsModal } from "./components/settings-modal";
import { ConfirmDeleteModal } from "./components/confirm-delete-modal";
import { StreamStatusRow, type StreamStatusEvent } from "./components/stream-status-row";
import { StreamMetrics } from "./components/stream-metrics";
import { WorkspaceItemPage } from "./components/workspace-item-page";
import { LibraryPanel } from "./components/library-panel";
import { useScrollOverlay } from "./lib/scroll-overlay";
import { buildSystemPrompt, isToolMessagePart, type ChatMessage } from "./lib/ai";
import {
  buildDefaultChatState,
  createThread,
  deriveThreadTitle,
  normalizeChatState,
  serializeChatState,
  searchThreads,
  sortThreads,
  type ChatState,
  type ChatThread,
} from "./lib/chat-threads";
import type { PermissionMode } from "./components/permission-picker";
import { DEFAULT_WIDTH, parseStoredSidebarWidth } from "./lib/sidebar-resize";
import {
  addWorkspaceItem,
  createDummyWorkspaceState,
  deleteWorkspaceItem,
  moveWorkspaceItem,
  renameWorkspaceItem,
  selectWorkspaceItem,
  toggleWorkspaceFolder,
  touchWorkspaceItem,
  updateWorkspaceDocContent,
  type WorkspaceItemType,
  type WorkspaceState,
} from "./lib/workspace";
import {
  CHAT_MAIN_VIEW,
  LIBRARY_MAIN_VIEW,
  normalizeMainView,
  resolveMainViewAfterWorkspaceSelection,
  type MainView,
} from "./lib/workspace-navigation";
import {
  computeRecentItems,
  loadPinnedState,
  resolvePinnedItems,
  savePinnedState,
  sidebarItemRefEquals,
  type PinnedState,
  type SidebarItemRef,
} from "./lib/sidebar-items";
import {
  LEGACY_MAIN_VIEW_STORAGE_KEY,
  LEGACY_WORKSPACE_STATE_STORAGE_KEY,
  buildWorkspaceSnapshot,
  diffSortOrders,
  resolveWorkspaceBootstrap,
} from "./lib/workspace-persistence";
import { resolveUniversalHeader } from "./lib/universal-header";
import { normalizePlatform, type Platform } from "../shared/platform";
import { PlatformShell, getShellProps } from "./shells";
import {
  getAllModelOptions,
  DEFAULT_PROVIDER,
  getDefaultModel,
  getProviderForModel,
  isValidProvider,
  type AIProvider,
} from "../shared/ai-provider";
import type {
  WorkspaceAddItemInput,
  WorkspaceDeleteItemInput,
  WorkspaceLoadResult,
  WorkspaceMoveItemInput,
  WorkspaceRenameItemInput,
  WorkspaceSaveResult,
  WorkspaceSnapshot,
  WorkspaceToggleCollapsedInput,
} from "../shared/workspace";

type ToolApprovalEvent =
  | {
      type: "tool-approval-requested";
      approvalId: string;
      toolCallId: string;
      toolName: string;
      args: unknown;
      destructive: boolean;
      reason: string;
    }
  | {
      type: "tool-approval-resolved";
      approvalId: string;
      toolCallId: string;
      approved: boolean;
    };

type RendererStreamStatusEvent = StreamStatusEvent;

type PendingApproval = {
  approvalId: string;
  toolCallId: string;
  destructive: boolean;
  reason: string;
  resolving?: boolean;
};

type ApiKeyStatus = {
  anthropicConfigured: boolean;
  openaiConfigured: boolean;
};

type StoredModelConfig = {
  model: string;
};

export type StreamUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

declare global {
  interface Window {
    api: {
      platform: Platform;
      chat: (request: unknown) => Promise<{
        streamId: string;
        error?: string;
      }>;
      cancelChatStream: (streamId: string) => Promise<{ ok: boolean; error?: string }>;
      onChatStreamChunk: (streamId: string, cb: (event: UIMessageChunk) => void) => void;
      onChatStreamChunks: (streamId: string, cb: (events: UIMessageChunk[]) => void) => void;
      onChatToolApproval: (streamId: string, cb: (event: ToolApprovalEvent) => void) => void;
      onChatStreamStatus: (
        streamId: string,
        cb: (event: RendererStreamStatusEvent) => void
      ) => void;
      onChatStreamDone: (streamId: string, cb: () => void) => void;
      onChatStreamError: (streamId: string, cb: (error: string) => void) => void;
      onChatStreamUsage: (streamId: string, cb: (usage: StreamUsage) => void) => void;
      approveChatTool: (
        streamId: string,
        approvalId: string,
        approved: boolean
      ) => Promise<{ ok: boolean; error?: string }>;
      offChatStream: (streamId: string) => void;
      getApiKey: () => Promise<string | null>;
      setApiKey: (key: string) => Promise<{ ok: boolean; error?: string }>;
      getApiKeysStatus: () => Promise<
        { ok: true; anthropicConfigured: boolean; openaiConfigured: boolean } |
        { ok: false; anthropicConfigured: boolean; openaiConfigured: boolean; error?: string }
      >;
      setApiKeyForProvider: (
        provider: AIProvider,
        key: string
      ) => Promise<{ ok: boolean; error?: string }>;
      getRecentActivity: (sinceMinutes: number) => Promise<string>;
      loadData: () => Promise<string | null>;
      saveData: (json: string) => Promise<void>;
      workspaceLoad: () => Promise<WorkspaceLoadResult>;
      workspaceReplaceSnapshot: (snapshot: WorkspaceSnapshot) => Promise<WorkspaceSaveResult>;
      workspaceSaveDoc: (payload: {
        docId: string;
        markdown: string;
      }) => Promise<WorkspaceSaveResult>;
      workspaceSaveUi: (payload: {
        selectedId: string | null;
        mainView: MainView;
      }) => Promise<WorkspaceSaveResult>;
      workspaceToggleCollapsed: (payload: WorkspaceToggleCollapsedInput) => Promise<WorkspaceSaveResult>;
      workspaceRenameItem: (payload: WorkspaceRenameItemInput) => Promise<WorkspaceSaveResult>;
      workspaceAddItem: (payload: WorkspaceAddItemInput) => Promise<WorkspaceSaveResult>;
      workspaceDeleteItem: (payload: WorkspaceDeleteItemInput) => Promise<WorkspaceSaveResult>;
      workspaceMoveItem: (payload: WorkspaceMoveItemInput) => Promise<WorkspaceSaveResult>;
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
    };
  }
}

const STORAGE_KEY = "outcome-ai:chat-v2";
const SIDEBAR_WIDTH_STORAGE_KEY = "outcome-ai:sidebar-width-v1";
const MODEL_CONFIG_STORAGE_KEY = "outcome-ai:model-config-v1";
const ACTIVITY_CONTEXT_KEY = "outcome-ai:activity-context-v1";

function nowISO(): string {
  return new Date().toISOString();
}

function getActiveThread(state: ChatState): ChatThread | undefined {
  return state.threads.find((thread) => thread.id === state.activeThreadId);
}

function loadFromLocalStorage(): ChatState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaultChatState(nowISO());
    return normalizeChatState(JSON.parse(raw), nowISO());
  } catch {
    return buildDefaultChatState(nowISO());
  }
}

function defaultKeyStatus(): ApiKeyStatus {
  return {
    anthropicConfigured: false,
    openaiConfigured: false,
  };
}

function loadModelConfigFromLocalStorage(): StoredModelConfig {
  try {
    const raw = localStorage.getItem(MODEL_CONFIG_STORAGE_KEY);
    if (!raw) {
      return {
        model: getDefaultModel(DEFAULT_PROVIDER),
      };
    }
    const parsed = JSON.parse(raw) as Partial<StoredModelConfig & { provider?: AIProvider }>;

    if (typeof parsed.model === "string" && getProviderForModel(parsed.model)) {
      return { model: parsed.model };
    }

    if (isValidProvider(parsed.provider)) {
      return { model: getDefaultModel(parsed.provider) };
    }

    return { model: getDefaultModel(DEFAULT_PROVIDER) };
  } catch {
    return {
      model: getDefaultModel(DEFAULT_PROVIDER),
    };
  }
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 h-5" aria-label="Assistant is thinking">
      <span className="thinking-spinner" />
      <span className="thinking-text">Thinking</span>
    </div>
  );
}

function createTextMessage(role: "user" | "assistant", text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    parts: [{ type: "text", text }],
  };
}

function appendMessageToThread(
  state: ChatState,
  threadId: string,
  message: ChatMessage,
  nextTitle?: string,
  updatedAt = nowISO()
): ChatState {
  const threads = state.threads.map((thread) => {
    if (thread.id !== threadId) return thread;

    return {
      ...thread,
      title: nextTitle ?? thread.title,
      messages: [...thread.messages, message],
      updatedAt,
    };
  });

  return {
    ...state,
    threads: sortThreads(threads),
  };
}

export function App() {
  const platform = normalizePlatform(window.api.platform);
  const shellStyleConfig = getShellProps(platform);
  const [chatState, setChatState] = useState<ChatState>(loadFromLocalStorage);
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(createDummyWorkspaceState);
  const [mainView, setMainView] = useState<MainView>(CHAT_MAIN_VIEW);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [keyStatus, setKeyStatus] = useState<ApiKeyStatus>(defaultKeyStatus);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const [streamingThreadId, setStreamingThreadId] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<RendererStreamStatusEvent | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<Record<string, PendingApproval>>({});
  const [toolDurationsMs, setToolDurationsMs] = useState<Record<string, number>>({});
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null);
  const [lastStreamUsage, setLastStreamUsage] = useState<StreamUsage | null>(null);
  const [composerInput, setComposerInput] = useState("");
  const [permMode, setPermMode] = useState<PermissionMode>("ask");
  const [model, setModel] = useState<string>(() => loadModelConfigFromLocalStorage().model);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ id: string; name: string; type: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [threadSearchQuery, setThreadSearchQuery] = useState("");
  const [pinnedState, setPinnedState] = useState<PinnedState>(loadPinnedState);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      return parseStoredSidebarWidth(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
    } catch {
      return DEFAULT_WIDTH;
    }
  });

  const chatStateRef = useRef(chatState);
  const workspaceStateRef = useRef(workspaceState);
  const mainViewRef = useRef(mainView);
  const workspaceReadyRef = useRef(false);
  const activeStreamRef = useRef<string | null>(null);
  const toolStartMsByCallIdRef = useRef<Record<string, number>>({});
  const pendingDocSaveRef = useRef<{ docId: string; markdown: string } | null>(null);
  const docSaveTimerRef = useRef<number | null>(null);
  const docSaveInFlightRef = useRef(false);
  const prevActiveDocIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const orderedThreads = useMemo(() => sortThreads(chatState.threads), [chatState.threads]);
  const filteredThreads = useMemo(
    () => threadSearchQuery ? searchThreads(orderedThreads, threadSearchQuery) : orderedThreads,
    [orderedThreads, threadSearchQuery]
  );
  const activeThread = useMemo(
    () => orderedThreads.find((thread) => thread.id === chatState.activeThreadId),
    [orderedThreads, chatState.activeThreadId]
  );
  const activeMessages = activeThread?.messages ?? [];
  const showStreaming = isStreaming && streamingThreadId === chatState.activeThreadId;
  const activeWorkspaceItem = useMemo(
    () => (mainView.type === "workspace-item" ? workspaceState.items[mainView.itemId] ?? null : null),
    [mainView, workspaceState.items]
  );
  const isHeaderTitleEditable =
    mainView.type === "workspace-item" && activeWorkspaceItem?.type === "doc";
  const isWorkspaceItemView = mainView.type === "workspace-item" && !!activeWorkspaceItem;
  const activeDocId =
    activeWorkspaceItem?.type === "doc" && mainView.type === "workspace-item"
      ? activeWorkspaceItem.id
      : null;
  const mainScrollOverlay = useScrollOverlay(scrollRef);
  const provider = useMemo(() => getProviderForModel(model) ?? DEFAULT_PROVIDER, [model]);

  const pinnedItems = useMemo(
    () => resolvePinnedItems(pinnedState, orderedThreads, workspaceState),
    [pinnedState, orderedThreads, workspaceState]
  );
  const recentItems = useMemo(
    () => computeRecentItems(orderedThreads, workspaceState, pinnedState.items),
    [orderedThreads, workspaceState, pinnedState.items]
  );
  const activeItemRef = useMemo<SidebarItemRef | null>(() => {
    if (mainView.type === "chat") return { type: "thread", id: chatState.activeThreadId };
    if (mainView.type === "workspace-item") return { type: "workspace-item", id: mainView.itemId };
    return null;
  }, [mainView, chatState.activeThreadId]);

  const updateToolTimingFromMessage = useCallback((message: ChatMessage) => {
    const now = Date.now();
    const nextDurations: Record<string, number> = {};

    for (const part of message.parts) {
      if (!isToolMessagePart(part)) continue;
      const callId = part.toolCallId;

      if (!toolStartMsByCallIdRef.current[callId]) {
        toolStartMsByCallIdRef.current[callId] = now;
      }

      if (
        part.state === "output-available" ||
        part.state === "output-error" ||
        part.state === "output-denied"
      ) {
        const startedAt = toolStartMsByCallIdRef.current[callId] ?? now;
        nextDurations[callId] = Math.max(0, now - startedAt);
      }
    }

    if (Object.keys(nextDurations).length > 0) {
      setToolDurationsMs((prev) => ({ ...prev, ...nextDurations }));
    }
  }, []);

  const persistWorkspaceSnapshot = useCallback(async (nextState: WorkspaceState, nextView: MainView) => {
    if (!workspaceReadyRef.current) return;
    const result = await window.api.workspaceReplaceSnapshot(
      buildWorkspaceSnapshot(nextState, nextView)
    );
    if (!result.ok) {
      console.error("[workspace:replaceSnapshot]", result.error);
    }
  }, []);

  const persistWorkspaceUiState = useCallback(async (nextState: WorkspaceState, nextView: MainView) => {
    if (!workspaceReadyRef.current) return;
    const result = await window.api.workspaceSaveUi({
      selectedId: nextState.selectedId,
      mainView: nextView,
    });
    if (!result.ok) {
      console.error("[workspace:saveUi]", result.error);
    }
  }, []);

  const clearPendingDocSaveTimer = useCallback(() => {
    if (docSaveTimerRef.current !== null) {
      window.clearTimeout(docSaveTimerRef.current);
      docSaveTimerRef.current = null;
    }
  }, []);

  const flushPendingDocSave = useCallback(async () => {
    clearPendingDocSaveTimer();
    if (!workspaceReadyRef.current) return;
    if (docSaveInFlightRef.current) return;

    const pending = pendingDocSaveRef.current;
    if (!pending) return;

    docSaveInFlightRef.current = true;
    const result = await window.api.workspaceSaveDoc({
      docId: pending.docId,
      markdown: pending.markdown,
    });
    docSaveInFlightRef.current = false;

    if (result.ok) {
      if (pendingDocSaveRef.current === pending) {
        pendingDocSaveRef.current = null;
      }
    } else {
      console.error("[workspace:saveDoc]", result.error);
    }

    if (pendingDocSaveRef.current && pendingDocSaveRef.current !== pending) {
      void flushPendingDocSave();
    }
  }, [clearPendingDocSaveTimer]);

  const scheduleDocSave = useCallback(
    (docId: string, markdown: string) => {
      pendingDocSaveRef.current = { docId, markdown };
      if (!workspaceReadyRef.current) return;
      clearPendingDocSaveTimer();
      docSaveTimerRef.current = window.setTimeout(() => {
        void flushPendingDocSave();
      }, 350);
    },
    [clearPendingDocSaveTimer, flushPendingDocSave]
  );

  useEffect(() => {
    chatStateRef.current = chatState;
  }, [chatState]);

  useEffect(() => {
    workspaceStateRef.current = workspaceState;
  }, [workspaceState]);

  useEffect(() => {
    mainViewRef.current = mainView;
  }, [mainView]);

  useEffect(() => {
    workspaceReadyRef.current = workspaceReady;
  }, [workspaceReady]);

  useEffect(() => {
    let cancelled = false;

    window.api.getApiKeysStatus().then((status) => {
      if (cancelled) return;
      setKeyStatus({
        anthropicConfigured: status.anthropicConfigured,
        openaiConfigured: status.openaiConfigured,
      });
    });

    window.api.loadData().then((raw) => {
      if (cancelled) return;
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        const migrated = normalizeChatState(parsed, nowISO());
        setChatState(migrated);
        localStorage.setItem(STORAGE_KEY, serializeChatState(migrated));
      } catch {
        // ignore malformed file
      }
    });

    void (async () => {
      const dbLoad = await window.api.workspaceLoad();
      if (!dbLoad.ok) {
        console.error("[workspace:load]", dbLoad.error);
      }

      const bootstrap = resolveWorkspaceBootstrap({
        dbSnapshot: dbLoad.ok ? dbLoad.snapshot : null,
        legacyWorkspaceRaw: localStorage.getItem(LEGACY_WORKSPACE_STATE_STORAGE_KEY),
        legacyMainViewRaw: localStorage.getItem(LEGACY_MAIN_VIEW_STORAGE_KEY),
      });

      if (cancelled) return;

      workspaceStateRef.current = bootstrap.workspaceState;
      mainViewRef.current = bootstrap.mainView;
      setWorkspaceState(bootstrap.workspaceState);
      setMainView(bootstrap.mainView);

      if (bootstrap.shouldSeedDb) {
        const saveResult = await window.api.workspaceReplaceSnapshot(bootstrap.snapshotForDb);
        if (!saveResult.ok) {
          console.error("[workspace:replaceSnapshot]", saveResult.error);
        } else if (bootstrap.shouldClearLegacy) {
          try {
            localStorage.removeItem(LEGACY_WORKSPACE_STATE_STORAGE_KEY);
            localStorage.removeItem(LEGACY_MAIN_VIEW_STORAGE_KEY);
          } catch {
            // Ignore storage cleanup failures.
          }
        }
      }

      if (!cancelled) {
        setWorkspaceReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!shellStyleConfig.applyActiveInactiveTint) {
      delete document.documentElement.dataset.windowActive;
      return;
    }

    let blurTimer: number | null = null;

    const setActive = (active: boolean) => {
      document.documentElement.dataset.windowActive = active ? "true" : "false";
    };

    setActive(document.hasFocus());

    const handleFocus = () => {
      if (blurTimer !== null) {
        window.clearTimeout(blurTimer);
        blurTimer = null;
      }
      setActive(true);
    };

    const handleBlur = () => {
      if (blurTimer !== null) {
        window.clearTimeout(blurTimer);
      }
      blurTimer = window.setTimeout(() => {
        blurTimer = null;
        if (!document.hasFocus()) {
          setActive(false);
        }
      }, 80);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        handleBlur();
      } else {
        handleFocus();
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (blurTimer !== null) {
        window.clearTimeout(blurTimer);
      }
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [shellStyleConfig.applyActiveInactiveTint]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const serialized = serializeChatState(chatState);
      localStorage.setItem(STORAGE_KEY, serialized);
      window.api.saveData(serialized);
    }, 250);

    return () => clearTimeout(timer);
  }, [chatState]);

  useEffect(() => {
    setMainView((current) => {
      const normalized = normalizeMainView(current, workspaceState);
      if (normalized.type === "chat" && current.type === "chat") {
        return current;
      }
      if (
        normalized.type === "workspace-item" &&
        current.type === "workspace-item" &&
        normalized.itemId === current.itemId
      ) {
        return current;
      }
      void persistWorkspaceUiState(workspaceState, normalized);
      return normalized;
    });
  }, [persistWorkspaceUiState, workspaceState]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
    } catch {
      // Ignore storage write failures.
    }
  }, [sidebarWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(
        MODEL_CONFIG_STORAGE_KEY,
        JSON.stringify({ model } satisfies StoredModelConfig)
      );
    } catch {
      // Ignore storage write failures.
    }
  }, [model]);

  useEffect(() => {
    const prevDocId = prevActiveDocIdRef.current;
    if (prevDocId && prevDocId !== activeDocId) {
      void flushPendingDocSave();
    }
    prevActiveDocIdRef.current = activeDocId;
  }, [activeDocId, flushPendingDocSave]);

  useEffect(() => {
    return () => {
      clearPendingDocSaveTimer();
      void flushPendingDocSave();
    };
  }, [clearPendingDocSaveTimer, flushPendingDocSave]);

  useEffect(() => {
    if (!workspaceReady || !pendingDocSaveRef.current) return;
    clearPendingDocSaveTimer();
    docSaveTimerRef.current = window.setTimeout(() => {
      void flushPendingDocSave();
    }, 0);
  }, [clearPendingDocSaveTimer, flushPendingDocSave, workspaceReady]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 100) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [chatState.activeThreadId, activeMessages.length, showStreaming, streamingMessage]);

  useEffect(() => {
    return () => {
      if (activeStreamRef.current) {
        const streamId = activeStreamRef.current;
        void window.api.cancelChatStream(streamId).finally(() => {
          window.api.offChatStream(streamId);
        });
      }
    };
  }, []);

  const handleSelectThread = useCallback((id: string) => {
    setChatState((prev) => ({ ...prev, activeThreadId: id }));
    setMainView(CHAT_MAIN_VIEW);
    void persistWorkspaceUiState(workspaceStateRef.current, CHAT_MAIN_VIEW);
  }, [persistWorkspaceUiState]);

  const handleNewThread = useCallback(() => {
    const thread = createThread(nowISO());
    setChatState((prev) => ({
      ...prev,
      threads: sortThreads([thread, ...prev.threads]),
      activeThreadId: thread.id,
    }));
    setMainView(CHAT_MAIN_VIEW);
    void persistWorkspaceUiState(workspaceStateRef.current, CHAT_MAIN_VIEW);
    setComposerInput("");
  }, [persistWorkspaceUiState]);

  const handleDeleteThread = useCallback((id: string) => {
    setChatState((prev) => {
      const remaining = prev.threads.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        const thread = createThread(nowISO());
        return { ...prev, threads: [thread], activeThreadId: thread.id };
      }
      const activeThreadId = prev.activeThreadId === id ? remaining[0].id : prev.activeThreadId;
      return { ...prev, threads: remaining, activeThreadId };
    });
  }, []);

  const handleRenameThread = useCallback((id: string, title: string) => {
    setChatState((prev) => ({
      ...prev,
      threads: prev.threads.map((t) => (t.id === id ? { ...t, title } : t)),
    }));
  }, []);

  const handlePinItem = useCallback((ref: SidebarItemRef) => {
    setPinnedState((prev) => {
      if (prev.items.some((p) => sidebarItemRefEquals(p, ref))) return prev;
      const next = { items: [ref, ...prev.items] };
      savePinnedState(next);
      return next;
    });
  }, []);

  const handleUnpinItem = useCallback((ref: SidebarItemRef) => {
    setPinnedState((prev) => {
      const next = { items: prev.items.filter((p) => !sidebarItemRefEquals(p, ref)) };
      savePinnedState(next);
      return next;
    });
  }, []);

  const handleOpenLibrary = useCallback(() => {
    setMainView(LIBRARY_MAIN_VIEW);
    mainViewRef.current = LIBRARY_MAIN_VIEW;
    void persistWorkspaceUiState(workspaceStateRef.current, LIBRARY_MAIN_VIEW);
  }, [persistWorkspaceUiState]);

  const ensureActiveThread = useCallback((): string => {
    const current = getActiveThread(chatStateRef.current);
    if (current) return current.id;

    const thread = createThread(nowISO());
    setChatState((prev) => ({
      ...prev,
      threads: sortThreads([thread, ...prev.threads]),
      activeThreadId: thread.id,
    }));
    return thread.id;
  }, []);

  const handleSaveApiKey = useCallback(async (targetProvider: AIProvider, key: string) => {
    const result = await window.api.setApiKeyForProvider(targetProvider, key);
    if (!result.ok) {
      throw new Error(result.error ?? "Failed to save API key");
    }
    const status = await window.api.getApiKeysStatus();
    setKeyStatus({
      anthropicConfigured: status.anthropicConfigured,
      openaiConfigured: status.openaiConfigured,
    });
  }, []);

  const handleModelChange = useCallback((nextModel: string) => {
    if (!getProviderForModel(nextModel)) return;
    setModel(nextModel);
  }, []);

  const clearStreamingState = useCallback((streamId?: string | null) => {
    setIsStreaming(false);
    setStreamingThreadId(null);
    setStreamingMessage(null);
    setStreamStatus(null);
    setPendingApprovals({});
    activeStreamRef.current = null;
    toolStartMsByCallIdRef.current = {};
    if (streamId) {
      window.api.offChatStream(streamId);
    }
  }, []);

  const handleCancelStream = useCallback(() => {
    const streamId = activeStreamRef.current;
    if (!streamId) return;

    // Persist partial response before clearing
    const threadId = streamingThreadId;
    const partial = streamingMessage;
    if (threadId && partial) {
      setChatState((prev) =>
        appendMessageToThread(prev, threadId, partial, undefined, nowISO())
      );
    }

    void window.api.cancelChatStream(streamId).finally(() => {
      clearStreamingState(streamId);
    });
  }, [clearStreamingState, streamingMessage, streamingThreadId]);

  const handleChatScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const opacity = Math.min(el.scrollTop / 50, 1);
    el.style.setProperty("--chat-fade-opacity", String(opacity));
  }, []);

  const handleResolveApproval = useCallback(async (approvalId: string, approved: boolean) => {
    const streamId = activeStreamRef.current;
    if (!streamId) return;

    setPendingApprovals((prev) => {
      const current = Object.values(prev).find((item) => item.approvalId === approvalId);
      if (!current) return prev;
      return {
        ...prev,
        [current.toolCallId]: {
          ...current,
          resolving: true,
        },
      };
    });

    const result = await window.api.approveChatTool(streamId, approvalId, approved);
    if (!result.ok) {
      setPendingApprovals((prev) => {
        const current = Object.values(prev).find((item) => item.approvalId === approvalId);
        if (!current) return prev;
        return {
          ...prev,
          [current.toolCallId]: {
            ...current,
            resolving: false,
          },
        };
      });
    }
  }, []);

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleOpenSidebar = useCallback(() => {
    setSidebarOpen(true);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const handleWorkspaceSelect = useCallback((id: string) => {
    const touched = touchWorkspaceItem(workspaceStateRef.current, id);
    const next = selectWorkspaceItem(touched, id);
    workspaceStateRef.current = next;
    setWorkspaceState(next);
    const nextView = resolveMainViewAfterWorkspaceSelection(mainViewRef.current, next, id);
    mainViewRef.current = nextView;
    setMainView(nextView);
    void persistWorkspaceUiState(next, nextView);
  }, [persistWorkspaceUiState]);

  const handleSidebarItemClick = useCallback((ref: SidebarItemRef) => {
    if (ref.type === "thread") {
      handleSelectThread(ref.id);
    } else {
      handleWorkspaceSelect(ref.id);
    }
  }, [handleSelectThread, handleWorkspaceSelect]);

  const handleWorkspaceToggleFolder = useCallback((id: string) => {
    const current = workspaceStateRef.current;
    const next = toggleWorkspaceFolder(current, id);
    if (next === current) return;
    workspaceStateRef.current = next;
    setWorkspaceState(next);
    void window.api.workspaceToggleCollapsed({
      id,
      collapsed: next.items[id].collapsed ?? false,
    });
  }, []);

  const handleWorkspaceAddItem = useCallback(
    (type: WorkspaceItemType, parentId?: string | null) => {
      const current = workspaceStateRef.current;
      const next = addWorkspaceItem(current, { type, parentId });
      workspaceStateRef.current = next;
      setWorkspaceState(next);
      let nextView = mainViewRef.current;
      const nextSelectedId = next.selectedId;
      if (nextSelectedId) {
        nextView = resolveMainViewAfterWorkspaceSelection(mainViewRef.current, next, nextSelectedId);
        mainViewRef.current = nextView;
        setMainView(nextView);
      }

      const newId = next.selectedId!;
      const newItem = next.items[newId];
      const resolvedParentId = newItem.parentId;
      const uncollapseParentId =
        resolvedParentId &&
        current.items[resolvedParentId]?.collapsed &&
        !next.items[resolvedParentId]?.collapsed
          ? resolvedParentId
          : null;

      void window.api.workspaceAddItem({
        id: newId,
        type: newItem.type,
        name: newItem.name,
        parentId: newItem.parentId,
        sortOrder: newItem.sortOrder,
        collapsed: newItem.collapsed,
        projectKind: newItem.projectKind,
        docContent: newItem.type === "doc" ? "" : undefined,
        uncollapseParentId,
      });
      void persistWorkspaceUiState(next, nextView);
    },
    [persistWorkspaceUiState]
  );

  const handleWorkspaceRename = useCallback((id: string, nextName: string) => {
    const current = workspaceStateRef.current;
    const next = renameWorkspaceItem(current, id, nextName);
    if (next === current) return;
    workspaceStateRef.current = next;
    setWorkspaceState(next);
    void window.api.workspaceRenameItem({ id, name: next.items[id].name });
  }, []);

  const handleWorkspaceDelete = useCallback((id: string) => {
    const item = workspaceStateRef.current.items[id];
    if (!item) return;
    setDeletingItem({ id: item.id, name: item.name, type: item.type });
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deletingItem) return;
    void flushPendingDocSave();
    const current = workspaceStateRef.current;
    const next = deleteWorkspaceItem(current, deletingItem.id);
    if (next !== current) {
      workspaceStateRef.current = next;
      setWorkspaceState(next);
      const nextView = normalizeMainView(mainViewRef.current, next);
      mainViewRef.current = nextView;
      setMainView(nextView);
      void window.api.workspaceDeleteItem({
        id: deletingItem.id,
        siblingReorders: diffSortOrders(current, next),
      });
      void persistWorkspaceUiState(next, nextView);
    }
    setDeletingItem(null);
  }, [deletingItem, flushPendingDocSave, persistWorkspaceUiState]);

  const handleWorkspaceMove = useCallback(
    (id: string, targetParentId: string | null, targetIndex: number) => {
      const current = workspaceStateRef.current;
      const next = moveWorkspaceItem(current, {
        itemId: id,
        targetParentId,
        targetIndex,
      });
      if (next === current) return;
      workspaceStateRef.current = next;
      setWorkspaceState(next);
      void window.api.workspaceMoveItem({
        id,
        newParentId: next.items[id].parentId,
        siblingReorders: diffSortOrders(current, next),
      });
    },
    []
  );

  const handleWorkspaceDocChange = useCallback((docId: string, markdown: string) => {
    const next = updateWorkspaceDocContent(workspaceStateRef.current, docId, markdown);
    if (next === workspaceStateRef.current) return;
    workspaceStateRef.current = next;
    setWorkspaceState(next);
    scheduleDocSave(docId, markdown);
  }, [scheduleDocSave]);

  const startStream = useCallback(async (threadId: string, messages: ChatMessage[]) => {
    const hasProviderKey =
      provider === "openai" ? keyStatus.openaiConfigured : keyStatus.anthropicConfigured;
    if (!hasProviderKey) {
      const keyPrompt =
        provider === "openai"
          ? "Enter your OpenAI API key:"
          : "Enter your Anthropic API key:";
      const key = prompt(keyPrompt);
      if (!key) {
        setChatState((prev) =>
          appendMessageToThread(
            prev,
            threadId,
            createTextMessage("assistant", "API key required. Add one in Settings or try sending a message again.")
          )
        );
        return;
      }
      const saveResult = await window.api.setApiKeyForProvider(provider, key.trim());
      if (!saveResult.ok) {
        setChatState((prev) =>
          appendMessageToThread(
            prev,
            threadId,
            createTextMessage("assistant", `Error: ${saveResult.error ?? "Unable to save API key"}`)
          )
        );
        return;
      }
      const status = await window.api.getApiKeysStatus();
      setKeyStatus({
        anthropicConfigured: status.anthropicConfigured,
        openaiConfigured: status.openaiConfigured,
      });
    }

    setIsStreaming(true);
    setStreamingThreadId(threadId);
    setPendingApprovals({});
    setStreamingMessage(null);
    setStreamStatus(null);
    toolStartMsByCallIdRef.current = {};

    try {
      const now = new Date();
      const activityEnabled = localStorage.getItem(ACTIVITY_CONTEXT_KEY) === "true";
      let activitySummary: string | undefined;
      if (activityEnabled) {
        try {
          const summary = await window.api.getRecentActivity(15);
          if (summary) activitySummary = summary;
        } catch {
          // Activity tracking may not be available
        }
      }
      const systemPrompt = buildSystemPrompt({
        currentDate: now.toISOString().slice(0, 10),
        currentTime: now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        dayOfWeek: now.toLocaleDateString("en-US", { weekday: "long" }),
        permissionMode: permMode,
        activitySummary,
      });

      const result = await window.api.chat({
        provider,
        model,
        systemPrompt,
        messages,
        permissionMode: permMode,
        meta: {
          requestId: crypto.randomUUID(),
          threadId,
        },
      });

      if (result.error) {
        setChatState((prev) =>
          appendMessageToThread(prev, threadId, createTextMessage("assistant", `Error: ${result.error}`))
        );
        clearStreamingState();
        return;
      }

      const streamId = result.streamId;
      activeStreamRef.current = streamId;
      setStreamStartTime(Date.now());
      setLastStreamUsage(null);

      let streamController: ReadableStreamDefaultController<UIMessageChunk> | null = null;
      let streamTerminalError: string | null = null;
      let streamSettled = false;
      let latestStreamedMessage: ChatMessage | null = null;

      const chunkStream = new ReadableStream<UIMessageChunk>({
        start(controller) {
          streamController = controller;
        },
      });

      void (async () => {
        // RAF-throttle: coalesce token updates into one setState per animation frame
        let pendingMessage: ChatMessage | null = null;
        let rafId: number | null = null;

        const flushToState = () => {
          rafId = null;
          if (pendingMessage) {
            setStreamingMessage(pendingMessage);
            updateToolTimingFromMessage(pendingMessage);
          }
        };

        try {
          for await (const uiMessage of readUIMessageStream<ChatMessage>({
            stream: chunkStream,
            terminateOnError: false,
            onError: (error) => {
              if (!streamTerminalError) {
                streamTerminalError = error instanceof Error ? error.message : String(error);
              }
            },
          })) {
            if (activeStreamRef.current !== streamId) return;
            latestStreamedMessage = uiMessage;
            pendingMessage = uiMessage;
            if (rafId === null) {
              rafId = requestAnimationFrame(flushToState);
            }
          }
        } catch (error) {
          if (!streamTerminalError) {
            streamTerminalError = error instanceof Error ? error.message : String(error);
          }
        } finally {
          // Cancel pending RAF and flush final state immediately
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          if (pendingMessage) {
            setStreamingMessage(pendingMessage);
            updateToolTimingFromMessage(pendingMessage);
          }

          if (activeStreamRef.current !== streamId) return;

          const updatedAt = nowISO();
          if (latestStreamedMessage) {
            const messageToPersist = streamTerminalError
              ? {
                  ...latestStreamedMessage,
                  parts: [
                    ...latestStreamedMessage.parts,
                    { type: "text" as const, text: `\n\nError: ${streamTerminalError}` },
                  ],
                }
              : latestStreamedMessage;
            setChatState((prev) =>
              appendMessageToThread(prev, threadId, messageToPersist as ChatMessage, undefined, updatedAt)
            );
          } else if (streamTerminalError) {
            const errorText = `Error: ${streamTerminalError}`;
            setChatState((prev) =>
              appendMessageToThread(prev, threadId, createTextMessage("assistant", errorText), undefined, nowISO())
            );
          }

          clearStreamingState(streamId);
        }
      })();

      window.api.onChatStreamChunk(streamId, (event) => {
        if (activeStreamRef.current !== streamId || streamSettled) return;
        streamController?.enqueue(event);
      });

      window.api.onChatStreamChunks(streamId, (events) => {
        if (activeStreamRef.current !== streamId || streamSettled) return;
        for (const event of events) {
          streamController?.enqueue(event);
        }
      });

      window.api.onChatToolApproval(streamId, (event) => {
        if (activeStreamRef.current !== streamId) return;
        if (event.type === "tool-approval-requested") {
          setPendingApprovals((prev) => ({
            ...prev,
            [event.toolCallId]: {
              approvalId: event.approvalId,
              toolCallId: event.toolCallId,
              destructive: event.destructive,
              reason: event.reason,
            },
          }));
          return;
        }

        setPendingApprovals((prev) => {
          const next = { ...prev };
          delete next[event.toolCallId];
          return next;
        });
      });

      window.api.onChatStreamStatus(streamId, (event) => {
        if (activeStreamRef.current !== streamId) return;
        setStreamStatus(event);
      });

      window.api.onChatStreamDone(streamId, () => {
        if (activeStreamRef.current !== streamId || streamSettled) return;
        streamSettled = true;
        streamController?.close();
      });

      window.api.onChatStreamError(streamId, (error) => {
        if (activeStreamRef.current !== streamId || streamSettled) return;
        streamSettled = true;
        streamTerminalError = error;
        streamController?.error(new Error(error));
      });

      window.api.onChatStreamUsage(streamId, (usage) => {
        if (activeStreamRef.current !== streamId) return;
        setLastStreamUsage(usage);
      });
    } catch (err) {
      setChatState((prev) =>
        appendMessageToThread(
          prev,
          threadId,
          createTextMessage("assistant", `Error: ${err instanceof Error ? err.message : "Unknown error"}`)
        )
      );
      clearStreamingState();
    }
  }, [
    clearStreamingState,
    keyStatus.anthropicConfigured,
    keyStatus.openaiConfigured,
    model,
    permMode,
    provider,
    updateToolTimingFromMessage,
  ]);

  const handleSend = useCallback(async () => {
    if (mainView.type === "workspace-item") return;
    const text = composerInput.trim();
    if (!text || isStreaming) return;

    const threadId = ensureActiveThread();
    const thread = chatStateRef.current.threads.find((item) => item.id === threadId);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text }],
    };

    const nextTitle =
      thread && thread.messages.some((msg) => msg.role === "user")
        ? undefined
        : deriveThreadTitle(text);

    const updatedMessages = [...(thread?.messages ?? []), userMsg];

    setChatState((prev) => appendMessageToThread(prev, threadId, userMsg, nextTitle));
    setComposerInput("");

    await startStream(threadId, updatedMessages);
  }, [composerInput, ensureActiveThread, isStreaming, mainView.type, startStream]);

  const handleRegenerate = useCallback(async () => {
    if (isStreaming) return;
    const thread = getActiveThread(chatStateRef.current);
    if (!thread || thread.messages.length === 0) return;

    const lastMsg = thread.messages[thread.messages.length - 1];
    if (lastMsg.role !== "assistant") return;

    const messagesWithoutLast = thread.messages.slice(0, -1);
    setChatState((prev) => ({
      ...prev,
      threads: prev.threads.map((t) =>
        t.id === thread.id ? { ...t, messages: messagesWithoutLast, updatedAt: nowISO() } : t
      ),
    }));
    setLastStreamUsage(null);

    await startStream(thread.id, messagesWithoutLast);
  }, [isStreaming, startStream]);

  const universalHeader = resolveUniversalHeader({
    mainView,
    activeThread,
    activeWorkspaceItem,
  });

  return (
    <>
      <PlatformShell
        platform={platform}
        sidebarOpen={sidebarOpen}
        sidebarWidth={sidebarWidth}
        onSidebarWidthChange={setSidebarWidth}
        onToggleSidebar={useCallback(() => setSidebarOpen((prev) => !prev), [])}
        sidebar={
          <LeftSidebar
            searchQuery={threadSearchQuery}
            onSearchChange={setThreadSearchQuery}
            onNewThread={handleNewThread}
            onOpenSettings={handleOpenSettings}
            pinnedItems={pinnedItems}
            recentItems={recentItems}
            activeItemRef={activeItemRef}
            onItemClick={handleSidebarItemClick}
            onPinItem={handlePinItem}
            onUnpinItem={handleUnpinItem}
            onDeleteThread={handleDeleteThread}
            onRenameThread={handleRenameThread}
            onOpenLibrary={handleOpenLibrary}
          />
        }
        topBar={
          <TopBar
            contentType={universalHeader.contentType}
            title={universalHeader.title}
            canEditTitle={isHeaderTitleEditable}
            onRenameTitle={
              isHeaderTitleEditable && activeWorkspaceItem
                ? (nextName) => handleWorkspaceRename(activeWorkspaceItem.id, nextName)
                : undefined
            }
            showWindowControls={shellStyleConfig.showWindowControls}
          />
        }
        stream={
          mainView.type === "library" ? (
            <LibraryPanel
              threads={orderedThreads}
              activeThreadId={chatState.activeThreadId}
              workspaceState={workspaceState}
              onSelectThread={handleSelectThread}
              onDeleteThread={handleDeleteThread}
              onRenameThread={handleRenameThread}
              onWorkspaceSelect={handleWorkspaceSelect}
              onWorkspaceToggleFolder={handleWorkspaceToggleFolder}
              onWorkspaceAddItem={handleWorkspaceAddItem}
              onWorkspaceRename={handleWorkspaceRename}
              onWorkspaceDelete={handleWorkspaceDelete}
              onWorkspaceMove={handleWorkspaceMove}
            />
          ) : isWorkspaceItemView ? (
            <WorkspaceItemPage
              item={activeWorkspaceItem!}
              docMarkdown={
                activeWorkspaceItem?.type === "doc"
                  ? workspaceState.docContentById[activeWorkspaceItem.id] ?? ""
                  : undefined
              }
              onDocChange={handleWorkspaceDocChange}
            />
          ) : (
            <div className="relative h-full">
              <div
                ref={scrollRef}
                onScroll={handleChatScroll}
                className="main-chat-scroll h-full overflow-y-auto px-[26px] pt-5 pb-[35px]"
              >
                <div className="mx-auto w-full max-w-[704px] space-y-3">
                  {activeMessages.length === 0 && !showStreaming && (
                    <p className="text-center text-white/38 text-[13px] py-8">Ask anything</p>
                  )}

                  {activeMessages.map((msg, idx) => (
                    <Message
                      key={msg.id}
                      message={msg}
                      toolDurationsMs={toolDurationsMs}
                      isLast={idx === activeMessages.length - 1 && msg.role === "assistant"}
                      onRegenerate={handleRegenerate}
                    />
                  ))}

                  {showStreaming && (
                    <>
                      {streamStatus && <StreamStatusRow status={streamStatus} />}
                      {streamingMessage && streamingMessage.parts.length > 0 ? (
                        <Message
                          message={streamingMessage}
                          isStreaming
                          pendingApprovals={pendingApprovals}
                          onResolveApproval={handleResolveApproval}
                          toolDurationsMs={toolDurationsMs}
                        />
                      ) : (
                        <div className="flex justify-start animate-msg-enter">
                          <div className="px-3 py-2">
                            <ThinkingIndicator />
                          </div>
                        </div>
                      )}
                      <StreamMetrics
                        isStreaming
                        startTime={streamStartTime}
                        usage={null}
                      />
                    </>
                  )}

                  {!showStreaming && lastStreamUsage && activeMessages.length > 0 &&
                    activeMessages[activeMessages.length - 1].role === "assistant" && (
                    <StreamMetrics
                      isStreaming={false}
                      startTime={streamStartTime}
                      usage={lastStreamUsage}
                    />
                  )}
                </div>
              </div>
              {mainScrollOverlay.hasOverflow && (
                <div className="pointer-events-none absolute top-0 right-[6px] h-full w-[7px]">
                  <div
                    className={`scroll-fade-thumb ${mainScrollOverlay.visible ? "is-visible" : ""}`}
                    style={{
                      height: `${mainScrollOverlay.thumbHeight}px`,
                      transform: `translateY(${mainScrollOverlay.thumbTop}px)`,
                    }}
                  />
                </div>
              )}
            </div>
          )
        }
        composer={
          <ComposerDock
            input={composerInput}
            isStreaming={isStreaming}
            disabled={isWorkspaceItemView || mainView.type === "library"}
            disabledHint="Open a thread to send messages"
            permMode={permMode}
            model={model}
            modelOptions={getAllModelOptions()}
            onInputChange={setComposerInput}
            onPermModeChange={setPermMode}
            onModelChange={handleModelChange}
            onSend={handleSend}
            onCancel={handleCancelStream}
          />
        }
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={handleCloseSettings}
        keyStatus={keyStatus}
        onSaveApiKey={handleSaveApiKey}
      />

      <ConfirmDeleteModal
        item={deletingItem}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingItem(null)}
      />
    </>
  );
}
