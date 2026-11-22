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
const nodeTypes = { agent: AgentNode };

function App() {
  const [topic, setTopic] = useState("Remote work is better than office work");
  const { state, viewingRunId, isRunning, isStarting, start, stop, replay, returnToLive } = useRun();
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
    setSelectedMessageId(null);
    setStartError(null);
    try {
      await start({
        task: topic.trim(),
        turnLimit,
        rounds: ROUNDS,
        proId: selectedAgents.proId || undefined,
        conId: selectedAgents.conId || undefined,
        judgeId: selectedAgents.judgeId || undefined,
      });
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSelectRun = async (runId: string) => {
    setSelectedMessageId(null);
    try {
      await replay(runId);
    } catch (err) {
      console.error("Failed to load past run events:", err);
    }
  };

  const handleBackToLive = () => {
    setSelectedMessageId(null);
    returnToLive();
  };

  // Selected message details for edge highlighting
  const selectedMessage = useMemo(() => {
    return state.messages.find((m) => String(m.seq) === selectedMessageId);
  }, [state.messages, selectedMessageId]);

  // Build React Flow edges with explicit sourceHandle and targetHandle
  useEffect(() => {
    const pairCounts: Record<string, { from: string; to: string; count: number }> = {};

    // Each recipient gets one edge; a final answer (to = []) has no edge (FR6.2).
    for (const msg of state.messages) {
      for (const to of msg.to) {
        const pair = `${msg.from}->${to}`;
        pairCounts[pair] = { from: msg.from, to, count: (pairCounts[pair]?.count ?? 0) + 1 };
      }
    }

    setEdges(Object.entries(pairCounts).map(([pairKey, { from, to, count }]) => {
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
    }));
  }, [state.messages, animatingEdge, hoveredEdge, selectedMessage, setEdges]);

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
    <div className="app-shell">
      {/* Top Header & Controls */}
      <header className="app-header">
        <div className="app-heading-row">
          <div>
            <h1 className="app-title">
              Agent Platform · Live Graph & Message Log
            </h1>
            <p className="app-subtitle">
              {viewingRunId ? (
                <span className="app-past-run">Viewing Past Run ({viewingRunId.slice(0, 8)}...)</span>
              ) : (
                "Interactive multi-agent conversation tracing with state reducer"
              )}
            </p>
          </div>
          <div className="app-summary">
            <div>
              Status: <span className="app-status" style={{ color: STATUS_COLOR[state.status] ?? "#94a3b8" }} title={state.reason ?? undefined}>{state.status.toUpperCase()}</span>
              {state.reason && state.status !== "completed" && (
                <span className="app-status-reason">— {state.reason}</span>
              )}
            </div>
            <div>
              Total Tokens: <strong className="app-summary-value">{totalTokens}</strong>
            </div>
            <div>
              Events: <strong className="app-summary-value">{state.lastSeq}</strong>
            </div>
            <button
              onClick={() => setIsAgentModalOpen(true)}
              className="app-manage-agents"
            >
              ⚙ Manage Agents ({savedAgents.length})
            </button>
          </div>
        </div>

        {/* Debate Topic & Agent Role Pickers */}
        <div className="app-run-controls">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter debate topic..."
            disabled={isRunning || isStarting}
            className="app-topic"
          />

          {ROLE_PICKERS.map(({ key, roleLabel, defaultLabel, color }) => (
            <select
              key={key}
              value={selectedAgents[key] ?? ""}
              onChange={(e) =>
                setSelectedAgents((prev) => ({ ...prev, [key]: e.target.value }))
              }
              disabled={isRunning || isStarting}
              className="app-role-picker"
              style={{ color }}
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

          <label className="app-turn-limit">
            Turn Limit
            <input
              type="number"
              min={1}
              max={50}
              value={Number.isNaN(turnLimit) ? "" : turnLimit}
              onChange={(e) => setTurnLimit(e.target.valueAsNumber)}
              disabled={isRunning || isStarting}
              className="app-turn-limit-input"
            />
          </label>

          {isRunning ? (
            <button
              onClick={() => void stop()}
              className="app-stop"
            >
              ■ Stop
            </button>
          ) : (
            <button
              onClick={() => void handleStart()}
              disabled={isStarting || preflightError !== null}
              title={preflightError ?? undefined}
              className="app-start"
              style={{
                background: isStarting || preflightError ? "#334155" : "#38bdf8",
                color: isStarting || preflightError ? "#94a3b8" : "#0f172a",
              }}
            >
              {isStarting ? "Starting…" : "Start Run"}
            </button>
          )}
        </div>
        {(startError || (preflightError && !isRunning)) && (
          <div className="app-error">{startError ?? preflightError}</div>
        )}
      </header>

      {/* Main Content Area: Split View (Graph + Message Log) */}
      <div className="app-content">
        {/* Left: React Flow Graph Canvas */}
        <div className="app-graph">
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
            <Controls className="app-flow-controls" />
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
