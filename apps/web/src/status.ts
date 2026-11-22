import type { RunState } from "@agent-platform/shared";

export const STATUS_COLOR: Record<RunState["status"], string> = {
  idle: "#94a3b8",
  running: "#38bdf8",
  completed: "#22c55e",
  stopped: "#94a3b8",
  failed: "#ef4444",
  loop_detected: "#f59e0b",
  turn_limit_reached: "#f59e0b",
};
