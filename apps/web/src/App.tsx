import { useState, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';
import { useRun } from './useRun.ts';
import { AgentNode } from './components/AgentNode.tsx';

const POSITIONS: Record<string, { x: number; y: number }> = {
  pro: { x: 80, y: 60 },
  con: { x: 520, y: 60 },
  judge: { x: 300, y: 300 },
};

const AGENT_LABELS: Record<string, string> = {
  pro: "Pro Agent",
  con: "Con Agent",
  judge: "Judge",
};

function App() {
  const [topic, setTopic] = useState("Remote work is better than office work");
  const { events, state, start } = useRun();
  const [animatingEdge, setAnimatingEdge] = useState<{ from: string; to: string } | null>(null);

  const nodeTypes = useMemo(() => ({ agent: AgentNode }), []);

  // Keep active edge animated for ~1.5 seconds so fast events remain visible
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
    start(topic.trim());
  };

  // Build React Flow nodes from reducer state
  const nodes: Node[] = useMemo(() => {
    return Object.keys(POSITIONS).map((id) => {
      const agent = state.agents[id] ?? { status: "idle", liveText: "", tokens: 0 };
      return {
        id,
        type: "agent",
        position: POSITIONS[id],
        data: {
          label: AGENT_LABELS[id] ?? id.toUpperCase(),
          agentId: id,
          status: agent.status,
          liveText: agent.liveText,
          tokens: agent.tokens,
        },
      };
    });
  }, [state.agents]);

  // Build React Flow edges from accumulated messages
  const edges: Edge[] = useMemo(() => {
    // Count messages between each pair
    const pairCounts: Record<string, { from: string; to: string; count: number }> = {};

    for (const msg of state.messages) {
      if (msg.to === "all") {
        // Judge broadcast to all
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
      const isActive = animatingEdge?.from === from && (animatingEdge?.to === to || animatingEdge?.to === "all");
      return {
        id: pairKey,
        source: from,
        target: to,
        animated: isActive,
        label: `${count} msg${count > 1 ? "s" : ""}`,
        labelStyle: { fill: isActive ? "#38bdf8" : "#94a3b8", fontWeight: 600, fontSize: 11 },
        labelBgStyle: { fill: "#0f172a", fillOpacity: 0.8 },
        style: {
          stroke: isActive ? "#38bdf8" : "#475569",
          strokeWidth: isActive ? 3 : 1.5,
          transition: "stroke 0.3s, stroke-width 0.3s",
        },
      };
    });
  }, [state.messages, animatingEdge]);

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
        padding: "16px 24px",
        background: "#1e293b",
        borderBottom: "1px solid #334155",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        zIndex: 10
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.25rem", color: "#fff" }}>Agent Platform · Live Graph</h1>
            <p style={{ margin: "2px 0 0", color: "#94a3b8", fontSize: "0.82rem" }}>
              Week 5: Live conversation graph powered by event reducer
            </p>
          </div>
          <div style={{ display: "flex", gap: "16px", fontSize: "0.85rem", color: "#94a3b8" }}>
            <div>
              Status: <span style={{
                fontWeight: 700,
                color: state.status === "completed" ? "#22c55e" : state.status === "running" ? "#38bdf8" : state.status === "failed" ? "#ef4444" : "#94a3b8"
              }}>{state.status.toUpperCase()}</span>
            </div>
            <div>
              Events: <strong style={{ color: "#f8fafc" }}>{events.length}</strong>
            </div>
            <div>
              Messages: <strong style={{ color: "#f8fafc" }}>{state.messages.length}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter debate topic..."
            disabled={state.status === "running"}
            style={{
              flex: 1,
              background: "#0f172a",
              border: "1px solid #334155",
              color: "#f8fafc",
              padding: "8px 12px",
              borderRadius: "6px",
              fontSize: "0.9rem"
            }}
          />
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
              fontSize: "0.9rem"
            }}
          >
            {state.status === "running" ? "Debate Running..." : "Start Debate"}
          </button>
        </div>
      </header>

      {/* Main Graph Area */}
      <div style={{ flex: 1, position: "relative" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
        >
          <Background color="#334155" gap={20} size={1.5} />
          <Controls style={{ background: "#1e293b", border: "1px solid #334155", fill: "#f8fafc" }} />
        </ReactFlow>
      </div>
    </div>
  );
}

export default App;
