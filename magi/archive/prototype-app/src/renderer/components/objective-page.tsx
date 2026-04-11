import { useState, useRef, useEffect, useCallback } from "react";
import { Check, X, ChevronDown, ChevronLeft, ChevronRight, ArrowUp, Plus, Minus, SquarePen, ChevronsRight, Settings2, RefreshCw, Layers, Expand, Trash2 } from "lucide-react";
import { PixelLEDIcon, PixelAIIcon } from "./pixel-icon";
import { WysiwygEditor } from "./wysiwyg-editor";

function IconFloating({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 10" fill="none" className={className}>
      <rect x="0.5" y="0.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1" />
      <rect x="7.5" y="4.5" width="5" height="4" rx="1" fill="currentColor" />
    </svg>
  );
}

function IconSidePanel({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 10" fill="none" className={className}>
      <rect x="0.5" y="0.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1" />
      <rect x="7" y="0.5" width="6.5" height="9" rx="1.5" fill="currentColor" />
    </svg>
  );
}
import { cn, timeAgo } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Streamdown } from "streamdown";
import { buildSystemPrompt, CLAUDE_TOOLS, applyToolCalls, buildClaudeMessages } from "@/lib/goal-ai";
import type { Goal, Task, ChatThread, ChatMessage } from "../App";

function groupThreadsByDate(threads: ChatThread[]): { label: string; threads: ChatThread[] }[] {
  const now = Date.now();
  const day = 86400000;
  const groups: { label: string; threads: ChatThread[] }[] = [
    { label: "Today", threads: [] },
    { label: "Yesterday", threads: [] },
    { label: "Past 7 days", threads: [] },
    { label: "Past 30 days", threads: [] },
    { label: "Older", threads: [] },
  ];

  const sorted = [...threads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const t of sorted) {
    const age = now - new Date(t.createdAt).getTime();
    if (age < day) groups[0].threads.push(t);
    else if (age < 2 * day) groups[1].threads.push(t);
    else if (age < 7 * day) groups[2].threads.push(t);
    else if (age < 30 * day) groups[3].threads.push(t);
    else groups[4].threads.push(t);
  }

  return groups.filter((g) => g.threads.length > 0);
}

