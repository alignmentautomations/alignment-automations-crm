import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Alignment Automations CRM (single-file App.jsx)
 * - Clinics pipeline + detail panel
 * - Tasks (general)
 * - Onboarding Checklist (collapsible, seeded on new clinic)
 * - LocalStorage persistence (works immediately)
 * - Optional Supabase persistence (toggle + env vars)
 *
 * If you already have CSS classes in your project, this file uses a small set of
 * classNames; it also includes a minimal <style> block so it still looks clean
 * even if you don’t have existing styles.
 */

/* ----------------------------- Config & Constants ---------------------------- */

const APP_KEY = "aa_crm_v1";
const DEFAULT_STATUSES = [
  "Lead",
  "Demo booked",
  "Demo done",
  "Yes / Closed-Won",
  "Onboarding sent",
  "Build in progress",
  "Testing",
  "Live",
  "Monthly support",
  "Closed-Lost",
];

const DEFAULT_TASKS = [
  "Send onboarding email",
  "Confirm Calendly link",
  "Confirm intake form fields",
  "Review clinic branding",
];

const DEFAULT_ONBOARDING_CHECKLIST = [
  "Confirm intake questions + branding",
  "Configure intake form",
  "Setup automation flows",
  "QA intake form",
  "QA automation flows",
  "Train clinic staff",
  "Go live",
  "Post-launch check-in",
];

/* --------------------------------- Helpers --------------------------------- */

