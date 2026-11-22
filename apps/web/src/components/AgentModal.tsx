import React, { useState } from "react";
import type { AgentRecord } from "@agent-platform/shared";
import { API_BASE } from "../api.ts";

export type { AgentRecord };

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
  const effectiveModel = models.includes(model) ? model : models[0] ?? "";

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
    if (!effectiveModel) {
      setError("No models available.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const isEditing = editingId !== null;
      const url = isEditing
        ? `${API_BASE}/agents/${editingId}`
        : `${API_BASE}/agents`;
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role: role.trim(),
          model: effectiveModel,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to ${isEditing ? "update" : "save"} agent`);
      }

      handleCancelEdit();
      onAgentCreated(); // Re-fetches the updated agents list
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this agent?")) return;
    try {
      await fetch(`${API_BASE}/agents/${id}`, { method: "DELETE" });
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
      className="agent-modal-overlay"
      onClick={onClose}
    >
      <div
        className="agent-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="agent-modal-header">
          <div>
            <h2 className="agent-modal-title">
              Agent Library & Team Configuration
            </h2>
            <p className="agent-modal-subtitle">
              Create and edit custom agents with custom system prompts and models stored in SQLite.
            </p>
          </div>
          <button
            onClick={onClose}
            className="agent-modal-close"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="agent-modal-body">
          {/* Create / Edit Agent Form */}
          <form
            onSubmit={handleSubmit}
            className="agent-modal-form"
            style={{ border: editingId ? "1px solid #0284c7" : "1px solid #334155" }}
          >
            <div className="agent-modal-form-heading">
              <h3 className="agent-modal-form-title">
                {editingId ? "Edit Agent" : "Create New Agent"}
              </h3>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="agent-modal-cancel-edit"
                >
                  Cancel editing
                </button>
              )}
            </div>

            {error && (
              <div className="agent-modal-error">
                {error}
              </div>
            )}

            <div className="agent-modal-fields">
              <div className="agent-modal-name-field">
                <label className="agent-modal-label">
                  Agent Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Socratic Debater, Tech Optimist"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="agent-modal-input"
                />
              </div>

              <div className="agent-modal-model-field">
                <label className="agent-modal-label">
                  Ollama Model
                </label>
                <select
                  value={effectiveModel}
                  onChange={(e) => setModel(e.target.value)}
                  className="agent-modal-input"
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
              <label className="agent-modal-label">
                Role & Instructions (System Prompt)
              </label>
              <textarea
                placeholder="Describe how this agent behaves, its stance, arguments, tone, or debate rules..."
                rows={3}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="agent-modal-textarea"
              />
            </div>

            <div className="agent-modal-form-actions">
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="agent-modal-cancel"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || !effectiveModel}
                className={`agent-modal-submit${submitting ? " agent-modal-submit-submitting" : ""}`}
                style={{
                  background: editingId ? "#38bdf8" : "#0284c7",
                  color: editingId ? "#0f172a" : "#fff",
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
            <h3 className="agent-modal-list-title">
              Saved Custom Agents ({agents.length})
            </h3>
            {agents.length === 0 ? (
              <p className="agent-modal-empty">
                No custom agents created yet. Create one above to pick it for debates!
              </p>
            ) : (
              <div className="agent-modal-list">
                {agents.map((a) => (
                  <div
                    key={a.id}
                    className="agent-modal-card"
                    style={{
                      background: editingId === a.id ? "#1e293b" : "#0f172a",
                      border: editingId === a.id ? "1px solid #38bdf8" : "1px solid #334155",
                    }}
                  >
                    <div className="agent-modal-card-content">
                      <div className="agent-modal-card-heading">
                        <strong className="agent-modal-agent-name">{a.name}</strong>
                        <span className="agent-modal-model-badge">
                          {a.model}
                        </span>
                      </div>
                      <p className="agent-modal-role">
                        {a.role}
                      </p>
                    </div>

                    <div className="agent-modal-card-actions">
                      <button
                        onClick={() => handleStartEdit(a)}
                        className="agent-modal-edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="agent-modal-delete"
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
