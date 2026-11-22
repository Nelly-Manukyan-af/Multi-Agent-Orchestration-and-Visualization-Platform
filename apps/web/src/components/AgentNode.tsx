import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeState } from "@agent-platform/shared";

export type AgentNodeData = {
  label: string;
  agentId: string;
  status: NodeState;
  liveText: string;
  tokens: number;
  activeTool: string | null;
};

export const AgentNode: React.FC<NodeProps> = ({ data }) => {
  const nodeData = (data ?? {}) as unknown as AgentNodeData;
  const { label = "Agent", status = "idle", liveText = "", tokens = 0, activeTool = null } = nodeData;

  // Each state has a text label and icon as well as a color (FR6.1).
  const statusConfig: Record<NodeState, { border: string; bg: string; badge: string; text: string; label: string }> = {
    idle: {
      border: "#475569",
      bg: "#1e293b",
      badge: "#334155",
      text: "#94a3b8",
      label: "○ IDLE",
    },
    thinking: {
      border: "#38bdf8",
      bg: "#0f172a",
      badge: "#0284c7",
      text: "#38bdf8",
      label: "… THINKING",
    },
    speaking: {
      border: "#22c55e",
      bg: "#0f172a",
      badge: "#15803d",
      text: "#86efac",
      label: "▶ SPEAKING",
    },
    tool_calling: {
      border: "#f59e0b",
      bg: "#0f172a",
      badge: "#b45309",
      text: "#fcd34d",
      label: "🔧 TOOL",
    },
    error: {
      border: "#ef4444",
      bg: "#1e293b",
      badge: "#991b1b",
      text: "#fca5a5",
      label: "✕ ERROR",
    },
  };

  const currentStatus = statusConfig[status] ?? statusConfig.idle;
  const isThinking = status === "thinking" || status === "speaking" || status === "tool_calling";

  // Safe live text handling with clean truncation
  const safeLiveText = typeof liveText === "string" ? liveText : "";
  const displayText = safeLiveText.length > 100 ? "…" + safeLiveText.slice(-100) : safeLiveText;

  return (
    <div
      style={{
        width: "220px",
        minHeight: "110px",
        background: currentStatus.bg,
        border: `2px solid ${currentStatus.border}`,
        borderRadius: "10px",
        padding: "12px",
        color: "#f8fafc",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxShadow: isThinking
          ? "0 0 16px rgba(56, 189, 248, 0.45), inset 0 0 10px rgba(56, 189, 248, 0.15)"
          : "0 4px 10px rgba(0, 0, 0, 0.3)",
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxSizing: "border-box",
      }}
    >
      {/* Explicit Connection Handles with Unique IDs */}
      <Handle type="target" position={Position.Top} id="target-top" style={{ background: currentStatus.border }} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" style={{ background: currentStatus.border }} />
      <Handle type="target" position={Position.Left} id="target-left" style={{ background: currentStatus.border }} />
      <Handle type="source" position={Position.Right} id="source-right" style={{ background: currentStatus.border }} />
      <Handle type="source" position={Position.Left} id="source-left" style={{ background: currentStatus.border }} />
      <Handle type="target" position={Position.Right} id="target-right" style={{ background: currentStatus.border }} />
      <Handle type="source" position={Position.Top} id="source-top" style={{ background: currentStatus.border }} />
      <Handle type="target" position={Position.Bottom} id="target-bottom" style={{ background: currentStatus.border }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f8fafc" }}>{label}</span>
        <span
          style={{
            fontSize: "0.68rem",
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: "4px",
            background: currentStatus.badge,
            color: "#fff",
            letterSpacing: "0.5px",
          }}
        >
          {currentStatus.label}
        </span>
      </div>

      <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "8px" }}>
        Tokens: <strong style={{ color: "#cbd5e1" }}>{tokens}</strong>
      </div>

      {activeTool && (
        <div
          style={{
            fontSize: "0.72rem",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            color: "#fcd34d",
            marginBottom: "6px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={activeTool}
        >
          🔧 {activeTool}
        </div>
      )}

      {/* Speech box with stable placeholder when a new round clears liveText */}
      <div
        style={{
          background: "#0f172a",
          border: `1px solid ${isThinking ? "#38bdf8" : "#334155"}`,
          borderRadius: "6px",
          padding: "6px 8px",
          fontSize: "0.75rem",
          color: isThinking ? "#e2e8f0" : "#94a3b8",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          wordBreak: "break-word",
          minHeight: "42px",
          maxHeight: "70px",
          overflow: "hidden",
          lineHeight: 1.35,
          display: "flex",
          alignItems: displayText ? "flex-start" : "center",
        }}
      >
        {displayText ? (
          displayText
        ) : (
          <span style={{ color: isThinking ? "#38bdf8" : "#64748b", fontStyle: "italic" }}>
            {isThinking ? "Thinking…" : status === "error" ? "Turn failed" : "Waiting…"}
          </span>
        )}
      </div>
    </div>
  );
};
