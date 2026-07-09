"use client";
import { useEffect, useState } from "react";
import { Plus, RotateCcw, GripVertical, Trash2 } from "lucide-react";
import { useMissionControl } from "@/components/missioncontrol/MissionControlContext";
import { mcFetch } from "@/components/missioncontrol/api";
import s from "./templates.module.css";

export default function TemplatesPage() {
  const { slug, mcKey, toast } = useMissionControl();
  const [items, setItems] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    mcFetch(`/api/checklist-template?tenant=${encodeURIComponent(slug)}`, { mcKey })
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]));
    mcFetch(`/api/tenant-config?tenant=${encodeURIComponent(slug)}`, { mcKey })
      .then(setConfig)
      .catch(() => setConfig(null));
  }, [slug, mcKey]);

  async function persist(nextItems) {
    setItems(nextItems);
    try {
      await mcFetch("/api/checklist-template", { mcKey, method: "PATCH", body: { tenant: slug, items: nextItems } });
    } catch {
      toast.push("Couldn't save the checklist template. Try again.", "error");
    }
  }

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditingText(item.text);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const trimmed = editingText.trim();
    if (trimmed) {
      persist(items.map((i) => (i.id === editingId ? { ...i, text: trimmed } : i)));
    }
    setEditingId(null);
  };

  const deleteItem = (id) => persist(items.filter((i) => i.id !== id));

  const toggleOwner = (id) =>
    persist(items.map((i) => (i.id === id ? { ...i, owner: i.owner === "You" ? "Client" : "You" } : i)));

  const addItem = () => {
    const newId = `c${Date.now()}`;
    const newItem = { id: newId, group: "Go live", text: "New item", owner: "You" };
    const next = [...items, newItem];
    persist(next);
    setTimeout(() => startEdit(newItem), 50);
  };

  const restoreDefault = async () => {
    try {
      const data = await mcFetch("/api/checklist-template", { mcKey, method: "PATCH", body: { tenant: slug, restoreDefault: true } });
      setItems(data.items);
    } catch {
      toast.push("Couldn't restore the defaults. Try again.", "error");
    }
  };

  const handleDrop = (targetId) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const from = items.findIndex((i) => i.id === dragId);
    const to = items.findIndex((i) => i.id === targetId);
    const targetGroup = items[to].group;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    moved.group = targetGroup;
    next.splice(to, 0, moved);
    persist(next);
    setDragId(null);
    setDragOverId(null);
  };

  if (items === null) {
    return <p className={s.muted}>Loading…</p>;
  }

  const groups = Array.from(new Set(items.map((i) => i.group)));

  return (
    <>
      <div className={s.pageHeader}>
        <h1 className={s.title}>Templates</h1>
        <p className={s.subtitle}>Manage your go-live checklist and snapshot templates.</p>
      </div>

      <div className={s.section}>
        <div className={s.sectionHeader}>
          <div>
            <h2 className={s.sectionTitle}>Go-live checklist</h2>
            <p className={s.sectionSubtitle}>Applied to every new client. Drag to reorder.</p>
          </div>
        </div>

        <div className={s.checklistCard}>
          {groups.map((group) => (
            <div key={group}>
              <div className={s.groupHeader}>
                <span className={s.groupHeaderLabel}>{group}</span>
              </div>
              {items
                .filter((i) => i.group === group)
                .map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDragId(item.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverId(item.id);
                    }}
                    onDrop={() => handleDrop(item.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOverId(null);
                    }}
                    className={`${s.itemRow} ${dragOverId === item.id ? s.itemRowDragOver : ""}`}
                  >
                    <div className={s.dragHandle}>
                      <GripVertical size={14} />
                    </div>
                    <div className={s.itemTextWrap}>
                      {editingId === item.id ? (
                        <input
                          autoFocus
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className={s.itemInput}
                        />
                      ) : (
                        <span className={s.itemText} onDoubleClick={() => startEdit(item)} title="Double-click to rename">
                          {item.text}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => toggleOwner(item.id)}
                      className={`${s.ownerTag} ${item.owner === "You" ? s.ownerYou : s.ownerClient}`}
                    >
                      {item.owner}
                    </button>
                    <button onClick={() => deleteItem(item.id)} className={s.deleteButton}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
            </div>
          ))}
        </div>

        <div className={s.checklistFooter}>
          <button onClick={addItem} className={s.footerButton}>
            <Plus size={14} />
            Add item
          </button>
          <button onClick={restoreDefault} className={s.footerButton}>
            <RotateCcw size={12} />
            Restore defaults
          </button>
        </div>
      </div>

      <div>
        <div className={s.sectionHeaderStatic}>
          <h2 className={s.sectionTitle}>Snapshot templates</h2>
          <p className={s.sectionSubtitle}>The GoHighLevel snapshot imported for new clients.</p>
        </div>

        <div className={s.snapshotGrid}>
          {config?.snapshotConfigured ? (
            <div className={s.snapshotCard}>
              <div className={s.snapshotCardTop}>
                <div className={s.snapshotCardTitleRow}>
                  <span className={s.snapshotName}>{slug}</span>
                  <span className={s.activePill}>Active</span>
                </div>
              </div>
              <div className={s.snapshotMeta}>
                <span className={s.snapshotVersion}>{config.snapshotId}</span>
                <span>Configured via environment</span>
              </div>
            </div>
          ) : (
            <p className={s.muted}>No snapshot configured for this tenant yet.</p>
          )}

          <button disabled title="Coming soon" className={s.addTemplateCard}>
            <Plus size={18} />
            <span>Add template</span>
          </button>
        </div>
      </div>
    </>
  );
}
