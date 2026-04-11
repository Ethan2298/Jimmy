import {
  CalendarDays,
  Circle,
  Flag,
  MessageSquare,
  Plus,
} from "lucide-react";
import type { WorkspaceItem } from "@/lib/workspace";
import { WorkspaceDocEditor } from "./workspace-doc-editor";

interface WorkspaceItemPageProps {
  item: WorkspaceItem;
  docMarkdown?: string;
  onDocChange?: (docId: string, markdown: string) => void;
}

interface DummyTask {
  id: string;
  title: string;
  due?: string;
  priority: 1 | 2 | 3 | 4;
  comments?: number;
  subtasks?: number;
}

const DUMMY_PROJECT_TASKS: DummyTask[] = [
  { id: "t1", title: "Finalize onboarding flow copy", due: "Today", priority: 1, comments: 3 },
  { id: "t2", title: "Wire workspace selection into main view", due: "Today", priority: 2, subtasks: 2 },
  { id: "t3", title: "Review sidebar interactions", priority: 3 },
  { id: "t4", title: "Design map mode interactions", due: "Tomorrow", priority: 2, comments: 1 },
  { id: "t5", title: "Persist project view mode in DB", due: "Fri", priority: 1 },
  { id: "t6", title: "Refine keyboard shortcuts", priority: 4 },
  { id: "t7", title: "Add drag-and-drop task ordering", priority: 3 },
];

function priorityFlagClass(priority: DummyTask["priority"]): string {
  switch (priority) {
    case 1:
      return "text-[#D1453B]";
    case 2:
      return "text-[#EB8909]";
    case 3:
      return "text-[#246FE0]";
    case 4:
    default:
      return "text-[#7A7F87]";
  }
}

function TodoistTaskRow({ task }: { task: DummyTask }) {
  return (
    <li className="group flex items-start gap-3 px-2 py-2.5 rounded-[8px] hover:bg-white/[0.03]">
      <button className="mt-[1px] text-white/55 hover:text-white" title="Complete task">
        <Circle size={16} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] text-[#ECEFF3]">{task.title}</span>
          <span
            className={`inline-flex items-center ${priorityFlagClass(task.priority)}`}
            title={`Priority ${task.priority}`}
          >
            <Flag size={11} strokeWidth={2.2} />
          </span>
        </div>

        <div className="mt-1 flex items-center gap-3 text-[12px] text-white/45">
          {task.due && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={12} />
              {task.due}
            </span>
          )}
          {task.subtasks && <span>{task.subtasks} subtasks</span>}
          {task.comments && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare size={12} />
              {task.comments}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function ProjectPage() {
  return (
    <div className="h-full overflow-y-auto px-[26px] pt-5 pb-[35px]">
      <div className="mx-auto w-full max-w-[860px]">
        <div className="rounded-[14px] bg-[#171717]">
          <div className="p-2">
            <ul className="space-y-[1px]">
              {DUMMY_PROJECT_TASKS.map((task) => (
                <TodoistTaskRow key={task.id} task={task} />
              ))}
            </ul>

            <button className="mt-1 mb-2 ml-8 inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-[13px] text-[#EA6B63] hover:bg-[#EA6B63]/10">
              <Plus size={14} />
              Add task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocPage({
  docId,
  docMarkdown,
  onDocChange,
}: {
  docId: string;
  docMarkdown: string;
  onDocChange: (docId: string, markdown: string) => void;
}) {
  return (
    <div className="h-full overflow-y-auto px-[26px] pt-5 pb-[35px]">
      <div className="mx-auto w-full max-w-[704px]">
        <WorkspaceDocEditor
          docId={docId}
          value={docMarkdown}
          onChange={(markdown) => onDocChange(docId, markdown)}
        />
      </div>
    </div>
  );
}

export function WorkspaceItemPage({
  item,
  docMarkdown = "",
  onDocChange,
}: WorkspaceItemPageProps) {
  if (item.type === "project") {
    return <ProjectPage />;
  }
  if (item.type !== "doc" || !onDocChange) {
    return null;
  }
  return <DocPage docId={item.id} docMarkdown={docMarkdown} onDocChange={onDocChange} />;
}
