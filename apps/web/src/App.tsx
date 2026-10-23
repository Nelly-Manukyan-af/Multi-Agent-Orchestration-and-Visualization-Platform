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
import { useRun } from './useRun.ts';
import { AgentNode } from './components/AgentNode.tsx';
import { MessageLog } from './components/MessageLog.tsx';
import { PastRuns } from './components/PastRuns.tsx';
import { AgentModal, type AgentRecord } from './components/AgentModal.tsx';

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
  },
}));

function App() {
  const [topic, setTopic] = useState("Remote work is better than office work");
  const { events, state, start, loadEvents } = useRun();
  const [viewingRunId, setViewingRunId] = useState<string | null>(null);

  // Custom agent configuration & modal state
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [savedAgents, setSavedAgents] = useState<AgentRecord[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>(["qwen3:8b"]);
  const [selectedProId, setSelectedProId] = useState<string>("");
  const [selectedConId, setSelectedConId] = useState<string>("");
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>("");

  // Controlled React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Edge animation & interaction states
  const [animatingEdge, setAnimatingEdge] = useState<{ from: string; to: string } | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ from: string; to: string } | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const nodeTypes = useMemo(() => ({ agent: AgentNode }), []);

  // Fetch agents and models on load
  const loadAgentsAndModels = async () => {
    try {
      const [agentsRes, modelsRes] = await Promise.all([
        fetch("http://localhost:3000/agents"),
        fetch("http://localhost:3000/models"),
      ]);
      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setSavedAgents(data);
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

  // Compute active agent labels based on selection
  const activeLabels = useMemo(() => {
    const proAgent = savedAgents.find((a) => a.id === selectedProId);
    const conAgent = savedAgents.find((a) => a.id === selectedConId);
    const judgeAgent = savedAgents.find((a) => a.id === selectedJudgeId);

    return {
      pro: proAgent ? proAgent.name : "Pro Agent",
      con: conAgent ? conAgent.name : "Con Agent",
      judge: judgeAgent ? judgeAgent.name : "Judge",
    };
  }, [savedAgents, selectedProId, selectedConId, selectedJudgeId]);

  // Update node data without blowing away node measurements or positions
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        const agent = state.agents[node.id];
        return {
          ...node,
          data: {
            ...node.data,
            label: activeLabels[node.id as keyof typeof activeLabels] ?? node.id.toUpperCase(),
            agentId: node.id,
            status: agent?.status ?? "idle",
            liveText: agent?.liveText ?? "",
            tokens: agent?.tokens ?? 0,
          },
        };
      })
    );
  }, [state.agents, activeLabels, setNodes]);

  // Keep active edge animated for ~1.5s after a message arrives
  useEffect(() => {
    if (state.activeEdge) {
      setAnimatingEdge(state.activeEdge);
      const timer = setTimeout(() => {
        setAnimatingEdge(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state.activeEdge, state.messages.length]);

  const handleStart = () => {
    if (!topic.trim()) return;
    setViewingRunId(null);
    setSelectedMessageId(null);
    start(topic.trim(), {
      proId: selectedProId || undefined,
      conId: selectedConId || undefined,
      judgeId: selectedJudgeId || undefined,
    });
  };

  const handleSelectRun = async (runId: string) => {
    setViewingRunId(runId);
    setSelectedMessageId(null);
    try {
      const res = await fetch(`http://localhost:3000/runs/${runId}/events`);
      if (res.ok) {
        const pastEvents = await res.json();
        loadEvents(pastEvents);
      }
    } catch (err) {
      console.error("Failed to load past run events:", err);
    }
  };

  const handleBackToLive = () => {
    setViewingRunId(null);
    setSelectedMessageId(null);
    loadEvents([]);
  };

  // Selected message details for edge highlighting
  const selectedMessage = useMemo(() => {
    return state.messages.find((m) => m.id === selectedMessageId);
  }, [state.messages, selectedMessageId]);

  // Build React Flow edges with explicit sourceHandle and targetHandle
  const computedEdges: Edge[] = useMemo(() => {
    const pairCounts: Record<string, { from: string; to: string; count: number }> = {};

    for (const msg of state.messages) {
      if (msg.to === "all") {
        const pairPro = `${msg.from}->pro`;
        const pairCon = `${msg.from}->con`;
        pairCounts[pairPro] = { from: msg.from, to: "pro", count: (pairCounts[pairPro]?.count ?? 0) + 1 };
        pairCounts[pairCon] = { from: msg.from, to: "con", count: (pairCounts[pairCon]?.count ?? 0) + 1 };
      } else {
        const pair = `${msg.from}->${msg.to}`;
        pairCounts[pair] = { from: msg.from, to: msg.to, count: (pairCounts[pair]?.count ?? 0) + 1 };
      }
    }

    return Object.entries(pairCounts).map(([pairKey, { from, to, count }]) => {
      const isLiveTransmitting =
        animatingEdge?.from === from && (animatingEdge?.to === to || animatingEdge?.to === "all");

      const isHovered =
        hoveredEdge?.from === from && (hoveredEdge?.to === to || hoveredEdge?.to === "all");

      const isSelected =
        selectedMessage?.from === from && (selectedMessage?.to === to || selectedMessage?.to === "all");

      const isHighlighted = isLiveTransmitting || isHovered || isSelected;

      let sourceHandle = "bottom";
      let targetHandle = "top";

      if (from === "pro" && to === "con") {
        sourceHandle = "right";
        targetHandle = "left";
      } else if (from === "con" && to === "pro") {
        sourceHandle = "left";
        targetHandle = "right";
      } else if (from === "judge") {
        sourceHandle = "top";
        targetHandle = "bottom";
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
      .find(
        (m) =>
          m.from === edge.source && (m.to === edge.target || m.to === "all")
      );
    if (matchingMsg) {
      setSelectedMessageId(matchingMsg.id);
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
                color: state.status === "completed" ? "#22c55e" : state.status === "running" ? "#38bdf8" : state.status === "failed" ? "#ef4444" : "#94a3b8"
              }}>{state.status.toUpperCase()}</span>
            </div>
            <div>
              Total Tokens: <strong style={{ color: "#f8fafc" }}>{totalTokens}</strong>
            </div>
            <div>
              Events: <strong style={{ color: "#f8fafc" }}>{events.length}</strong>
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
            disabled={state.status === "running"}
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

          {/* Pro Agent Selection */}
          <select
            value={selectedProId}
            onChange={(e) => setSelectedProId(e.target.value)}
            disabled={state.status === "running"}
            style={{
              flex: 1,
              background: "#0f172a",
              border: "1px solid #334155",
              color: "#93c5fd",
              padding: "8px 10px",
              borderRadius: "6px",
              fontSize: "0.82rem",
            }}
          >
            <option value="">Pro: Default Pro</option>
            {savedAgents.map((a) => (
              <option key={a.id} value={a.id}>
                Pro: {a.name} ({a.model})
              </option>
            ))}
          </select>

          {/* Con Agent Selection */}
          <select
            value={selectedConId}
            onChange={(e) => setSelectedConId(e.target.value)}
            disabled={state.status === "running"}
            style={{
              flex: 1,
              background: "#0f172a",
              border: "1px solid #334155",
              color: "#fca5a5",
              padding: "8px 10px",
              borderRadius: "6px",
              fontSize: "0.82rem",
            }}
          >
            <option value="">Con: Default Con</option>
            {savedAgents.map((a) => (
              <option key={a.id} value={a.id}>
                Con: {a.name} ({a.model})
              </option>
            ))}
          </select>

          {/* Judge Agent Selection */}
          <select
            value={selectedJudgeId}
            onChange={(e) => setSelectedJudgeId(e.target.value)}
            disabled={state.status === "running"}
            style={{
              flex: 1,
              background: "#0f172a",
              border: "1px solid #334155",
              color: "#fef08a",
              padding: "8px 10px",
              borderRadius: "6px",
              fontSize: "0.82rem",
            }}
          >
            <option value="">Judge: Default Judge</option>
            {savedAgents.map((a) => (
              <option key={a.id} value={a.id}>
                Judge: {a.name} ({a.model})
              </option>
            ))}
          </select>

          <button
            onClick={handleStart}
            disabled={state.status === "running"}
            style={{
              background: state.status === "running" ? "#334155" : "#38bdf8",
              color: state.status === "running" ? "#94a3b8" : "#0f172a",
              fontWeight: 600,
              border: "none",
              borderRadius: "6px",
              padding: "8px 18px",
              cursor: state.status === "running" ? "not-allowed" : "pointer",
              fontSize: "0.85rem",
              transition: "opacity 0.2s",
              whiteSpace: "nowrap"
            }}
          >
            {state.status === "running" ? "Debate Running..." : "Start Debate"}
          </button>
        </div>
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
        isLive={state.status === "running"}
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