export function ObjectivePage({
  goal,
  onUpdate,
}: {
  goal: Goal;
  onUpdate: (partial: Partial<Goal>) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(goal.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatValue, setChatValue] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [historyPopoverOpen, setHistoryPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [contextOpen, setContextOpen] = useState(true);
  const [addingContext, setAddingContext] = useState(false);
  const [newContextValue, setNewContextValue] = useState("");
  const [editingContextIndex, setEditingContextIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contextInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [chatLayout, setChatLayout] = useState<"floating" | "panel">(() => {
    const saved = localStorage.getItem("outcome-ai:chat-layout");
    return saved === "panel" ? "panel" : "floating";
  });
  const [layoutPopoverOpen, setLayoutPopoverOpen] = useState(false);
  const layoutPopoverRef = useRef<HTMLDivElement>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const isStreamingRef = useRef(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Ref to avoid stale closures in async callbacks
  const goalRef = useRef(goal);
  goalRef.current = goal;

  // Track goal ID to detect switches
  const goalIdRef = useRef(goal.id);
  // Track whether we've auto-triggered for this goal
  const autoTriggeredRef = useRef<string | null>(null);
  // Track the currently streaming message ID
  const streamingMsgIdRef = useRef<string | null>(null);

  // Sync title draft when switching goals
  useEffect(() => {
    setTitleDraft(goal.title);
  }, [goal.id]);

  // Reset auto-trigger tracking when goal changes
  useEffect(() => {
    if (goalIdRef.current !== goal.id) {
      goalIdRef.current = goal.id;
      autoTriggeredRef.current = null;
    }
  }, [goal.id]);

  const completedTasks = goal.tasks
    .filter((t) => t.status === "completed")
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
  const currentTask = goal.tasks.find((t) => t.status === "pending") ?? null;

  const activeThread = goal.chatThreads.find((t) => t.id === goal.activeChatThreadId) ?? null;
  const activeMessages = activeThread?.messages ?? [];

  // Scroll on new messages or when thinking indicator appears
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, isAiLoading]);

  // Scroll during streaming updates
  useEffect(() => {
    if (streamingMsgIdRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setHistoryPopoverOpen(false);
      }
    }
    if (historyPopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [historyPopoverOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (layoutPopoverRef.current && !layoutPopoverRef.current.contains(e.target as Node)) {
        setLayoutPopoverOpen(false);
      }
    }
    if (layoutPopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [layoutPopoverOpen]);

  // --- AI helpers ---

  const appendMessages = useCallback(
    (threadId: string, msgs: ChatMessage[], titleOverride?: string) => {
      const o = goalRef.current;
      const updatedThreads = o.chatThreads.map((t) =>
        t.id === threadId
          ? {
              ...t,
              messages: [...t.messages, ...msgs],
              title: titleOverride !== undefined ? titleOverride : t.title,
            }
          : t
      );
      onUpdate({ chatThreads: updatedThreads });
    },
    [onUpdate]
  );

  const updateMessageText = useCallback(
    (threadId: string, msgId: string, text: string) => {
      const o = goalRef.current;
      const updatedThreads = o.chatThreads.map((t) =>
        t.id === threadId
          ? {
              ...t,
              messages: t.messages.map((m) =>
                m.id === msgId ? { ...m, text } : m
              ),
            }
          : t
      );
      onUpdate({ chatThreads: updatedThreads });
    },
    [onUpdate]
  );

  const callAI = useCallback(
    async (allMessages: ChatMessage[], threadId: string): Promise<void> => {
      if (!window.api?.getApiKey) {
        setAiError("API not available. Try restarting the app.");
        return;
      }
      const apiKey = await window.api.getApiKey();
      if (!apiKey) {
        setAiError("No API key set. Go to Settings to add your Anthropic API key.");
        return;
      }

      setIsAiLoading(true);
      setAiError(null);

      try {
        const o = goalRef.current;
        const systemPrompt = buildSystemPrompt(o);
        const messages = buildClaudeMessages(allMessages);

        const response = await window.api.chat({
          apiKey,
          systemPrompt,
          messages,
          tools: CLAUDE_TOOLS,
        });

        if (response.error) {
          setAiError(response.error);
          setIsAiLoading(false);
          return;
        }

        // Apply tool calls to goal state
        if (response.toolCalls.length > 0) {
          const updates = applyToolCalls(goalRef.current, response.toolCalls);
          onUpdate(updates);
        }

        // Create placeholder AI message and append to thread
        const aiMsgId = crypto.randomUUID();
        const aiMsg: ChatMessage = {
          id: aiMsgId,
          role: "ai",
          text: "",
          createdAt: new Date().toISOString(),
        };
        appendMessages(threadId, [aiMsg]);
        streamingMsgIdRef.current = aiMsgId;

        // Set up streaming listeners
        const { streamId } = response;
        let accumulated = "";
        let rafPending = false;

        window.api.onChatStreamDelta(streamId, (text) => {
          accumulated += text;
          if (!isStreamingRef.current) { isStreamingRef.current = true; setIsStreaming(true); }
          if (!rafPending) {
            rafPending = true;
            requestAnimationFrame(() => {
              rafPending = false;
              updateMessageText(threadId, aiMsgId, accumulated);
            });
          }
        });

        window.api.onChatStreamDone(streamId, () => {
          // Flush any remaining text
          updateMessageText(threadId, aiMsgId, accumulated || "Done.");
          streamingMsgIdRef.current = null;
          isStreamingRef.current = false; setIsStreaming(false);
          setIsAiLoading(false);
          window.api.offChatStream(streamId);
        });

        window.api.onChatStreamError(streamId, (error) => {
          setAiError(error);
          // Keep whatever text we have so far
          if (accumulated) {
            updateMessageText(threadId, aiMsgId, accumulated);
          } else {
            updateMessageText(threadId, aiMsgId, "Error occurred.");
          }
          streamingMsgIdRef.current = null;
          isStreamingRef.current = false; setIsStreaming(false);
          setIsAiLoading(false);
          window.api.offChatStream(streamId);
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setAiError(message);
        setIsAiLoading(false);
      }
    },
    [onUpdate, appendMessages, updateMessageText]
  );

  async function sendMessage() {
    if (!chatValue.trim() || !activeThread || isAiLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: chatValue.trim(),
      createdAt: new Date().toISOString(),
    };

    // Update thread title from first user message
    const isFirst = activeThread.messages.length === 0;
    const titleOverride = isFirst ? chatValue.trim().slice(0, 50) : undefined;

    appendMessages(activeThread.id, [userMsg], titleOverride);
    setChatValue("");

    const allMessages = [...activeThread.messages, userMsg];
    await callAI(allMessages, activeThread.id);
  }

  const autoTrigger = useCallback(
    async (systemText: string) => {
      const thread = goalRef.current.chatThreads.find(
        (t) => t.id === goalRef.current.activeChatThreadId
      );
      if (!thread) return;

      const sysMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        type: "system",
        text: systemText,
        createdAt: new Date().toISOString(),
      };

      appendMessages(thread.id, [sysMsg]);

      const allMessages = [...thread.messages, sysMsg];
      await callAI(allMessages, thread.id);
      // Auto-open chat when AI responds
      setChatOpen(true);
    },
    [appendMessages, callAI]
  );

  // Auto-trigger: goal created with no tasks and no chat history
  useEffect(() => {
    if (
      autoTriggeredRef.current === goal.id ||
      goal.tasks.length > 0 ||
      activeMessages.length > 0 ||
      isAiLoading
    ) {
      return;
    }
    autoTriggeredRef.current = goal.id;
    autoTrigger("New goal created. Propose the first concrete step to get started.");
  }, [goal.id, goal.tasks.length, activeMessages.length, isAiLoading, autoTrigger]);

  function completeTask(taskId: string) {
    const task = goal.tasks.find((t) => t.id === taskId);
    const updated = goal.tasks.map((t) =>
      t.id === taskId
        ? { ...t, status: "completed" as const, completedAt: new Date().toISOString() }
        : t
    );
    onUpdate({ tasks: updated });
    if (task) {
      autoTrigger(`User completed task: "${task.title}". Acknowledge briefly and propose the next step.`);
    }
  }

  function challengeTask(taskId: string) {
    const task = goal.tasks.find((t) => t.id === taskId);
    if (task) {
      setChatOpen(true);
      autoTrigger(`User isn't sure about the current task: "${task.title}". Ask what's off and suggest an alternative.`);
    }
  }

  function updateTask(taskId: string, partial: Partial<Task>) {
    const updated = goal.tasks.map((t) =>
      t.id === taskId ? { ...t, ...partial } : t
    );
    onUpdate({ tasks: updated });
  }


  function addContext(item: string) {
    onUpdate({ context: [...goal.context, item] });
  }

  function removeContext(index: number) {
    onUpdate({ context: goal.context.filter((_, i) => i !== index) });
  }

  function createNewThread() {
    const thread: ChatThread = {
      id: crypto.randomUUID(),
      title: "New chat",
      messages: [],
      createdAt: new Date().toISOString(),
    };
    onUpdate({
      chatThreads: [...goal.chatThreads, thread],
      activeChatThreadId: thread.id,
    });
    setHistoryPopoverOpen(false);
  }

  function selectThread(threadId: string) {
    onUpdate({ activeChatThreadId: threadId });
    setHistoryPopoverOpen(false);
  }

  const chatGroups = groupThreadsByDate(goal.chatThreads);

  return (
    <div className={cn("relative transition-[margin] duration-300", chatOpen && chatLayout === "panel" && "mr-[480px]")}>
      <div className="max-w-2xl mx-auto">
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/40">
          Goal
        </p>
        {editingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const trimmed = titleDraft.trim();
                if (trimmed && trimmed !== goal.title) onUpdate({ title: trimmed });
                setEditingTitle(false);
              }
              if (e.key === "Escape") {
                setTitleDraft(goal.title);
                setEditingTitle(false);
              }
            }}
            onBlur={() => {
              const trimmed = titleDraft.trim();
              if (trimmed && trimmed !== goal.title) onUpdate({ title: trimmed });
              setEditingTitle(false);
            }}
            className="mt-1.5 w-full bg-transparent text-3xl font-semibold tracking-tight focus:outline-none border-b border-border/50 pb-1"
          />
        ) : (
          <h1
            onClick={() => {
              setTitleDraft(goal.title);
              setEditingTitle(true);
              setTimeout(() => titleInputRef.current?.focus(), 0);
            }}
            className="mt-1.5 text-3xl font-semibold tracking-tight cursor-text"
          >
            {goal.title}
          </h1>
        )}

        <div className="mt-8">
          <div className="rounded-2xl border border-border/50 bg-accent/30 p-6">
          {currentTask ? (
            <div>
              <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/40 mb-3 block">
                Up next
              </span>
              <textarea
                value={currentTask.title}
                onChange={(e) => {
                  updateTask(currentTask.id, { title: e.target.value });
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                placeholder="Task title"
                rows={1}
                className="w-full bg-transparent text-lg font-medium placeholder:text-muted-foreground/40 focus:outline-none resize-none overflow-hidden leading-snug"
              />
              <WysiwygEditor
                value={currentTask.description}
                onChange={(val) => updateTask(currentTask.id, { description: val })}
                placeholder="Add a description..."
                className="mt-2 text-sm text-muted-foreground/80"
              />
              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={() => completeTask(currentTask.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium",
                    "bg-primary/15 text-primary",
                    "hover:bg-primary/25 transition-all cursor-pointer"
                  )}
                >
                  <Check className="h-4 w-4" />
                  Mark done
                </button>
                <button
                  onClick={() => challengeTask(currentTask.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium",
                    "text-muted-foreground/60",
                    "hover:text-foreground hover:bg-accent transition-all cursor-pointer"
                  )}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Suggest another
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8">
              <PixelLEDIcon size={28} mode={isAiLoading ? "thinking" : "idle"} />
              <p className="mt-3 text-sm text-muted-foreground/50">
                {isAiLoading ? "Thinking about your first step..." : "No tasks yet"}
              </p>
            </div>
          )}
          </div>
        </div>

        <div className="mt-10 flex items-center gap-2 mb-3">
          <button
            onClick={() => setContextOpen(!contextOpen)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
              contextOpen
                ? "border-border bg-accent/60 text-muted-foreground"
                : "border-border/50 text-muted-foreground/40 hover:text-muted-foreground hover:border-border"
            )}
          >
            <Layers className="h-3 w-3" />
            Context
            {goal.context.length > 0 && (
              <span className="text-muted-foreground/40">{goal.context.length}</span>
            )}
          </button>
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
              historyOpen
                ? "border-border bg-accent/60 text-muted-foreground"
                : "border-border/50 text-muted-foreground/40 hover:text-muted-foreground hover:border-border"
            )}
          >
            <Check className="h-3 w-3" />
            Completed
            {completedTasks.length > 0 && (
              <span className="text-muted-foreground/40">{completedTasks.length}</span>
            )}
          </button>
        </div>
          {contextOpen && <div className="space-y-2">
            {goal.context.map((item, i) => (
              <div
                key={i}
                onClick={() => setEditingContextIndex(i)}
                className="group relative rounded-lg border border-border bg-accent/40 px-3 py-3 min-h-[48px] flex items-center cursor-pointer hover:border-muted-foreground/30 transition-colors"
              >
                <div className="text-xs text-muted-foreground pr-10 flex-1">
                  <Streamdown>{item}</Streamdown>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingContextIndex(i); }}
                  className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 rounded-md border border-border p-1.5 text-muted-foreground/40 hover:text-foreground hover:border-muted-foreground/30 transition-all cursor-pointer"
                >
                  <Expand className="h-3 w-3" />
                </button>
              </div>
            ))}
            {addingContext ? (
              <input
                ref={contextInputRef}
                type="text"
                value={newContextValue}
                onChange={(e) => setNewContextValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newContextValue.trim()) {
                    addContext(newContextValue.trim());
                    setNewContextValue("");
                    setAddingContext(false);
                  }
                  if (e.key === "Escape") {
                    setNewContextValue("");
                    setAddingContext(false);
                  }
                }}
                placeholder="Add context..."
                className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground placeholder:text-muted-foreground/30 focus:outline-none bg-transparent"
              />
            ) : (
              <button
                onClick={() => {
                  setAddingContext(true);
                  setTimeout(() => contextInputRef.current?.focus(), 0);
                }}
                className="flex items-center gap-1 rounded-lg border border-dashed border-border/50 px-3 py-2 text-xs text-muted-foreground/30 hover:text-muted-foreground hover:border-border transition-colors cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            )}
          </div>}

          {historyOpen && (
            <div className="mt-3 space-y-0.5">
              {completedTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground/40 py-2">No completed tasks yet</p>
              ) : (
                completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent/40 transition-colors">
                    <div className="shrink-0 h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <p className="flex-1 text-sm text-muted-foreground line-through decoration-muted-foreground/30">{task.title}</p>
                    <span className="shrink-0 text-xs text-muted-foreground/40">
                      {task.completedAt ? timeAgo(task.completedAt) : ""}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
      </div>

      {/* Chat history popover */}
      {chatOpen && historyPopoverOpen && (
        <div
          ref={popoverRef}
          className={cn(
            "fixed z-[70] w-64 rounded-xl border bg-muted/95 backdrop-blur-sm shadow-lg",
            chatLayout === "panel"
              ? "top-10"
              : "bottom-6 right-[236px]"
          )}
          style={{
            ...(chatLayout === "panel"
              ? { left: "calc(100vw - 480px + 16px)", height: "calc(100vh - 56px)" }
              : { height: "calc(100vh - 48px)", maxHeight: "640px" }
            ),
          }}
        >
          <ScrollArea className="h-full">
            <div className="p-2">
              {chatGroups.map((group, gi) => (
                <div key={group.label} className="pb-2">
                  {gi > 0 || true ? <div className="mx-3 border-b border-border/40 mb-1 mt-1" /> : null}
                  <p className="px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/50">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.threads.map((thread) => (
                      <button
                        key={thread.id}
                        onClick={() => selectThread(thread.id)}
                        className={cn(
                          "flex w-full items-center rounded-md px-3 py-1 text-sm transition-colors cursor-pointer",
                          thread.id === goal.activeChatThreadId
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <span className="truncate">{thread.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Chat panel — shared content for both layouts */}
      {chatOpen && (
        <div
          className={cn(
            "flex flex-col overflow-hidden",
            chatLayout === "panel"
              ? "fixed inset-y-0 right-0 w-[480px] h-full border-l bg-muted z-50"
              : "fixed bottom-6 right-6 z-50 w-[480px] rounded-2xl border bg-muted/95 backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-[10px] pb-3 titlebar-no-drag relative z-[60]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHistoryPopoverOpen(!historyPopoverOpen)}
                className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer"
              >
                {activeThread?.title ?? "Chat"}
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={createNewThread}
                className="rounded-md p-1.5 text-muted-foreground/40 hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                <SquarePen className="h-4 w-4" />
              </button>
              <div className="relative">
                <button
                  onClick={() => setLayoutPopoverOpen(!layoutPopoverOpen)}
                  className="rounded-md p-1.5 text-muted-foreground/40 hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  {chatLayout === "panel" ? <IconSidePanel className="h-4 w-4" /> : <IconFloating className="h-4 w-4" />}
                </button>
                {layoutPopoverOpen && (
                  <div
                    ref={layoutPopoverRef}
                    className="absolute top-full right-0 mt-1 w-40 rounded-lg border bg-muted/95 backdrop-blur-sm shadow-lg p-1 space-y-0.5 z-10"
                  >
                    <button
                      onClick={() => { setChatLayout("floating"); localStorage.setItem("outcome-ai:chat-layout", "floating"); setLayoutPopoverOpen(false); }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors cursor-pointer",
                        chatLayout === "floating"
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <IconFloating className="h-4 w-4" />
                      Floating
                    </button>
                    <button
                      onClick={() => { setChatLayout("panel"); localStorage.setItem("outcome-ai:chat-layout", "panel"); setLayoutPopoverOpen(false); }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors cursor-pointer",
                        chatLayout === "panel"
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <IconSidePanel className="h-4 w-4" />
                      Side panel
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground/40 hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                {chatLayout === "panel" ? <ChevronsRight className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className={cn("relative pr-1", chatLayout === "panel" ? "flex-1 min-h-0" : "h-[480px]")}>
            <div className="pointer-events-none absolute left-0 right-1 top-0 h-6 bg-gradient-to-b from-muted to-transparent z-10" />
            <div className="pointer-events-none absolute left-0 right-1 bottom-0 h-6 bg-gradient-to-t from-muted to-transparent z-10" />
          <div ref={messagesContainerRef} className="h-full overflow-y-auto pl-4 pr-4 py-3">
            {activeMessages.length === 0 && !isAiLoading ? (
              <p className="text-sm text-muted-foreground/40 mt-4 text-center">
                Ask anything about this goal
              </p>
            ) : (
              <div className="space-y-3">
                {activeMessages.map((msg) =>
                  msg.type === "system" ? (
                    <p
                      key={msg.id}
                      className="text-xs text-muted-foreground/40 text-center italic"
                    >
                      {msg.text}
                    </p>
                  ) : msg.role === "ai" ? (
                    <div key={msg.id} className="text-sm text-foreground">
                      <Streamdown isAnimating={streamingMsgIdRef.current === msg.id}>{msg.text}</Streamdown>
                    </div>
                  ) : (
                    <div key={msg.id} className="flex justify-end">
                      <p className="text-sm text-foreground bg-user-bubble rounded-xl px-3 py-2 max-w-[85%]">
                        {msg.text}
                      </p>
                    </div>
                  )
                )}
                {isAiLoading && !isStreaming && (
                  <div className="py-1">
                    <div className="inline-flex items-center gap-2 px-1 py-1">
                      <PixelLEDIcon size={16} mode="thinking" />
                      <span className="text-xs text-muted-foreground">thinking...</span>
                    </div>
                  </div>
                )}
                {aiError && (
                  <p className="text-sm text-red-400">
                    {aiError}
                  </p>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          </div>

          {/* Input */}
          <div className="px-4 py-3">
            <div className="rounded-2xl bg-input-surface pl-3 pr-2 pt-3 pb-2 border border-border focus-within:border-transparent ring-2 ring-transparent focus-within:ring-[#4481D8] transition-colors">
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={chatValue}
                onChange={(e) => setChatValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={3}
                disabled={isAiLoading}
                placeholder={isAiLoading ? "Waiting for AI..." : "Talk to AI..."}
                className="w-full bg-transparent text-sm placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50 resize-none"
              />
              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-1">
                  <button
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted-foreground/10 transition-colors cursor-pointer"
                  >
                    <Plus className="h-4 w-4" strokeWidth={3} />
                  </button>
                  <button
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted-foreground/10 transition-colors cursor-pointer"
                  >
                    <Settings2 className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
                <button
                  onClick={sendMessage}
                  disabled={isAiLoading}
                  className={cn(
                    "shrink-0 rounded-lg p-1.5 transition-colors cursor-pointer",
                    chatValue.trim() && !isAiLoading
                      ? "bg-[#4481D8] text-white hover:brightness-110"
                      : "bg-accent text-muted-foreground"
                  )}
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating chat bubble (only in floating mode when closed) */}
      {!chatOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => {
              setChatOpen(true);
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            className={cn(
              "h-12 w-12 rounded-2xl border border-border/60 bg-muted/90 backdrop-blur-sm",
              "flex items-center justify-center",
              "text-ai hover:text-foreground hover:bg-ai/15",
              "transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl hover:scale-105"
            )}
          >
            <PixelLEDIcon
              size={20}
              mode={isAiLoading ? (isStreaming ? "streaming" : "thinking") : "idle"}
            />
          </button>
        </div>
      )}
      {/* Context editor modal */}
      {editingContextIndex !== null && goal.context[editingContextIndex] !== undefined && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-8">
          <div
            className="absolute inset-0 bg-background/60"
            onClick={() => setEditingContextIndex(null)}
          />
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-muted shadow-2xl p-6">
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                onClick={() => {
                  const idx = editingContextIndex!;
                  setEditingContextIndex(null);
                  removeContext(idx);
                }}
                className="text-muted-foreground/40 hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setEditingContextIndex(null)}
                className="text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <WysiwygEditor
              value={goal.context[editingContextIndex]}
              onChange={(val) => {
                const updated = [...goal.context];
                updated[editingContextIndex!] = val;
                onUpdate({ context: updated });
              }}
              placeholder="Write context..."
              className="text-sm text-foreground min-h-[300px] pr-10"
            />
          </div>
        </div>
      )}
    </div>
  );
}
