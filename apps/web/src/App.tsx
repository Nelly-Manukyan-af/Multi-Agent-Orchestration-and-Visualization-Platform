import { useState, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';
import type { AgentRecord, AgentSelection } from '@agent-platform/shared';
import { minTurnLimit as minTurnLimitFor, DEFAULT_TURN_LIMIT } from '@agent-platform/shared';
import { STATUS_COLOR } from './status.ts';
import { API_BASE } from './api.ts';
import { useRun } from './useRun.ts';
import { AgentNode } from './components/AgentNode.tsx';
import { MessageLog } from './components/MessageLog.tsx';
import { PastRuns } from './components/PastRuns.tsx';
import { AgentModal } from './components/AgentModal.tsx';

const POSITIONS: Record<string, { x: number; y: number }> = {
  pro: { x: 60, y: 50 },
  con: { x: 440, y: 50 },
  judge: { x: 250, y: 280 },
};

const DEFAULT_LABELS: Record<string, string> = {
  pro: "Pro Agent",
  con: "Con Agent",
  judge: "Judge",
};

const ROLE_PICKERS: {
  key: keyof AgentSelection;
  roleLabel: string;
  defaultLabel: string;
  color: string;
}[] = [
  { key: "proId", roleLabel: "Pro", defaultLabel: "Default Pro", color: "#93c5fd" },
  { key: "conId", roleLabel: "Con", defaultLabel: "Default Con", color: "#fca5a5" },
  { key: "judgeId", roleLabel: "Judge", defaultLabel: "Default Judge", color: "#fef08a" },
];

const initialNodes: Node[] = Object.keys(POSITIONS).map((id) => ({
  id,
  type: "agent",
  position: { ...POSITIONS[id] },
  data: {
    label: DEFAULT_LABELS[id] ?? id.toUpperCase(),
    agentId: id,
    status: "idle",
    liveText: "",
    tokens: 0,
    activeTool: null,
  },
}));

const ROUNDS = 3;

function App() {
  const [topic, setTopic] = useState("Remote work is better than office work");
  const { state, isRunning, isStarting, start, stop, replay, returnToLive } = useRun();
  const [viewingRunId, setViewingRunId] = useState<string | null>(null);
  const [liveRunId, setLiveRunId] = useState<string | null>(null);
  const [turnLimit, setTurnLimit] = useState(DEFAULT_TURN_LIMIT);
  const [startError, setStartError] = useState<string | null>(null);
  const minTurnLimit = minTurnLimitFor("group_discussion", { rounds: ROUNDS, debaters: 2 });
  const preflightError = !topic.trim()
    ? "Enter a task."
    : !Number.isInteger(turnLimit) || turnLimit < 1 || turnLimit > 50
    ? "Turn Limit must be 1–50."
    : turnLimit < minTurnLimit
    ? `Turn Limit must be at least ${minTurnLimit} for ${ROUNDS} rounds.`
    : null;

  // Custom agent configuration & modal state
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [savedAgents, setSavedAgents] = useState<AgentRecord[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>(["qwen3:8b"]);
  const [selectedAgents, setSelectedAgents] = useState<AgentSelection>({
    proId: "",
    conId: "",
    judgeId: "",
  });

  // Controlled React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Edge animation & interaction states
  const [hoveredEdge, setHoveredEdge] = useState<{ from: string; to: string } | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const nodeTypes = useMemo(() => ({ agent: AgentNode }), []);

  // Fetch agents and models on load
  const loadAgentsAndModels = async () => {
    try {
      const [agentsRes, modelsRes] = await Promise.all([
        fetch(`${API_BASE}/agents`),
        fetch(`${API_BASE}/models`),
      ]);
      if (agentsRes.ok) {
        const data: AgentRecord[] = await agentsRes.json();
        setSavedAgents(data);
        const validIds = new Set(data.map((a) => a.id));
        setSelectedAgents((prev) => ({
          proId: prev.proId && !validIds.has(prev.proId) ? "" : prev.proId,
          conId: prev.conId && !validIds.has(prev.conId) ? "" : prev.conId,
          judgeId: prev.judgeId && !validIds.has(prev.judgeId) ? "" : prev.judgeId,
        }));
      }
      if (modelsRes.ok) {
        const data = await modelsRes.json();
        setAvailableModels(data);
      }
    } catch (err) {
      console.error("Failed to load agents/models:", err);
    }
  };

  useEffect(() => {
    loadAgentsAndModels();
  }, []);

  // Compute active agent labels based on live selection
  const activeLabels = useMemo(() => {
    const proAgent = savedAgents.find((a) => a.id === selectedAgents.proId);
    const conAgent = savedAgents.find((a) => a.id === selectedAgents.conId);
    const judgeAgent = savedAgents.find((a) => a.id === selectedAgents.judgeId);

    return {
      pro: proAgent ? proAgent.name : DEFAULT_LABELS.pro,
      con: conAgent ? conAgent.name : DEFAULT_LABELS.con,
      judge: judgeAgent ? judgeAgent.name : DEFAULT_LABELS.judge,
    };
  }, [savedAgents, selectedAgents]);

  // Update node data without blowing away node measurements or positions
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        const agent = state.agents[node.id];
        const fallbackLabel = DEFAULT_LABELS[node.id] ?? node.id.toUpperCase();
        const label = viewingRunId
          ? agent?.name ?? fallbackLabel
          : state.status !== "idle"
          ? agent?.name ?? activeLabels[node.id as keyof typeof activeLabels] ?? fallbackLabel
          : activeLabels[node.id as keyof typeof activeLabels] ?? fallbackLabel;

        return {
          ...node,
          data: {
            ...node.data,
            label,
            agentId: node.id,
            status: agent?.status ?? "idle",
            liveText: agent?.liveText ?? "",
            tokens: agent?.tokens ?? 0,
            activeTool: agent?.activeTool ?? null,
          },
        };
      })
    );
  }, [state.agents, state.status, viewingRunId, activeLabels, setNodes]);

  // Edge glow for 1.5 s when a Message is delivered: a visual effect only, not state (FR6.2)
  const lastMessage = state.messages.at(-1);
  const [glowExpiredSeq, setGlowExpiredSeq] = useState(0);
  useEffect(() => {
    if (!lastMessage) return;
    const timer = setTimeout(() => setGlowExpiredSeq(lastMessage.seq), 1500);
    return () => clearTimeout(timer);
  }, [lastMessage]);
  const animatingEdge = useMemo(
    () =>
      lastMessage && lastMessage.seq !== glowExpiredSeq && lastMessage.to.length > 0
        ? { from: lastMessage.from, to: lastMessage.to[0] }
        : null,
    [lastMessage, glowExpiredSeq],
  );

  const handleStart = async () => {
    if (preflightError || isStarting || isRunning) return;
    setViewingRunId(null);
    setSelectedMessageId(null);
    setStartError(null);
    try {
      const runId = await start({
        task: topic.trim(),
        turnLimit,
        rounds: ROUNDS,
        proId: selectedAgents.proId || undefined,
        conId: selectedAgents.conId || undefined,
        judgeId: selectedAgents.judgeId || undefined,
      });
      if (runId) setLiveRunId(runId);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSelectRun = async (runId: string) => {
    setViewingRunId(runId);
    setSelectedMessageId(null);
    try {
      await replay(runId);
    } catch (err) {
      console.error("Failed to load past run events:", err);
    }
  };

  const handleBackToLive = () => {
    setViewingRunId(null);
    setSelectedMessageId(null);
    returnToLive(liveRunId);
  };

  // Selected message details for edge highlighting
  const selectedMessage = useMemo(() => {
    return state.messages.find((m) => String(m.seq) === selectedMessageId);
  }, [state.messages, selectedMessageId]);

  // Build React Flow edges with explicit sourceHandle and targetHandle
  const computedEdges: Edge[] = useMemo(() => {
    const pairCounts: Record<string, { from: string; to: string; count: number }> = {};

    // Each recipient gets one edge; a final answer (to = []) has no edge (FR6.2).
    for (const msg of state.messages) {
      for (const to of msg.to) {
        const pair = `${msg.from}->${to}`;
        pairCounts[pair] = { from: msg.from, to, count: (pairCounts[pair]?.count ?? 0) + 1 };
      }
    }

    return Object.entries(pairCounts).map(([pairKey, { from, to, count }]) => {
      const isLiveTransmitting = animatingEdge?.from === from && animatingEdge?.to === to;
      const isHovered = hoveredEdge?.from === from && hoveredEdge?.to === to;
      const isSelected = selectedMessage?.from === from && selectedMessage.to.includes(to);

      const isHighlighted = isLiveTransmitting || isHovered || isSelected;

      let sourceHandle = "source-bottom";
      let targetHandle = "target-top";

      if (from === "pro" && to === "con") {
        sourceHandle = "source-right";
        targetHandle = "target-left";
      } else if (from === "con" && to === "pro") {
        sourceHandle = "source-left";
        targetHandle = "target-right";
      } else if (from === "judge") {
        sourceHandle = "source-top";
        targetHandle = "target-bottom";
      }

      return {
        id: pairKey,
        source: from,
        target: to,
        sourceHandle,
        targetHandle,
        animated: isLiveTransmitting || isHovered,
        label: `${count} msg${count > 1 ? "s" : ""}`,
        labelStyle: {
          fill: isHighlighted ? "#38bdf8" : "#94a3b8",
          fontWeight: isHighlighted ? 700 : 500,
          fontSize: 11,
        },
        labelBgStyle: { fill: "#0f172a", fillOpacity: 0.85 },
        style: {
          stroke: isHighlighted ? "#38bdf8" : "#475569",
          strokeWidth: isHighlighted ? 3 : 1.5,
          transition: "all 0.25s ease",
        },
      };
    });
  }, [state.messages, animatingEdge, hoveredEdge, selectedMessage]);

  // Sync computed edges into React Flow state
  useEffect(() => {
    setEdges(computedEdges);
  }, [computedEdges, setEdges]);

  // Handle clicking an edge in the graph -> selects matching message in log
  const handleEdgeClick = (_event: React.MouseEvent, edge: Edge) => {
    const matchingMsg = [...state.messages]
      .reverse()
      .find((m) => m.from === edge.source && m.to.includes(edge.target));
    if (matchingMsg) {
      setSelectedMessageId(String(matchingMsg.seq));
    }
  };

  // Calculate total tokens across all agents
  const totalTokens = useMemo(() => {
    return Object.values(state.agents).reduce((acc, a) => acc + (a.tokens || 0), 0);
  }, [state.agents]);

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "#0f172a",
      color: "#f8fafc",
      overflow: "hidden",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Top Header & Controls */}
      <header style={{
        padding: "12px 24px",
        background: "#1e293b",
        borderBottom: "1px solid #334155",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        zIndex: 10
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#fff" }}>
              Agent Platform · Live Graph & Message Log
            </h1>
            <p style={{ margin: "2px 0 0", color: "#94a3b8", fontSize: "0.8rem" }}>
              {viewingRunId ? (
                <span style={{ color: "#38bdf8", fontWeight: 600 }}>Viewing Past Run ({viewingRunId.slice(0, 8)}...)</span>
              ) : (
                "Interactive multi-agent conversation tracing with state reducer"
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "0.85rem", color: "#94a3b8" }}>
            <div>
              Status: <span style={{
                fontWeight: 700,
                color: STATUS_COLOR[state.status] ?? "#94a3b8"
              }} title={state.reason ?? undefined}>{state.status.toUpperCase()}</span>
              {state.reason && state.status !== "completed" && (
                <span style={{ marginLeft: 6, color: "#cbd5e1" }}>— {state.reason}</span>
              )}
            </div>
            <div>
              Total Tokens: <strong style={{ color: "#f8fafc" }}>{totalTokens}</strong>
            </div>
            <div>
              Events: <strong style={{ color: "#f8fafc" }}>{state.lastSeq}</strong>
            </div>
            <button
              onClick={() => setIsAgentModalOpen(true)}
              style={{
                background: "#334155",
                color: "#f8fafc",
                border: "1px solid #475569",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ⚙ Manage Agents ({savedAgents.length})
            </button>
          </div>
        </div>

        {/* Debate Topic & Agent Role Pickers */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter debate topic..."
            disabled={isRunning || isStarting}
            style={{
              flex: 2,
              background: "#0f172a",
              border: "1px solid #334155",
              color: "#f8fafc",
              padding: "8px 12px",
              borderRadius: "6px",
              fontSize: "0.85rem"
            }}
          />

          {ROLE_PICKERS.map(({ key, roleLabel, defaultLabel, color }) => (
            <select
              key={key}
              value={selectedAgents[key] ?? ""}
              onChange={(e) =>
                setSelectedAgents((prev) => ({ ...prev, [key]: e.target.value }))
              }
              disabled={isRunning || isStarting}
              style={{
                flex: 1,
                background: "#0f172a",
                border: "1px solid #334155",
                color,
                padding: "8px 10px",
                borderRadius: "6px",
                fontSize: "0.82rem",
              }}
            >
              <option value="">
                {roleLabel}: {defaultLabel}
              </option>
              {savedAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {roleLabel}: {a.name} ({a.model})
                </option>
              ))}
            </select>
          ))}

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
            Turn Limit
            <input
              type="number"
              min={1}
              max={50}
              value={Number.isNaN(turnLimit) ? "" : turnLimit}
              onChange={(e) => setTurnLimit(e.target.valueAsNumber)}
              disabled={isRunning || isStarting}
              style={{
                width: 56,
                background: "#0f172a",
                border: "1px solid #334155",
                color: "#f8fafc",
                padding: "7px 8px",
                borderRadius: "6px",
                fontSize: "0.82rem",
              }}
            />
          </label>

          {isRunning ? (
            <button
              onClick={() => void stop()}
              style={{
                background: "#ef4444",
                color: "#fff",
                fontWeight: 600,
                border: "none",
                borderRadius: "6px",
                padding: "8px 18px",
                cursor: "pointer",
                fontSize: "0.85rem",
                whiteSpace: "nowrap"
              }}
            >
              ■ Stop
            </button>
          ) : (
            <button
              onClick={() => void handleStart()}
              disabled={isStarting || preflightError !== null}
              title={preflightError ?? undefined}
              style={{
                background: isStarting || preflightError ? "#334155" : "#38bdf8",
                color: isStarting || preflightError ? "#94a3b8" : "#0f172a",
                fontWeight: 600,
                border: "none",
                borderRadius: "6px",
                padding: "8px 18px",
                cursor: isStarting || preflightError ? "not-allowed" : "pointer",
                fontSize: "0.85rem",
                transition: "opacity 0.2s",
                whiteSpace: "nowrap"
              }}
            >
              {isStarting ? "Starting…" : "Start Run"}
            </button>
          )}
        </div>
        {(startError || (preflightError && !isRunning)) && (
          <div style={{ fontSize: "0.78rem", color: "#fca5a5" }}>{startError ?? preflightError}</div>
        )}
      </header>

      {/* Main Content Area: Split View (Graph + Message Log) */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: React Flow Graph Canvas */}
        <div style={{ flex: 1, height: "100%", position: "relative" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onEdgeClick={handleEdgeClick}
            fitView
            fitViewOptions={{ padding: 0.25 }}
          >
            <Background color="#334155" gap={20} size={1.5} />
            <Controls style={{ background: "#1e293b", border: "#334155", fill: "#f8fafc" }} />
          </ReactFlow>
        </div>

        {/* Right: Message Log Sidebar */}
        <MessageLog
          messages={state.messages}
          agentNames={Object.fromEntries(Object.values(state.agents).map((a) => [a.id, a.name]))}
          turns={state.turns}
          activeEdge={animatingEdge}
          selectedMessageId={selectedMessageId}
          onSelectMessage={setSelectedMessageId}
          onHoverEdge={setHoveredEdge}
        />
      </div>

      {/* Bottom: Past Runs History Panel */}
      <PastRuns
        currentViewingRunId={viewingRunId}
        onSelectRun={handleSelectRun}
        onBackToLive={handleBackToLive}
        isLive={isRunning || isStarting}
      />

      {/* Custom Agent Management Modal */}
      <AgentModal
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
        agents={savedAgents}
        models={availableModels}
        onAgentCreated={loadAgentsAndModels}
        onAgentDeleted={loadAgentsAndModels}
      />
    </div>
  );
}

export default App;
