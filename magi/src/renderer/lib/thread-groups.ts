import type { ChatThread } from "./chat-threads";

export interface ThreadGroup {
  label: string;
  threads: ChatThread[];
}

const DAY_MS = 86_400_000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function groupThreadsByDate(threads: ChatThread[], now = new Date()): ThreadGroup[] {
  if (threads.length === 0) return [];

  const todayStart = startOfDay(now).getTime();
  const yesterdayStart = todayStart - DAY_MS;
  const prev7Start = todayStart - 7 * DAY_MS;
  const prev30Start = todayStart - 30 * DAY_MS;

  const buckets = new Map<string, ChatThread[]>();
  const bucketOrder: string[] = [];

  function addToBucket(label: string, thread: ChatThread) {
    let bucket = buckets.get(label);
    if (!bucket) {
      bucket = [];
      buckets.set(label, bucket);
      bucketOrder.push(label);
    }
    bucket.push(thread);
  }

  for (const thread of threads) {
    const updatedMs = new Date(thread.updatedAt).getTime();

    if (updatedMs >= todayStart) {
      addToBucket("Today", thread);
    } else if (updatedMs >= yesterdayStart) {
      addToBucket("Yesterday", thread);
    } else if (updatedMs >= prev7Start) {
      addToBucket("Previous 7 Days", thread);
    } else if (updatedMs >= prev30Start) {
      addToBucket("Previous 30 Days", thread);
    } else {
      const date = new Date(thread.updatedAt);
      const monthLabel = `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
      addToBucket(monthLabel, thread);
    }
  }

  // Fixed order for the standard buckets, then chronological months
  const fixedOrder = ["Today", "Yesterday", "Previous 7 Days", "Previous 30 Days"];
  const groups: ThreadGroup[] = [];

  for (const label of fixedOrder) {
    const bucket = buckets.get(label);
    if (bucket) groups.push({ label, threads: bucket });
  }

  // Month buckets appear in the order they were inserted (most recent first,
  // since threads are pre-sorted by updatedAt desc)
  for (const label of bucketOrder) {
    if (!fixedOrder.includes(label)) {
      groups.push({ label, threads: buckets.get(label)! });
    }
  }

  return groups;
}
