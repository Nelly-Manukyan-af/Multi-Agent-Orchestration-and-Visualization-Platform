// Pre-flight rules shared by the run form and the server (FR4.1).

export const TURN_LIMIT_MIN = 1;
export const TURN_LIMIT_MAX = 50;
export const DEFAULT_TURN_LIMIT = 10;

/** Smallest Turn Limit that lets the pattern finish normally (FR4.1 #6). */
export function minTurnLimit(
  pattern: "sequential" | "manager_workers" | "group_discussion",
  opts: { agents?: number; rounds?: number; debaters?: number },
): number {
  switch (pattern) {
    case "sequential":
      return opts.agents ?? 1;
    case "group_discussion":
      return (opts.rounds ?? 1) * (opts.debaters ?? 2) + 1;
    case "manager_workers":
      return 1; // a Manager may legitimately answer in one Turn
  }
}
