import React, { useState } from "react";

export interface AgentRecord {
  id: string;
  name: string;
  role: string;
  model: string;
  createdAt: number;
}

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AgentRecord[];
  models: string[];
  onAgentCreated: () => void;
  onAgentDeleted: () => void;
}

export const AgentModal: React.FC<AgentModalProps> = ({
  isOpen,
  onClose,
  agents,
  models,
  onAgentCreated,
  onAgentDeleted,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [model, setModel] = useState(models[0] ?? "qwen3:8b");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartEdit = (agent: AgentRecord) => {
    setEditingId(agent.id);
    setName(agent.name);
    setRole(agent.role);
    setModel(agent.model);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setRole("");
    setModel(models[0] ?? "qwen3:8b");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim()) {
      setError("Please fill in both name and role.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const isEditing = editingId !== null;
      const url = isEditing
        ? `http://localhost:3000/agents/${editingId}`
        : "http://localhost:3000/agents";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role: role.trim(),
          model: model || "qwen3:8b",
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to ${isEditing ? "update" : "save"} agent`);
      }

      handleCancelEdit();
      onAgentCreated(); // Re-fetches the updated agents list
    } catch (err: any) {
      setError(err.message || "Failed to save agent");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this agent?")) return;
    try {
      await fetch(`http://localhost:3000/agents/${id}`, { method: "DELETE" });
      if (editingId === id) {
        handleCancelEdit();
      }
      onAgentDeleted();
    } catch (err) {
      console.error("Failed to delete agent:", err);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "680px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
          color: "#f8fafc",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #334155",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
              Agent Library & Team Configuration
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
              Create and edit custom agents with custom system prompts and models stored in SQLite.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: "1.2rem",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {/* Create / Edit Agent Form */}
          <form
            onSubmit={handleSubmit}
            style={{
              background: "#0f172a",
              border: editingId ? "1px solid #0284c7" : "1px solid #334155",
              borderRadius: "8px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              transition: "border-color 0.2s",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "0.95rem", color: "#38bdf8", fontWeight: 600 }}>
                {editingId ? "Edit Agent" : "Create New Agent"}
              </h3>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    background: "transparent",
                    color: "#94a3b8",
                    border: "none",
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Cancel editing
                </button>
              )}
            </div>

            {error && (
              <div
                style={{
                  background: "#7f1d1d",
                  color: "#fca5a5",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 2 }}>
                <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "4px" }}>
                  Agent Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Socratic Debater, Tech Optimist"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    color: "#f8fafc",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "4px" }}>
                  Ollama Model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    color: "#f8fafc",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                  }}
                >
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "4px" }}>
                Role & Instructions (System Prompt)
              </label>
              <textarea
                placeholder="Describe how this agent behaves, its stance, arguments, tone, or debate rules..."
                rows={3}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  width: "100%",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "#f8fafc",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    background: "#334155",
                    color: "#cbd5e1",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 14px",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: editingId ? "#38bdf8" : "#0284c7",
                  color: editingId ? "#0f172a" : "#fff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting
                  ? "Saving..."
                  : editingId
                  ? "✓ Update Agent in SQLite"
                  : "+ Save Agent to SQLite"}
              </button>
            </div>
          </form>

          {/* Saved Agents List */}
          <div>
            <h3 style={{ margin: "0 0 10px", fontSize: "0.95rem", color: "#f8fafc", fontWeight: 600 }}>
              Saved Custom Agents ({agents.length})
            </h3>
            {agents.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "0.82rem", margin: 0 }}>
                No custom agents created yet. Create one above to pick it for debates!
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {agents.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      background: editingId === a.id ? "#1e293b" : "#0f172a",
                      border: editingId === a.id ? "1px solid #38bdf8" : "1px solid #334155",
                      borderRadius: "8px",
                      padding: "12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "12px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <strong style={{ color: "#f8fafc", fontSize: "0.9rem" }}>{a.name}</strong>
                        <span
                          style={{
                            background: "#334155",
                            color: "#38bdf8",
                            fontSize: "0.7rem",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontFamily: "monospace",
                          }}
                        >
                          {a.model}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.78rem",
                          color: "#94a3b8",
                          lineHeight: 1.4,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {a.role}
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => handleStartEdit(a)}
                        style={{
                          background: "#334155",
                          color: "#38bdf8",
                          border: "none",
                          borderRadius: "4px",
                          padding: "4px 10px",
                          fontSize: "0.72rem",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        style={{
                          background: "#7f1d1d",
                          color: "#fca5a5",
                          border: "none",
                          borderRadius: "4px",
                          padding: "4px 8px",
                          fontSize: "0.72rem",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
