import type { ThreadStatus } from "@bb/domain";
import type {
  ThreadTimelineResponse,
  TimelineConversationRow,
} from "@bb/server-contract";

export function isWorking(status: ThreadStatus | undefined) {
  return status === "active" || status === "starting" || status === "pending";
}

export function conversationRows(
  timeline: ThreadTimelineResponse | undefined,
): TimelineConversationRow[] {
  return (
    timeline?.rows.filter(
      (row): row is TimelineConversationRow => row.kind === "conversation",
    ) ?? []
  );
}

export function threadTitle(text: string) {
  return text.trim().split(/\r?\n/)[0].replace(/\s+/g, " ").slice(0, 70);
}

export function displayTime(time: number) {
  const date = new Date(time);
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  if (time >= midnight)
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  if (time >= midnight - 86400000) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
