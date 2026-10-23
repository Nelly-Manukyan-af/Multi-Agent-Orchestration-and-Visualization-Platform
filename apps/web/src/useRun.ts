import { useState, useMemo, useRef } from "react";
import type { AgentEvent } from "@agent-platform/shared";
import { applyEvent, initialState, type RunState } from "./runState.ts";

export interface AgentSelection {
  proId?: string;
  conId?: string;
  judgeId?: string;
}

export function useRun() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Derive the current state from the raw event stream
  const state: RunState = useMemo(() => {
    return events.reduce(applyEvent, initialState);
  }, [events]);

  function start(topic: string, agents?: AgentSelection) {
    setEvents([]);
    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "start_run",
          topic,
          proId: agents?.proId || undefined,
          conId: agents?.conId || undefined,
          judgeId: agents?.judgeId || undefined,
        })
      );
    };

    ws.onmessage = (msg) => {
      const event: AgentEvent = JSON.parse(msg.data);
      setEvents((old) => [...old, event]);
    };
  }

  function loadEvents(pastEvents: AgentEvent[]) {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setEvents(pastEvents);
  }

  return { events, state, start, loadEvents };
}