function uid() {
  // fast, collision-resistant enough for UI state
  return (
    Math.random().toString(16).slice(2) +
    "-" +
    Date.now().toString(16) +
    "-" +
    Math.random().toString(16).slice(2)
  );
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function makeChecklist(names = []) {
  return names.map((name) => ({ id: uid(), name, done: false }));
}

function progressCount(list = []) {
  const total = list.length;
  const done = list.filter((x) => x.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

/* --------------------------- Optional Supabase Client ------------------------ */
/**
 * If you want Supabase persistence:
 * - Create a table `clinics` with columns:
 *   id (text primary key), name (text), status (text), phone (text), email (text),
 *   notes (text), tasks (jsonb), onboarding (jsonb), updated_at (timestamptz)
 * - Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your env
 * - Set `useSupabase` to true in UI (Settings)
 *
 * This file dynamically imports @supabase/supabase-js ONLY if you enable it.
 */

async function createSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars.");
  const mod = await import("@supabase/supabase-js");
  return mod.createClient(url, key);
}

/* ---------------------------------- App ------------------------------------ */

export default function App() {
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES);

  const [clinics, setClinics] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // modal / form
  const [openNew, setOpenNew] = useState(false);
  const [draft, setDraft] = useState(makeEmptyClinicDraft());

  // settings
  const [useSupabase, setUseSupabase] = useState(false);
  const [supa, setSupa] = useState(null);
  const [syncState, setSyncState] = useState({ ok: true, msg: "" });

  // load from localStorage on boot
  useEffect(() => {
    const raw = localStorage.getItem(APP_KEY);
    const data = raw ? safeParse(raw, null) : null;

    if (data?.clinics?.length) {
      setClinics(data.clinics);
      setStatuses(data.statuses?.length ? data.statuses : DEFAULT_STATUSES);
      setSelectedId(data.selectedId ?? data.clinics[0]?.id ?? null);
    } else {
      // seed one sample? keep clean; start empty
      setClinics([]);
      setSelectedId(null);
    }
  }, []);

  // persist to localStorage whenever changes
  useEffect(() => {
    localStorage.setItem(
      APP_KEY,
      JSON.stringify({
        clinics,
        statuses,
        selectedId,
      })
    );
  }, [clinics, statuses, selectedId]);

  // if supabase enabled, init client + pull latest
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!useSupabase) return;
      setSyncState({ ok: true, msg: "Connecting to Supabase…" });

      try {
        const client = await createSupabaseClient();
        if (cancelled) return;

        setSupa(client);
        setSyncState({ ok: true, msg: "Connected. Syncing…" });

        const { data, error } = await client
          .from("clinics")
          .select("*")
          .order("updated_at", { ascending: false });

        if (error) throw error;
        if (cancelled) return;

        const normalized = (data || []).map(normalizeClinicFromDb);
        setClinics(normalized);
        setSelectedId(normalized[0]?.id ?? null);
        setSyncState({ ok: true, msg: "Synced." });
      } catch (e) {
        setSyncState({
          ok: false,
          msg:
            e?.message ||
            "Supabase init failed. Check URL/key + table schema.",
        });
        setSupa(null);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [useSupabase]);

  const selected = useMemo(
    () => clinics.find((c) => c.id === selectedId) || null,
    [clinics, selectedId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clinics
      .filter((c) => (statusFilter === "All" ? true : c.status === statusFilter))
      .filter((c) => {
        if (!q) return true;
        return (
          (c.name || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  }, [clinics, query, statusFilter]);

  async function dbUpsert(clinic) {
    if (!useSupabase || !supa) return;
    try {
      const payload = normalizeClinicToDb(clinic);
      const { error } = await supa.from("clinics").upsert(payload);
      if (error) throw error;
      setSyncState({ ok: true, msg: "Saved to Supabase." });
    } catch (e) {
      setSyncState({ ok: false, msg: e?.message || "Supabase save failed." });
    }
  }

  async function dbDelete(id) {
    if (!useSupabase || !supa) return;
    try {
      const { error } = await supa.from("clinics").delete().eq("id", id);
      if (error) throw error;
      setSyncState({ ok: true, msg: "Deleted from Supabase." });
    } catch (e) {
      setSyncState({ ok: false, msg: e?.message || "Supabase delete failed." });
    }
  }

  function handleOpenNew() {
    setDraft(makeEmptyClinicDraft());
    setOpenNew(true);
  }

  async function handleCreateClinic(e) {
    e?.preventDefault?.();

    const name = (draft.name || "").trim();
    if (!name) return;

    const newClinic = {
      id: uid(),
      name,
      status: draft.status || "Lead",
      phone: (draft.phone || "").trim(),
      email: (draft.email || "").trim(),
      notes: (draft.notes || "").trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tasks: makeChecklist(DEFAULT_TASKS),
      onboarding: makeChecklist(DEFAULT_ONBOARDING_CHECKLIST),
    };

    setClinics((prev) => [newClinic, ...prev]);
    setSelectedId(newClinic.id);
    setOpenNew(false);

    await dbUpsert(newClinic);
  }

  async function handleUpdateClinic(updated) {
    const clinic = {
      ...updated,
      updated_at: new Date().toISOString(),
      // ensure fields exist
      tasks: updated.tasks || [],
      onboarding: updated.onboarding || [],
    };

    setClinics((prev) => prev.map((c) => (c.id === clinic.id ? clinic : c)));
    await dbUpsert(clinic);
  }

  async function handleDeleteClinic(id) {
    const next = clinics.filter((c) => c.id !== id);
    setClinics(next);
    setSelectedId(next[0]?.id ?? null);
    await dbDelete(id);
  }

  return (
    <div className="aa-root">
      <style>{baseStyles}</style>

      <TopBar
        query={query}
        setQuery={setQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        statuses={statuses}
        onNew={handleOpenNew}
        useSupabase={useSupabase}
        setUseSupabase={setUseSupabase}
        syncState={syncState}
      />

      <div className="aa-main">
        <Pipeline
          clinics={filtered}
          statuses={statuses}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDelete={handleDeleteClinic}
        />

        <div className="aa-detail">
          {selected ? (
            <DetailPanel
              clinic={selected}
              statuses={statuses}
              onUpdate={handleUpdateClinic}
            />
          ) : (
            <EmptyState onNew={handleOpenNew} />
          )}
        </div>
      </div>

      {openNew && (
        <Modal title="New Clinic" onClose={() => setOpenNew(false)}>
          <form onSubmit={handleCreateClinic} className="aa-form">
            <div className="aa-grid2">
              <Field label="Clinic name">
                <input
                  className="aa-input"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g., Smith Chiropractic"
                  autoFocus
                />
              </Field>

              <Field label="Status">
                <select
                  className="aa-input"
                  value={draft.status}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, status: e.target.value }))
                  }
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Phone">
                <input
                  className="aa-input"
                  value={draft.phone}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, phone: e.target.value }))
                  }
                  placeholder="(###) ###-####"
                />
              </Field>

              <Field label="Email">
                <input
                  className="aa-input"
                  value={draft.email}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, email: e.target.value }))
                  }
                  placeholder="frontdesk@clinic.com"
                />
              </Field>
            </div>

            <Field label="Notes">
              <textarea
                className="aa-input aa-textarea"
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Any context…"
              />
            </Field>

            <div className="aa-actions">
              <button
                type="button"
                className="aa-btn aa-btn-ghost"
                onClick={() => setOpenNew(false)}
              >
                Cancel
              </button>
              <button type="submit" className="aa-btn aa-btn-primary">
                Create clinic
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* -------------------------------- Components -------------------------------- */

