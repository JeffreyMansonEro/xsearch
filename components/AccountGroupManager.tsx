"use client";

import { useState } from "react";
import { AccountGroup } from "@/types";
import { generateId } from "@/lib/storage";

interface Props {
  groups: AccountGroup[];
  selectedGroupId: string | null;
  onGroupsChange: (groups: AccountGroup[]) => void;
  onSelectGroup: (id: string | null) => void;
  activeHandles: string[];
  onActiveHandlesChange: (handles: string[]) => void;
}

function validateHandle(raw: string): string | null {
  const cleaned = raw.replace(/^@/, "").trim();
  if (!cleaned) return null;
  if (!/^[a-zA-Z0-9_]+$/.test(cleaned)) return null;
  if (cleaned.length > 15) return null;
  return cleaned;
}

export default function AccountGroupManager({
  groups,
  selectedGroupId,
  onGroupsChange,
  onSelectGroup,
  activeHandles,
  onActiveHandlesChange,
}: Props) {
  const [newGroupName, setNewGroupName] = useState("");
  const [handleInput, setHandleInput] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;

  function createGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const newGroup: AccountGroup = {
      id: generateId(),
      name,
      handles: [],
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...groups, newGroup];
    onGroupsChange(updated);
    onSelectGroup(newGroup.id);
    setNewGroupName("");
  }

  function deleteGroup(id: string) {
    const updated = groups.filter((g) => g.id !== id);
    onGroupsChange(updated);
    if (selectedGroupId === id) {
      onSelectGroup(null);
      onActiveHandlesChange([]);
    }
  }

  function startRename(group: AccountGroup) {
    setEditingGroupId(group.id);
    setEditName(group.name);
  }

  function saveRename() {
    if (!editingGroupId) return;
    const name = editName.trim();
    if (!name) return;
    const updated = groups.map((g) =>
      g.id === editingGroupId
        ? { ...g, name, updatedAt: new Date().toISOString() }
        : g
    );
    onGroupsChange(updated);
    setEditingGroupId(null);
    setEditName("");
  }

  function addHandle() {
    setError("");
    if (!selectedGroup) return;

    const validated = validateHandle(handleInput);
    if (!validated) {
      setError("無効なハンドル名です（英数字と_のみ、最大15文字）");
      return;
    }

    if (selectedGroup.handles.includes(validated)) {
      setError("このハンドルは既に追加されています");
      return;
    }

    if (selectedGroup.handles.length >= 10) {
      setError("1グループ最大10アカウントまでです");
      return;
    }

    const newHandles = [...selectedGroup.handles, validated];
    const updated = groups.map((g) =>
      g.id === selectedGroup.id
        ? { ...g, handles: newHandles, updatedAt: new Date().toISOString() }
        : g
    );
    onGroupsChange(updated);
    onActiveHandlesChange(newHandles);
    setHandleInput("");
  }

  function removeHandle(handle: string) {
    if (!selectedGroup) return;
    const newHandles = selectedGroup.handles.filter((h) => h !== handle);
    const updated = groups.map((g) =>
      g.id === selectedGroup.id
        ? { ...g, handles: newHandles, updatedAt: new Date().toISOString() }
        : g
    );
    onGroupsChange(updated);
    onActiveHandlesChange(newHandles);
  }

  function selectGroup(id: string) {
    onSelectGroup(id);
    const group = groups.find((g) => g.id === id);
    if (group) {
      onActiveHandlesChange(group.handles);
    }
  }

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4 flex flex-col gap-3">
      <label className="text-sm font-bold text-foreground">
        STEP 2: 検索対象の選択
      </label>

      {/* Group selector */}
      <div className="mb-3 flex gap-2">
        <select
          value={selectedGroupId || ""}
          onChange={(e) =>
            e.target.value ? selectGroup(e.target.value) : onSelectGroup(null)
          }
          className="flex-1 rounded-lg border border-input-border bg-input-bg px-3 py-2.5 text-sm outline-none focus:border-primary shadow-sm"
        >
          <option value="">▼ グループを選んでください</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.handles.length}件)
            </option>
          ))}
        </select>
      </div>

      {/* Create new group */}
      <div className="mb-3 flex gap-2">
        <input
          type="text"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createGroup()}
          placeholder="新規グループ名..."
          className="flex-1 rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={createGroup}
          disabled={!newGroupName.trim()}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          作成
        </button>
      </div>

      {/* Selected group actions */}
      {selectedGroup && (
        <div className="border-t border-card-border pt-3">
          <div className="mb-2 flex items-center justify-between">
            {editingGroupId === selectedGroup.id ? (
              <div className="flex flex-1 gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveRename()}
                  className="flex-1 rounded-lg border border-input-border bg-input-bg px-2 py-1 text-sm outline-none focus:border-primary"
                  autoFocus
                />
                <button
                  onClick={saveRename}
                  className="text-sm text-primary hover:underline"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditingGroupId(null)}
                  className="text-sm text-muted hover:underline"
                >
                  取消
                </button>
              </div>
            ) : (
              <>
                <span className="text-sm font-medium">
                  {selectedGroup.name}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => startRename(selectedGroup)}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    名称変更
                  </button>
                  <button
                    onClick={() => deleteGroup(selectedGroup.id)}
                    className="text-xs text-danger hover:text-danger-hover"
                  >
                    削除
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Handle tags */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selectedGroup.handles.map((h) => (
              <span
                key={h}
                className="inline-flex items-center gap-1 rounded-full bg-tag-bg px-2.5 py-0.5 text-xs font-medium text-tag-text"
              >
                @{h}
                <button
                  onClick={() => removeHandle(h)}
                  className="ml-0.5 text-tag-text/60 hover:text-tag-text"
                >
                  &times;
                </button>
              </span>
            ))}
            {selectedGroup.handles.length === 0 && (
              <span className="text-xs text-muted">
                アカウントを追加してください
              </span>
            )}
          </div>

          {/* Add handle */}
          <div className="flex gap-2">
            <input
              type="text"
              value={handleInput}
              onChange={(e) => {
                setHandleInput(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && addHandle()}
              placeholder="@handle を入力..."
              className="flex-1 rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={addHandle}
              disabled={!handleInput.trim()}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              追加
            </button>
          </div>
          {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
