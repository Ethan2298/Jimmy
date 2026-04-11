import { useState, useRef, useEffect } from "react";
import { Plus, MoreHorizontal, Trash2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Goal } from "../App";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
} from "./ui/sidebar";

function GoalCardBody({ goal, goals }: { goal: Goal; goals: Goal[] }) {
  const idx = goals.indexOf(goal);
  const offsets = [-2, 1, 5, 10, 21];
  const daysFromNow = offsets[idx % offsets.length];
  const dueDate = new Date(Date.now() + daysFromNow * 86400000);
  const daysLeft = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
  const iconColor = daysLeft <= 0
    ? "text-red-400"
    : daysLeft <= 3
      ? "text-red-400"
      : daysLeft <= 7
        ? "text-amber-400"
        : "text-muted-foreground";

  return (
    <>
      <span className="text-sm font-medium line-clamp-2 pr-5">{goal.title}</span>
      <div className="flex items-center gap-1 mt-2">
        <Calendar className={cn("w-3.5 h-3.5", iconColor)} />
        <span className="text-[10px] font-normal text-muted-foreground/40">
          {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>
    </>
  );
}

function SortableGoalCard({
  goal,
  goals,
  isActive,
  onSelect,
  onRequestDelete,
}: {
  goal: Goal;
  goals: Goal[];
  isActive: boolean;
  onSelect: () => void;
  onRequestDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: goal.id });

  const cardRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!isDragging && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      sizeRef.current = { width: rect.width, height: rect.height };
    }
  });

  const style = {
    transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("group mb-1.5", isDragging && "overflow-hidden")}
      {...(isDragging ? {} : { ...attributes, ...listeners })}
    >
      {isDragging ? (
        <div
          className="rounded-sm border border-dashed border-border/60 bg-transparent"
          style={sizeRef.current ? { width: sizeRef.current.width, height: sizeRef.current.height } : undefined}
        />
      ) : (
        <div
          ref={cardRef}
          onClick={onSelect}
          className={cn(
            "relative w-full text-left flex flex-col px-3 py-2.5 rounded-sm border transition-colors overflow-hidden cursor-pointer",
            isActive
              ? "border-border bg-card shadow-xs"
              : "border-border/50 bg-card hover:border-border hover:bg-card-hover shadow-xs"
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "absolute top-1.5 right-1.5 p-1 rounded-md z-10",
                  "opacity-0 group-hover:opacity-100",
                  "text-muted-foreground hover:text-foreground hover:bg-border/50",
                  "transition-all cursor-pointer"
                )}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right">
              <DropdownMenuItem
                destructive
                onClick={onRequestDelete}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <GoalCardBody goal={goal} goals={goals} />
        </div>
      )}
    </div>
  );
}

export function GoalsSidebar({
  collapsed,
  activeGoalId,
  goals,
  onSelectGoal,
  onAddGoal,
  onDeleteGoal,
  onReorderGoals,
}: {
  collapsed: boolean;
  activeGoalId: string | null;
  goals: Goal[];
  onSelectGoal: (id: string) => void;
  onAddGoal: (title: string) => void;
  onDeleteGoal: (id: string) => void;
  onReorderGoals: (orderedIds: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  function submitNew() {
    const title = newTitle.trim();
    if (!title) {
      setAdding(false);
      setNewTitle("");
      return;
    }
    onAddGoal(title);
    setNewTitle("");
    setAdding(false);
  }

  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (activeId) {
      document.body.style.cursor = "grabbing";
      return () => { document.body.style.cursor = ""; };
    }
  }, [activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = goals.map((o) => o.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    const newIds = [...ids];
    newIds.splice(oldIndex, 1);
    newIds.splice(newIndex, 0, active.id as string);
    onReorderGoals(newIds);
  }

  const activeGoal = activeId ? goals.find((o) => o.id === activeId) : null;

  const canDelete = deleteTarget && deleteConfirm === deleteTarget.title;

  return (
    <>
      <Sidebar collapsed={collapsed} className="bg-background border-r border-border group/sidebar overflow-hidden">
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <span className="text-xs font-medium text-muted-foreground/60">Goals</span>
          <span className="text-xs text-muted-foreground/40">{goals.length}</span>
        </div>
        <SidebarContent>
          <SidebarGroup>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              accessibility={{ screenReaderInstructions: { draggable: "" } }}
            >
              <SortableContext
                items={goals.map((o) => o.id)}
                strategy={verticalListSortingStrategy}
              >
                {goals.map((goal) => (
                  <SortableGoalCard
                    key={goal.id}
                    goal={goal}
                    goals={goals}
                    isActive={activeGoalId === goal.id}
                    onSelect={() => onSelectGoal(goal.id)}
                    onRequestDelete={() => {
                      setDeleteTarget(goal);
                      setDeleteConfirm("");
                    }}
                  />
                ))}
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeGoal && (
                  <div className="relative text-left flex flex-col px-3 py-2.5 rounded-sm border border-border bg-card shadow-lg overflow-hidden cursor-grabbing">
                    <div className="absolute top-1.5 right-1.5 p-1 rounded-md text-muted-foreground">
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </div>
                    <GoalCardBody goal={activeGoal} goals={goals} />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
            {adding ? (
              <div className="mb-1.5">
                <div className="w-full px-3 py-2.5 rounded-sm border border-border bg-card">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitNew();
                      if (e.key === "Escape") {
                        setAdding(false);
                        setNewTitle("");
                      }
                    }}
                    onBlur={submitNew}
                    placeholder="Goal title..."
                    className={cn(
                      "w-full bg-transparent text-sm text-foreground",
                      "placeholder:text-muted-foreground/40",
                      "focus:outline-none"
                    )}
                  />
                </div>
              </div>
            ) : goals.length > 0 && (
              <button
                onClick={() => setAdding(true)}
                className={cn(
                  "w-full flex items-center justify-center py-1 rounded-sm border border-dashed border-border/60 bg-[var(--color-subtle-tint)]",
                  "text-muted-foreground hover:text-foreground hover:border-border hover:bg-card",
                  "opacity-0 group-hover/sidebar:opacity-100",
                  "transition-all cursor-pointer"
                )}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteConfirm("");
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Delete goal</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Type the goal name to confirm.
          </DialogDescription>

          <div className="mt-4">
            <p className="text-sm font-medium mb-2 select-all">{deleteTarget?.title}</p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canDelete) {
                  onDeleteGoal(deleteTarget!.id);
                  setDeleteTarget(null);
                  setDeleteConfirm("");
                }
              }}
              placeholder="Type the goal name..."
              className={cn(
                "w-full rounded-md border bg-transparent px-3 py-2 text-sm",
                "placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-border"
              )}
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => {
                setDeleteTarget(null);
                setDeleteConfirm("");
              }}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={!canDelete}
              onClick={() => {
                if (canDelete) {
                  onDeleteGoal(deleteTarget!.id);
                  setDeleteTarget(null);
                  setDeleteConfirm("");
                }
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                canDelete
                  ? "bg-red-500 text-white hover:bg-red-600 cursor-pointer"
                  : "bg-red-500/20 text-red-400/40 cursor-not-allowed"
              )}
            >
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
