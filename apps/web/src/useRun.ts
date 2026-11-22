import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  applyEvent,
  initialState,
  isFinal,
  reduceEvents,
  type AgentEvent,
  type RunState,
  type ServerMessage,
  type StartRunRequest,
} from "@agent-platform/shared";
import { API_BASE, wsUrl } from "./api.ts";

type Action = { type: "reset"; events: AgentEvent[] } | { type: "event"; event: AgentEvent };

// Same reducer for live, reconnect and replay (§6.1 #3). Events are applied
// strictly in seq order; duplicates and out-of-order events are ignored here
// and the gap is re-requested by the socket handler.
function storeReducer(state: RunState, action: Action): RunState {
  if (action.type === "reset") return reduceEvents(action.events);
  if (action.event.seq !== state.lastSeq + 1) return state;
  return applyEvent(state, action.event);
}

const RECONNECT_MS = 1000;

export function useRun() {
  const [state, dispatch] = useReducer(storeReducer, initialState);
  const [viewingRunId, setViewingRunId] = useState<string | null>(null);
  const mode = viewingRunId === null ? "live" : "replay";
  const [isStarting, setIsStarting] = useState(false);
  const startingRef = useRef(false);
  const requestVersionRef = useRef(0);

  const wsRef = useRef<WebSocket | null>(null);
  const runIdRef = useRef<string | null>(null);
  const lastLiveRunIdRef = useRef<string | null>(null);
  const lastSeqRef = useRef(0);
  const finishedRef = useRef(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<(runId: string) => void>(() => {});

  const closeSocket = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = null;
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  }, []);

  // FR7.3: subscribe { runId, afterSeq }; on drop, reconnect from the last applied seq.
  const connect = useCallback(
    (runId: string) => {
      closeSocket();
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;

      const subscribe = () =>
        ws.send(JSON.stringify({ type: "subscribe", runId, afterSeq: lastSeqRef.current }));

      ws.onopen = subscribe;

      ws.onmessage = (msg) => {
        if (wsRef.current !== ws) return;
        const data = JSON.parse(msg.data) as ServerMessage;
        if (data.type === "error") {
          console.error(data.message);
          return;
        }
        const event = data.event;
        if (event.runId !== runIdRef.current) return;
        if (event.seq <= lastSeqRef.current) return; // already applied
        if (event.seq > lastSeqRef.current + 1) {
          subscribe(); // gap: request the missing range again
          return;
        }
        lastSeqRef.current = event.seq;
        dispatch({ type: "event", event });
        if (event.type === "run_started") {
          startingRef.current = false;
          setIsStarting(false);
        }
        if (event.type === "run_finished") {
          finishedRef.current = true;
          closeSocket();
        }
      };

      ws.onclose = () => {
        if (finishedRef.current || runIdRef.current !== runId) return;
        reconnectTimer.current = setTimeout(() => connectRef.current(runId), RECONNECT_MS);
      };
    },
    [closeSocket],
  );
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const follow = useCallback(
    (runId: string) => {
      runIdRef.current = runId;
      lastSeqRef.current = 0; // a fresh view starts from seq 0
      finishedRef.current = false;
      dispatch({ type: "reset", events: [] });
      setViewingRunId(null);
      connect(runId);
    },
    [connect],
  );

  async function start(request: StartRunRequest): Promise<string | null> {
    if (startingRef.current || (mode === "live" && state.status === "running")) return null;
    startingRef.current = true;
    setIsStarting(true);
    const version = ++requestVersionRef.current;
    closeSocket();
    runIdRef.current = null;
    try {
      const res = await fetch(`${API_BASE}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const body = await res.json();
      if (version !== requestVersionRef.current) return null;
      if (!res.ok) throw new Error(body.error ?? `Failed to start run (${res.status})`);
      lastLiveRunIdRef.current = body.runId;
      follow(body.runId);
      return body.runId;
    } catch (err) {
      if (version !== requestVersionRef.current) return null;
      startingRef.current = false;
      setIsStarting(false);
      throw err;
    }
  }

  async function stop(): Promise<void> {
    if (!runIdRef.current) return;
    await fetch(`${API_BASE}/runs/${runIdRef.current}/stop`, { method: "POST" });
  }

  /** Replay a stored run (no live part). */
  async function replay(runId: string): Promise<void> {
    const version = ++requestVersionRef.current;
    startingRef.current = false;
    setIsStarting(false);
    closeSocket();
    runIdRef.current = null;
    const res = await fetch(`${API_BASE}/runs/${runId}/events`);
    if (version !== requestVersionRef.current) return;
    if (!res.ok) throw new Error(`Failed to load run (${res.status})`);
    const events = (await res.json()) as AgentEvent[];
    if (version !== requestVersionRef.current) return;
    setViewingRunId(runId);
    dispatch({ type: "reset", events });
  }

  /** Leave replay and show the live run again, if one is being followed. */
  function returnToLive() {
    requestVersionRef.current += 1;
    startingRef.current = false;
    setIsStarting(false);
    if (lastLiveRunIdRef.current) follow(lastLiveRunIdRef.current);
    else {
      setViewingRunId(null);
      dispatch({ type: "reset", events: [] });
    }
  }

  useEffect(() => closeSocket, [closeSocket]);

  return {
    state,
    mode,
    viewingRunId,
    isStarting,
    isRunning: mode === "live" && state.status === "running",
    isFinished: isFinal(state.status),
    start,
    stop,
    replay,
    returnToLive,
  };
}