function TopBar({
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  statuses,
  onNew,
  useSupabase,
  setUseSupabase,
  syncState,
}) {
  return (
    <div className="aa-topbar">
      <div className="aa-brand">
        <div className="aa-logo">AA</div>
        <div>
          <div className="aa-title">Alignment Automations</div>
          <div className="aa-subtitle">Clinic Pipeline</div>
        </div>
      </div>

      <div className="aa-controls">
        <div className="aa-search">
          <input
            className="aa-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, email…"
          />
        </div>

        <select
          className="aa-input aa-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <button className="aa-btn aa-btn-primary" onClick={onNew}>
          + New clinic
        </button>

        <div className="aa-sync">
          <label className="aa-toggle">
            <input
              type="checkbox"
              checked={useSupabase}
              onChange={(e) => setUseSupabase(e.target.checked)}
            />
            <span>Supabase</span>
          </label>
          <div className={"aa-sync-msg " + (syncState.ok ? "" : "bad")}>
            {syncState.msg}
          </div>
        </div>
      </div>
    </div>
  );
}

function Pipeline({ clinics, statuses, selectedId, onSelect, onDelete }) {
  // group by status (keeps “feel” consistent: pipeline)
  const groups = useMemo(() => {
    const map = new Map();
    statuses.forEach((s) => map.set(s, []));
    clinics.forEach((c) => {
      if (!map.has(c.status)) map.set(c.status, []);
      map.get(c.status).push(c);
    });
    return map;
  }, [clinics, statuses]);

  return (
    <div className="aa-pipeline">
      {statuses.map((status) => {
        const list = groups.get(status) || [];
        return (
          <div className="aa-col" key={status}>
            <div className="aa-col-head">
              <div className="aa-col-title">{status}</div>
              <div className="aa-col-count">{list.length}</div>
            </div>

            <div className="aa-cards">
              {list.map((c) => (
                <ClinicCard
                  key={c.id}
                  clinic={c}
                  active={c.id === selectedId}
                  onClick={() => onSelect(c.id)}
                  onDelete={() => onDelete(c.id)}
                />
              ))}
              {list.length === 0 && (
                <div className="aa-empty-col">No clinics</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ClinicCard({ clinic, active, onClick, onDelete }) {
  const taskProg = progressCount(clinic.tasks || []);
  const onboardProg = progressCount(clinic.onboarding || []);

  return (
    <div className={"aa-card " + (active ? "active" : "")} onClick={onClick}>
      <div className="aa-card-top">
        <div className="aa-card-name">{clinic.name}</div>
        <button
          className="aa-icon-btn"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete ${clinic.name}?`)) onDelete();
          }}
        >
          ✕
        </button>
      </div>

      <div className="aa-card-meta">
        {clinic.phone ? <span>{clinic.phone}</span> : <span className="muted">No phone</span>}
        {clinic.email ? <span>• {clinic.email}</span> : null}
      </div>

      <div className="aa-chips">
        <Chip label={`Tasks ${taskProg.done}/${taskProg.total}`} />
        <Chip label={`Onboard ${onboardProg.done}/${onboardProg.total}`} />
      </div>
    </div>
  );
}

function DetailPanel({ clinic, statuses, onUpdate }) {
  const [tab, setTab] = useState("Details");
  const [onboardingOpen, setOnboardingOpen] = useState(true);

  const tasks = clinic.tasks || [];
  const onboarding = clinic.onboarding || [];

  const taskProg = progressCount(tasks);
  const onboardProg = progressCount(onboarding);

  const [newTask, setNewTask] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");

  // keep local editable fields so typing feels nice
  const [local, setLocal] = useState({
    name: clinic.name || "",
    status: clinic.status || "Lead",
    phone: clinic.phone || "",
    email: clinic.email || "",
    notes: clinic.notes || "",
  });

  // when clinic changes, refresh local fields
  useEffect(() => {
    setLocal({
      name: clinic.name || "",
      status: clinic.status || "Lead",
      phone: clinic.phone || "",
      email: clinic.email || "",
      notes: clinic.notes || "",
    });
    setTab("Details");
    setOnboardingOpen(true);
    setNewTask("");
    setNewChecklistItem("");
  }, [clinic.id]);

  function commit(partial) {
    const updated = { ...clinic, ...partial };
    onUpdate(updated);
  }

  return (
    <div className="aa-panel">
      <div className="aa-panel-head">
        <div>
          <div className="aa-panel-title">{clinic.name}</div>
          <div className="aa-panel-sub">
            Last updated: {formatPretty(clinic.updated_at || clinic.created_at)}
          </div>
        </div>

        <div className="aa-tabs">
          {["Details", "Tasks"].map((t) => (
            <button
              key={t}
              className={"aa-tab " + (tab === t ? "active" : "")}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "Details" && (
        <div className="aa-panel-body">
          <div className="aa-grid2">
            <Field label="Clinic name">
              <input
                className="aa-input"
                value={local.name}
                onChange={(e) => setLocal((x) => ({ ...x, name: e.target.value }))}
                onBlur={() => commit({ name: local.name.trim() || clinic.name })}
              />
            </Field>

            <Field label="Status">
              <select
                className="aa-input"
                value={local.status}
                onChange={(e) => {
                  const status = e.target.value;
                  setLocal((x) => ({ ...x, status }));
                  commit({ status });
                }}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Phone">
              <input
                className="aa-input"
                value={local.phone}
                onChange={(e) => setLocal((x) => ({ ...x, phone: e.target.value }))}
                onBlur={() => commit({ phone: local.phone.trim() })}
              />
            </Field>

            <Field label="Email">
              <input
                className="aa-input"
                value={local.email}
                onChange={(e) => setLocal((x) => ({ ...x, email: e.target.value }))}
                onBlur={() => commit({ email: local.email.trim() })}
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              className="aa-input aa-textarea"
              value={local.notes}
              onChange={(e) => setLocal((x) => ({ ...x, notes: e.target.value }))}
              onBlur={() => commit({ notes: local.notes })}
              placeholder="Anything important…"
            />
          </Field>
        </div>
      )}

      {tab === "Tasks" && (
        <div className="aa-panel-body">
          {/* Tasks */}
          <SectionTitle title={`Tasks (${taskProg.done}/${taskProg.total})`} />

          {tasks.length > 0 && (
            <ProgressBar pct={taskProg.pct} label={`${taskProg.pct}% complete`} />
          )}

          <List>
            {tasks.map((t) => (
              <ListItem
                key={t.id}
                done={!!t.done}
                text={t.name}
                onToggle={() =>
                  commit({
                    tasks: tasks.map((x) =>
                      x.id === t.id ? { ...x, done: !x.done } : x
                    ),
                  })
                }
                onDelete={() => commit({ tasks: tasks.filter((x) => x.id !== t.id) })}
              />
            ))}
          </List>

          <AddRow
            value={newTask}
            setValue={setNewTask}
            placeholder="Add a task…"
            onAdd={() => {
              const name = newTask.trim();
              if (!name) return;
              commit({ tasks: [...tasks, { id: uid(), name, done: false }] });
              setNewTask("");
            }}
          />

          {/* Onboarding Checklist (the clean add that doesn’t change the vibe) */}
          <div className="aa-divider" />

          <div
            className="aa-section-title clickable"
            onClick={() => setOnboardingOpen((o) => !o)}
            role="button"
            aria-label="Toggle onboarding checklist"
          >
            <span>{`Onboarding Checklist (${onboardProg.done}/${onboardProg.total})`}</span>
            <span className="aa-caret">{onboardingOpen ? "▾" : "▸"}</span>
          </div>

          {onboardingOpen && (
            <>
              {onboarding.length > 0 && (
                <ProgressBar
                  pct={onboardProg.pct}
                  label={`${onboardProg.pct}% complete`}
                />
              )}

              <List>
                {onboarding.map((t) => (
                  <ListItem
                    key={t.id}
                    done={!!t.done}
                    text={t.name}
                    onToggle={() =>
                      commit({
                        onboarding: onboarding.map((x) =>
                          x.id === t.id ? { ...x, done: !x.done } : x
                        ),
                      })
                    }
                    onDelete={() =>
                      commit({ onboarding: onboarding.filter((x) => x.id !== t.id) })
                    }
                  />
                ))}
              </List>

              <AddRow
                value={newChecklistItem}
                setValue={setNewChecklistItem}
                placeholder="Add a checklist item…"
                onAdd={() => {
                  const name = newChecklistItem.trim();
                  if (!name) return;
                  commit({
                    onboarding: [...onboarding, { id: uid(), name, done: false }],
                  });
                  setNewChecklistItem("");
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Tiny UI Parts ------------------------------- */

function Field({ label, children }) {
  return (
    <label className="aa-field">
      <div className="aa-label">{label}</div>
      {children}
    </label>
  );
}

function SectionTitle({ title }) {
  return <div className="aa-section-title">{title}</div>;
}

function ProgressBar({ pct, label }) {
  return (
    <div className="aa-progress-wrap">
      <div className="aa-progress-label">{label}</div>
      <div className="aa-progress">
        <div className="aa-progress-bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function List({ children }) {
  return <div className="aa-list">{children}</div>;
}

function ListItem({ done, text, onToggle, onDelete }) {
  return (
    <div className="aa-item">
      <button
        className={"aa-check " + (done ? "done" : "")}
        onClick={onToggle}
        aria-label="Toggle"
      >
        {done ? "✓" : ""}
      </button>

      <div className={"aa-item-text " + (done ? "done" : "")}>{text}</div>

      <button className="aa-item-del" onClick={onDelete} aria-label="Delete">
        ✕
      </button>
    </div>
  );
}

function AddRow({ value, setValue, placeholder, onAdd }) {
  return (
    <div className="aa-addrow">
      <input
        className="aa-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onAdd();
        }}
      />
      <button className="aa-btn aa-btn-primary small" onClick={onAdd}>
        Add
      </button>
    </div>
  );
}

function Chip({ label }) {
  return <span className="aa-chip">{label}</span>;
}

function EmptyState({ onNew }) {
  return (
    <div className="aa-empty">
      <div className="aa-empty-title">No clinic selected</div>
      <div className="aa-empty-sub">Create a clinic to start tracking tasks and onboarding.</div>
      <button className="aa-btn aa-btn-primary" onClick={onNew}>
        + New clinic
      </button>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="aa-modal-backdrop" onMouseDown={onClose}>
      <div
        className="aa-modal"
        ref={ref}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="aa-modal-head">
          <div className="aa-modal-title">{title}</div>
          <button className="aa-icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="aa-modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------ Data Shaping ------------------------------- */

function makeEmptyClinicDraft() {
  return {
    name: "",
    status: "Lead",
    phone: "",
    email: "",
    notes: "",
  };
}

function normalizeClinicFromDb(row) {
  return {
    id: row.id,
    name: row.name || "",
    status: row.status || "Lead",
    phone: row.phone || "",
    email: row.email || "",
    notes: row.notes || "",
    created_at: row.created_at || row.updated_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
    tasks: Array.isArray(row.tasks) ? row.tasks : [],
    onboarding: Array.isArray(row.onboarding) ? row.onboarding : [],
  };
}

function normalizeClinicToDb(clinic) {
  return {
    id: clinic.id,
    name: clinic.name,
    status: clinic.status,
    phone: clinic.phone,
    email: clinic.email,
    notes: clinic.notes,
    tasks: clinic.tasks || [],
    onboarding: clinic.onboarding || [],
    updated_at: clinic.updated_at || new Date().toISOString(),
  };
}

function formatPretty(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

/* --------------------------------- Styles ---------------------------------- */

const baseStyles = `
  :root{
    --bg:#0b1220;
    --panel:#0f1a2e;
    --panel2:#0c1629;
    --card:#121f36;
    --text:#e7eefc;
    --muted:#a8b4cc;
    --line:rgba(255,255,255,.08);
    --accent:#4f8cff;
    --accent2:#7c5cff;
    --danger:#ff5c7a;
  }
  *{box-sizing:border-box}
  body{margin:0;background:linear-gradient(180deg,var(--bg),#050a14);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
  .aa-root{min-height:100vh;display:flex;flex-direction:column}
  .aa-topbar{
    position:sticky;top:0;z-index:10;
    background:rgba(11,18,32,.85);
    backdrop-filter: blur(10px);
    border-bottom:1px solid var(--line);
    padding:14px 16px;
    display:flex;gap:16px;align-items:center;justify-content:space-between;
  }
  .aa-brand{display:flex;align-items:center;gap:10px}
  .aa-logo{
    width:36px;height:36px;border-radius:12px;
    display:grid;place-items:center;
    background:linear-gradient(135deg,var(--accent),var(--accent2));
    font-weight:800;
  }
  .aa-title{font-weight:800;letter-spacing:.2px}
  .aa-subtitle{font-size:12px;color:var(--muted);margin-top:2px}
  .aa-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
  .aa-search{min-width:240px}
  .aa-input{
    width:100%;
    background:rgba(255,255,255,.04);
    border:1px solid var(--line);
    color:var(--text);
    border-radius:12px;
    padding:10px 12px;
    outline:none;
  }
  .aa-input:focus{border-color:rgba(79,140,255,.6);box-shadow:0 0 0 3px rgba(79,140,255,.12)}
  .aa-select{min-width:180px}
  .aa-btn{
    border:1px solid var(--line);
    border-radius:12px;
    padding:10px 12px;
    background:rgba(255,255,255,.04);
    color:var(--text);
    cursor:pointer;
    font-weight:700;
  }
  .aa-btn:hover{background:rgba(255,255,255,.06)}
  .aa-btn-primary{
    background:linear-gradient(135deg,var(--accent),var(--accent2));
    border:0;
  }
  .aa-btn-primary:hover{filter:brightness(1.05)}
  .aa-btn.small{padding:10px 12px}
  .aa-btn-ghost{background:transparent}
  .aa-sync{display:flex;flex-direction:column;gap:6px;align-items:flex-end}
  .aa-toggle{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--muted);user-select:none}
  .aa-sync-msg{font-size:12px;color:var(--muted);max-width:280px;text-align:right}
  .aa-sync-msg.bad{color:#ffb3c1}
  .aa-main{display:flex;gap:14px; padding:14px 16px; flex:1; min-height:0}
  .aa-pipeline{
    flex:1;
    display:grid;
    grid-auto-flow:column;
    grid-auto-columns:minmax(260px,1fr);
    gap:12px;
    overflow:auto;
    padding-bottom:6px;
  }
  .aa-col{background:rgba(255,255,255,.02);border:1px solid var(--line);border-radius:16px;min-height:100%;display:flex;flex-direction:column}
  .aa-col-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--line)}
  .aa-col-title{font-weight:800;font-size:13px}
  .aa-col-count{font-size:12px;color:var(--muted);border:1px solid var(--line);padding:3px 8px;border-radius:999px}
  .aa-cards{padding:10px;display:flex;flex-direction:column;gap:10px;min-height:0}
  .aa-empty-col{color:var(--muted);font-size:12px;padding:10px;border:1px dashed var(--line);border-radius:14px}
  .aa-card{
    background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.03));
    border:1px solid var(--line);
    border-radius:14px;
    padding:10px 10px 12px;
    cursor:pointer;
  }
  .aa-card.active{border-color:rgba(79,140,255,.55);box-shadow:0 0 0 3px rgba(79,140,255,.10)}
  .aa-card-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
  .aa-card-name{font-weight:900;line-height:1.2}
  .aa-card-meta{font-size:12px;color:var(--muted);margin-top:6px;display:flex;gap:6px;flex-wrap:wrap}
  .aa-chips{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
  .aa-chip{
    font-size:12px;color:var(--muted);
    padding:4px 8px;border-radius:999px;
    border:1px solid var(--line);
    background:rgba(0,0,0,.12)
  }
  .aa-icon-btn{
    background:transparent;border:1px solid var(--line);
    color:var(--muted);
    border-radius:10px;
    padding:4px 8px;
    cursor:pointer;
  }
  .aa-icon-btn:hover{color:var(--text);border-color:rgba(255,255,255,.18)}
  .aa-detail{
    width:min(520px,42vw);
    min-width:360px;
    border:1px solid var(--line);
    border-radius:16px;
    background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));
    overflow:hidden;
    display:flex;
    min-height:0;
  }
  .aa-panel{display:flex;flex-direction:column;flex:1;min-height:0}
  .aa-panel-head{padding:14px 14px 10px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
  .aa-panel-title{font-weight:950;font-size:16px}
  .aa-panel-sub{font-size:12px;color:var(--muted);margin-top:4px}
  .aa-tabs{display:flex;gap:8px}
  .aa-tab{
    border:1px solid var(--line);
    background:rgba(255,255,255,.03);
    color:var(--muted);
    border-radius:999px;
    padding:6px 10px;
    cursor:pointer;
    font-weight:800;
    font-size:12px;
  }
  .aa-tab.active{color:var(--text);border-color:rgba(79,140,255,.55);background:rgba(79,140,255,.10)}
  .aa-panel-body{padding:14px;overflow:auto}
  .aa-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .aa-field{display:flex;flex-direction:column;gap:6px}
  .aa-label{font-size:12px;color:var(--muted);font-weight:800}
  .aa-textarea{min-height:110px;resize:vertical}
  .aa-section-title{margin-top:2px;margin-bottom:10px;font-weight:950;display:flex;justify-content:space-between;align-items:center}
  .aa-section-title.clickable{cursor:pointer;user-select:none}
  .aa-caret{color:var(--muted);font-weight:900}
  .aa-progress-wrap{margin-bottom:10px}
  .aa-progress-label{font-size:12px;color:var(--muted);margin-bottom:6px}
  .aa-progress{height:10px;border-radius:999px;border:1px solid var(--line);overflow:hidden;background:rgba(0,0,0,.15)}
  .aa-progress-bar{height:100%;background:linear-gradient(135deg,var(--accent),var(--accent2))}
  .aa-list{display:flex;flex-direction:column;gap:8px}
  .aa-item{
    display:flex;align-items:center;gap:10px;
    border:1px solid var(--line);
    background:rgba(255,255,255,.03);
    border-radius:14px;
    padding:10px;
  }
  .aa-check{
    width:26px;height:26px;border-radius:10px;
    border:1px solid var(--line);
    background:rgba(0,0,0,.12);
    color:var(--text);
    cursor:pointer;
    display:grid;place-items:center;
    font-weight:1000;
  }
  .aa-check.done{border-color:rgba(124,92,255,.55);background:rgba(124,92,255,.14)}
  .aa-item-text{flex:1;font-weight:800}
  .aa-item-text.done{color:var(--muted);text-decoration:line-through}
  .aa-item-del{
    border:1px solid var(--line);
    background:transparent;
    color:var(--muted);
    border-radius:10px;
    padding:4px 8px;
    cursor:pointer;
  }
  .aa-item-del:hover{color:#ffd2dc;border-color:rgba(255,92,122,.45)}
  .aa-addrow{display:flex;gap:10px;margin-top:10px}
  .aa-divider{height:1px;background:var(--line);margin:14px 0}
  .aa-empty{
    padding:18px;
    display:flex;flex-direction:column;gap:10px;
    justify-content:center;align-items:flex-start;
  }
  .aa-empty-title{font-weight:950;font-size:16px}
  .aa-empty-sub{color:var(--muted);font-size:13px;line-height:1.4}
  .aa-modal-backdrop{
    position:fixed;inset:0;
    background:rgba(0,0,0,.55);
    display:flex;justify-content:center;align-items:center;
    padding:18px;
    z-index:50;
  }
  .aa-modal{
    width:min(720px,94vw);
    background:linear-gradient(180deg,rgba(15,26,46,.98),rgba(12,22,41,.98));
    border:1px solid var(--line);
    border-radius:18px;
    overflow:hidden;
  }
  .aa-modal-head{
    padding:12px 14px;border-bottom:1px solid var(--line);
    display:flex;justify-content:space-between;align-items:center
  }
  .aa-modal-title{font-weight:950}
  .aa-modal-body{padding:14px}
  .aa-form{display:flex;flex-direction:column;gap:12px}
  .aa-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:4px}
  .muted{color:var(--muted)}
  @media (max-width: 980px){
    .aa-main{flex-direction:column}
    .aa-detail{width:100%;min-width:0}
    .aa-search{min-width:200px}
  }
`;

/* --------------------------------- END FILE -------------------------------- */