// in apps/server/src/events.ts
import type { AgentEvent } from "@agent-platform/shared";

// A type helper: "an AgentEvent without id, runId and timestamp"
type NewEvent = DistributiveOmit<AgentEvent, "id" | "runId" | "timestamp">;
type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;

export function makeEvent(runId: string, event: NewEvent): AgentEvent {
    return { ...event, id: crypto.randomUUID(), runId, timestamp: Date.now() } as AgentEvent;
}