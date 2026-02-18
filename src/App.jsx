import { useState, useEffect, useCallback, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { id: "lead", label: "Lead", color: "#94a3b8" },
  { id: "demo_booked", label: "Demo booked", color: "#f59e0b" },
  { id: "demo_done", label: "Demo done", color: "#f59e0b" },
  { id: "yes_closed_won", label: "Yes / Closed-Won", color: "#10b981" },
  { id: "onboarding_sent", label: "Onboarding sent", color: "#3b82f6" },
  { id: "build_in_progress", label: "Build in progress", color: "#8b5cf6" },
  { id: "testing", label: "Testing", color: "#f97316" },
  { id: "live", label: "Live", color: "#10b981" },
  { id: "monthly_support", label: "Monthly support", color: "#06b6d4" },
  { id: "closed_lost", label: "Closed-Lost", color: "#ef4444" },
];

const STATUS_COLORS = {
  lead: { bg: "rgba(148,163,184,0.15)", text: "#94a3b8", border: "rgba(148,163,184,0.4)" },
  demo_booked: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", border: "rgba(245,158,11,0.4)" },
  demo_done: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", border: "rgba(245,158,11,0.4)" },
  yes_closed_won: { bg: "rgba(16,185,129,0.15)", text: "#10b981", border: "rgba(16,185,129,0.4)" },
  onboarding_sent: { bg: "rgba(234,179,8,0.15)", text: "#eab308", border: "rgba(234,179,8,0.4)" },
  build_in_progress: { bg: "rgba(139,92,246,0.15)", text: "#8b5cf6", border: "rgba(139,92,246,0.4)" },
  testing: { bg: "rgba(249,115,22,0.15)", text: "#f97316", border: "rgba(249,115,22,0.4)" },
  live: { bg: "rgba(16,185,129,0.15)", text: "#10b981", border: "rgba(16,185,129,0.4)" },
  monthly_support: { bg: "rgba(6,182,212,0.15)", text: "#06b6d4", border: "rgba(6,182,212,0.4)" },
  closed_lost: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", border: "rgba(239,68,68,0.4)" },
};

const STAGE_DOT_COLOR = {
  lead: "#94a3b8", demo_booked: "#f59e0b", demo_done: "#f59e0b",
  yes_closed_won: "#10b981", onboarding_sent: "#eab308", build_in_progress: "#8b5cf6",
  testing: "#f97316", live: "#10b981", monthly_support: "#06b6d4", closed_lost: "#ef4444",
};

const DEFAULT_TASKS = [
  "Confirm intake questions + branding",
  "Configure intake form",
  "Setup automation flows",
  "QA intake form",
  "QA automation flows",
  "Train clinic staff",
  "Go live",
  "Post-launch check-in",
];

// ─── Supabase ─────────────────────────────────────────────────────────────────


// ─── Password ─────────────────────────────────────────────────────────────────

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || "changeme";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://iwkdyvbxsndpwrccqvkb.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a2R5dmJ4c25kcHdyY2NxdmtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMTM3MjcsImV4cCI6MjA4NjY4OTcyN30.iISr7pFQmDIcxJeWdagMPbSQL1WOrjK2cPloAql0tbs";

const supa = {
  async query(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: options.prefer || "",
      },
      ...options,
    });
    if (!res.ok) throw new Error(await res.text());
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  },
  async getAll() {
    return await this.query("clinics?order=created_at.desc");
  },
  async upsert(clinic) {
    return await this.query("clinics", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: JSON.stringify(clinic),
    });
  },
  async update(id, patch) {
    return await this.query(`clinics?id=eq.${id}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: JSON.stringify(patch),
    });
  },
  async delete(id) {
    return await this.query(`clinics?id=eq.${id}`, { method: "DELETE" });
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function stageLabel(id) {
  return PIPELINE_STAGES.find((s) => s.id === id)?.label ?? id;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Manrope', sans-serif;
    background: #0B1121;
    color: #f8fafc;
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

  /* ── Layout ── */
  .app { display: flex; height: 100vh; overflow: hidden; }

  /* ── Sidebar (desktop) ── */
  .sidebar {
    width: 240px; min-width: 240px;
    background: #161f32;
    border-right: 1px solid rgba(255,255,255,0.07);
    display: flex; flex-direction: column; overflow: hidden;
  }
  .sidebar-brand {
    display: flex; align-items: center; gap: 10px;
    padding: 20px 18px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .brand-icon { width: 32px; height: 32px; flex-shrink: 0; }
  .brand-icon img { width: 100%; height: 100%; object-fit: contain; }
  .brand-text { line-height: 1.2; }
  .brand-name { font-size: 13px; font-weight: 700; color: #f8fafc; }
  .sidebar-nav { padding: 12px 10px; flex: 1; }
  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 10px; border-radius: 7px; cursor: pointer;
    font-size: 13px; font-weight: 500; color: #64748b;
    transition: all 0.15s; border: none; background: none; width: 100%; text-align: left;
    position: relative; font-family: 'Manrope', sans-serif;
  }
  .nav-item:hover { color: #94a3b8; background: rgba(255,255,255,0.04); }
  .nav-item.active { color: #f8fafc; background: rgba(37,99,235,0.12); }
  .nav-item.active::before {
    content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
    width: 3px; height: 60%; background: #2563eb; border-radius: 0 2px 2px 0;
  }
  .nav-icon { opacity: 0.8; display: flex; }

  /* ── Bottom nav (mobile) ── */
  .bottom-nav {
    display: none;
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 60;
    background: #161f32; border-top: 1px solid rgba(255,255,255,0.07);
    padding: 8px 0 max(8px, env(safe-area-inset-bottom));
  }
  .bottom-nav-inner { display: flex; justify-content: space-around; }
  .bottom-nav-item {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 6px 24px; border: none; background: none; cursor: pointer;
    color: #475569; font-size: 10px; font-weight: 600; font-family: 'Manrope', sans-serif;
    letter-spacing: 0.04em; text-transform: uppercase; transition: color 0.15s;
  }
  .bottom-nav-item.active { color: #3b82f6; }
  .bottom-nav-item svg { opacity: 0.9; }

  /* ── Main ── */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
  .main-header {
    padding: 22px 28px 0;
    display: flex; align-items: flex-start; justify-content: space-between;
    flex-shrink: 0;
  }
  .page-title { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; color: #f8fafc; }
  .page-subtitle { font-size: 12px; color: #475569; margin-top: 2px; font-weight: 500; }
  .main-content { flex: 1; overflow-y: auto; min-height: 0; padding: 20px 28px 28px; }

  /* ── Toolbar ── */
  .toolbar { display: flex; gap: 10px; margin-bottom: 16px; align-items: center; }
  .search-wrap { position: relative; flex: 1; min-width: 0; }
  .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #475569; pointer-events: none; }
  .search-input {
    width: 100%; padding: 9px 12px 9px 36px;
    background: #161f32; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px; color: #f8fafc; font-size: 13px; font-family: 'Manrope', sans-serif;
    outline: none; transition: border-color 0.15s;
  }
  .search-input::placeholder { color: #475569; }
  .search-input:focus { border-color: rgba(37,99,235,0.5); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
  .filter-select {
    padding: 9px 32px 9px 12px;
    background: #161f32; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px; color: #f8fafc; font-size: 13px; font-family: 'Manrope', sans-serif;
    outline: none; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center; min-width: 140px;
  }

  /* ── Buttons ── */
  .btn-primary {
    display: flex; align-items: center; gap: 6px;
    padding: 9px 16px; background: #2563eb; color: white;
    border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
    font-family: 'Manrope', sans-serif; cursor: pointer; white-space: nowrap; transition: background 0.15s;
  }
  .btn-primary:hover { background: #3b82f6; }
  .btn-ghost {
    display: flex; align-items: center; gap: 5px;
    padding: 6px 10px; background: transparent; color: #64748b;
    border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; font-size: 12px;
    font-family: 'Manrope', sans-serif; cursor: pointer; transition: all 0.15s;
  }
  .btn-ghost:hover { color: #f8fafc; border-color: rgba(255,255,255,0.2); }
  .btn-danger {
    display: flex; align-items: center; padding: 6px 8px; background: transparent;
    color: #64748b; border: none; border-radius: 5px; cursor: pointer; transition: all 0.15s;
  }
  .btn-danger:hover { color: #ef4444; background: rgba(239,68,68,0.1); }

  /* ── Desktop Table ── */
  .table-wrap {
    background: #161f32; border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; overflow: hidden;
  }
  table { width: 100%; border-collapse: collapse; }
  thead {}
  th {
    padding: 11px 16px; text-align: left;
    font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
    color: #475569; background: #0d1526;
    border-bottom: 1px solid rgba(255,255,255,0.06); white-space: nowrap;
  }
  td {
    padding: 13px 16px; font-size: 13px; color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle;
  }
  tr:last-child td { border-bottom: none; }
  tbody tr { transition: background 0.1s; }
  tbody tr:hover td { background: rgba(30,41,59,0.6); }
  .clinic-name-cell { display: flex; align-items: center; gap: 8px; }
  .clinic-name-text { font-weight: 600; color: #f8fafc; }
  .link-icon { color: #475569; cursor: pointer; transition: color 0.15s; display: flex; }
  .link-icon:hover { color: #3b82f6; }
  .contact-name { font-weight: 500; color: #f8fafc; }
  .contact-email { font-size: 11px; color: #475569; margin-top: 1px; }
  .actions-cell { display: flex; align-items: center; gap: 4px; opacity: 0; transition: opacity 0.15s; }
  tbody tr:hover .actions-cell { opacity: 1; }

  /* ── Mobile Card List ── */
  .clinic-card-list { display: none; flex-direction: column; gap: 8px; }
  .clinic-list-card {
    background: #161f32; border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; padding: 14px 16px;
    display: flex; align-items: center; gap: 12px;
    cursor: pointer; transition: background 0.1s;
  }
  .clinic-list-card:active { background: rgba(30,41,59,0.8); }
  .clinic-list-card-icon {
    width: 38px; height: 38px; background: rgba(37,99,235,0.15);
    border-radius: 9px; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; color: #3b82f6; font-size: 16px;
  }
  .clinic-list-card-body { flex: 1; min-width: 0; }
  .clinic-list-card-name { font-size: 14px; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .clinic-list-card-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
  .clinic-list-card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }

  /* ── Status badges ── */
  .status-dropdown-wrap { position: relative; display: inline-flex; }
  .status-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 8px 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
    border: 1px solid; white-space: nowrap; cursor: pointer; transition: opacity 0.15s; user-select: none;
  }
  .status-badge:hover { opacity: 0.8; }
  .status-badge-readonly {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; border: 1px solid; white-space: nowrap;
  }
  .status-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .status-dropdown {
    position: absolute; top: calc(100% + 6px); left: 0; z-index: 50;
    background: #1e293b; border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    overflow: hidden; min-width: 190px;
    animation: dropIn 0.12s ease;
  }
  @keyframes dropIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .status-option {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 12px; cursor: pointer; font-size: 12px; font-weight: 500;
    color: #cbd5e1; transition: background 0.1s; border: none; background: none;
    width: 100%; text-align: left;
  }
  .status-option:hover { background: rgba(255,255,255,0.06); color: #f8fafc; }
  .status-option.active { color: #f8fafc; background: rgba(37,99,235,0.15); }
  .status-option-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

  /* ── Empty state ── */
  .empty-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 60px 20px; color: #475569; text-align: center;
  }
  .empty-icon { font-size: 36px; margin-bottom: 12px; opacity: 0.4; }
  .empty-title { font-size: 14px; font-weight: 600; color: #64748b; }
  .empty-sub { font-size: 12px; margin-top: 4px; }

  /* ── Pipeline ── */
  .pipeline-list { display: flex; flex-direction: column; gap: 2px; }
  .stage-row {
    background: #161f32; border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px; overflow: hidden; transition: border-color 0.15s, background 0.15s;
  }
  .stage-row.drag-over { border-color: #2563eb; background: rgba(37,99,235,0.05); }
  .stage-header {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 18px; cursor: pointer; user-select: none; transition: background 0.1s;
  }
  .stage-header:hover { background: rgba(30,41,59,0.5); }
  .stage-chevron { color: #475569; transition: transform 0.2s; flex-shrink: 0; display: flex; }
  .stage-chevron.open { transform: rotate(90deg); }
  .stage-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .stage-label { font-size: 13px; font-weight: 600; color: #cbd5e1; flex: 1; }
  .stage-count {
    min-width: 22px; height: 22px; padding: 0 7px;
    background: #2563eb; color: white; border-radius: 11px;
    font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;
  }
  .stage-count.zero { background: rgba(255,255,255,0.06); color: #475569; }
  .stage-cards { padding: 4px 12px 12px; display: flex; flex-wrap: wrap; gap: 8px; }
  .stage-drop-hint { padding: 8px 18px 12px; font-size: 11px; color: #334155; font-style: italic; }

  .clinic-card {
    background: #0B1121; border: 1px solid rgba(255,255,255,0.08);
    border-left: 3px solid; border-radius: 7px; padding: 12px 14px;
    min-width: 200px; max-width: 260px;
    transition: all 0.15s; display: flex; align-items: flex-start; gap: 10px;
    cursor: grab;
  }
  .clinic-card:active { cursor: grabbing; }
  .clinic-card:hover { border-color: rgba(37,99,235,0.5); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
  .clinic-card.dragging { opacity: 0.35; transform: scale(0.97); }
  .card-icon {
    width: 32px; height: 32px; background: rgba(37,99,235,0.15);
    border-radius: 7px; display: flex; align-items: center; justify-content: center;
    font-size: 14px; flex-shrink: 0; color: #3b82f6;
  }
  .card-info { flex: 1; min-width: 0; }
  .card-name { font-size: 13px; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card-contact { font-size: 11px; color: #64748b; margin-top: 2px; }
  .card-date { font-size: 10px; color: #475569; margin-top: 3px; font-family: 'JetBrains Mono', monospace; }

  /* ── Modal ── */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(4px); z-index: 100;
    display: flex; align-items: center; justify-content: center; padding: 16px;
  }
  .modal {
    background: #161f32; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto;
    box-shadow: 0 24px 48px rgba(0,0,0,0.6); animation: modalIn 0.2s ease;
  }
  @keyframes modalIn { from { opacity: 0; transform: translateY(-10px) scale(0.98); } to { opacity: 1; transform: none; } }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px 16px; border-bottom: 1px solid rgba(255,255,255,0.07);
    position: sticky; top: 0; background: #161f32; z-index: 1;
  }
  .modal-title { font-size: 16px; font-weight: 700; color: #f8fafc; }
  .modal-close {
    background: none; border: none; color: #475569; cursor: pointer;
    padding: 4px; border-radius: 5px; transition: all 0.15s; font-size: 18px; line-height: 1;
  }
  .modal-close:hover { color: #f8fafc; background: rgba(255,255,255,0.07); }
  .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
  .modal-footer {
    padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.07);
    display: flex; justify-content: flex-end; gap: 10px;
    position: sticky; bottom: 0; background: #161f32;
  }

  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-label { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #475569; }
  .form-input, .form-select {
    padding: 10px 12px;
    background: #0B1121; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 7px; color: #f8fafc; font-size: 14px; font-family: 'Manrope', sans-serif;
    outline: none; transition: border-color 0.15s, box-shadow 0.15s; width: 100%;
  }
  .form-input:focus, .form-select:focus { border-color: rgba(37,99,235,0.5); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
  .form-select { appearance: none; cursor: pointer; }
  .form-input::placeholder { color: #334155; }

  /* ── Toast ── */
  .toast {
    position: fixed; bottom: 80px; right: 16px; z-index: 200;
    background: #1e293b; border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #f8fafc;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4); animation: toastIn 0.2s ease; max-width: 280px;
  }
  @keyframes toastIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

  /* ── Detail Panel ── */
  .detail-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    backdrop-filter: blur(3px); z-index: 80; display: flex; justify-content: flex-end;
  }
  .detail-panel {
    width: 440px; background: #161f32; border-left: 1px solid rgba(255,255,255,0.08);
    height: 100%; overflow-y: auto; display: flex; flex-direction: column; animation: slideIn 0.2s ease;
  }
  @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }
  .detail-header {
    padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.07);
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    position: sticky; top: 0; background: #161f32; z-index: 1;
  }
  .detail-title { font-size: 17px; font-weight: 700; color: #f8fafc; }
  .detail-meta { font-size: 11px; color: #475569; margin-top: 3px; }
  .detail-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
  .detail-section-title { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #475569; margin-bottom: 10px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .info-label { font-size: 10px; color: #475569; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
  .info-value { font-size: 13px; color: #f8fafc; margin-top: 2px; font-weight: 500; word-break: break-word; }

  /* ── Tasks ── */
  .task-list { display: flex; flex-direction: column; gap: 6px; }
  .task-item {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px;
    background: rgba(11,17,33,0.6); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 7px; transition: background 0.1s;
  }
  .task-item:hover { background: rgba(30,41,59,0.5); }
  .task-checkbox {
    width: 20px; height: 20px; border-radius: 5px; border: 1.5px solid rgba(255,255,255,0.2);
    background: transparent; cursor: pointer; flex-shrink: 0; transition: all 0.15s;
    display: flex; align-items: center; justify-content: center;
  }
  .task-checkbox.done { background: #10b981; border-color: #10b981; }
  .task-name { flex: 1; font-size: 13px; color: #cbd5e1; }
  .task-name.done { text-decoration: line-through; color: #475569; }
  .task-delete { background: none; border: none; color: #334155; cursor: pointer; padding: 4px; border-radius: 3px; transition: color 0.1s; font-size: 14px; }
  .task-delete:hover { color: #ef4444; }
  .add-task-row { display: flex; gap: 8px; margin-top: 4px; }
  .add-task-input {
    flex: 1; padding: 10px 12px; background: rgba(11,17,33,0.6);
    border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
    color: #f8fafc; font-size: 14px; font-family: 'Manrope', sans-serif; outline: none;
  }
  .add-task-input:focus { border-color: rgba(37,99,235,0.4); }
  .task-progress { height: 3px; background: rgba(255,255,255,0.07); border-radius: 2px; margin-bottom: 10px; }
  .task-progress-bar { height: 100%; background: #10b981; border-radius: 2px; transition: width 0.3s; }
  .task-progress-label { font-size: 10px; color: #475569; margin-bottom: 6px; }

  .loading { display: flex; align-items: center; justify-content: center; height: 100%; color: #475569; font-size: 14px; }
  /* ── Simple Login ── */
  .login-page {
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; background: #0B1121; padding: 20px;
  }
  .login-card {
    background: #161f32; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; padding: 40px; width: 100%; max-width: 380px;
    box-shadow: 0 24px 48px rgba(0,0,0,0.5);
  }
  .login-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
  .login-logo img { width: 36px; height: 36px; }
  .login-logo-text { line-height: 1.2; }
  .login-logo-name { font-size: 14px; font-weight: 700; color: #f8fafc; }
  .login-title { font-size: 20px; font-weight: 700; color: #f8fafc; margin-bottom: 24px; }
  .login-form { display: flex; flex-direction: column; gap: 14px; }
  .login-error {
    padding: 10px 12px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
    border-radius: 7px; font-size: 12px; color: #ef4444; margin-bottom: 8px;
  }
  .btn-login {
    padding: 11px; background: #2563eb; color: white; border: none;
    border-radius: 8px; font-size: 14px; font-weight: 600;
    font-family: 'Manrope', sans-serif; cursor: pointer; transition: background 0.15s;
  }
  .btn-login:hover { background: #3b82f6; }
  .btn-login:disabled { opacity: 0.6; cursor: not-allowed; }
  /* ── Logout button ── */
  .logout-btn {
    display: flex; align-items: center; gap: 7px; width: 100%;
    padding: 9px 10px; margin-top: auto; border: none; background: none;
    color: #475569; font-size: 12px; font-weight: 500; font-family: 'Manrope', sans-serif;
    cursor: pointer; border-radius: 7px; transition: all 0.15s; text-align: left;
    text-decoration: none;
  }
  .logout-btn:hover { color: #ef4444; background: rgba(239,68,68,0.08); }

  /* ── FAB (mobile add button) ── */
  .fab {
    display: none;
    position: fixed; bottom: 72px; right: 16px; z-index: 55;
    width: 52px; height: 52px; border-radius: 50%;
    background: #2563eb; color: white; border: none; cursor: pointer;
    font-size: 24px; align-items: center; justify-content: center;
    box-shadow: 0 4px 16px rgba(37,99,235,0.5); transition: background 0.15s;
  }
  .fab:active { background: #3b82f6; }

  /* ── Responsive breakpoints ── */
  @media (max-width: 768px) {
    .sidebar { display: none; }
    .bottom-nav { display: block; }
    .fab { display: flex; }

    .main-header { padding: 16px 16px 0; }
    .page-title { font-size: 20px; }
    .main-content { padding: 14px 16px 80px; }

    /* Hide desktop table, show card list */
    .table-wrap { display: none; }
    .clinic-card-list { display: flex; }

    /* Toolbar: stack search full width, filter below */
    .toolbar { flex-wrap: wrap; }
    .search-wrap { flex: 1 1 100%; }
    .filter-select { flex: 1; min-width: 0; font-size: 12px; }
    .btn-primary.header-add-btn { display: none; }

    /* Detail panel full width on mobile */
    .detail-panel { width: 100%; border-left: none; }

    /* Modal full-screen-ish on mobile */
    .modal-overlay { align-items: flex-end; padding: 0; }
    .modal { border-radius: 16px 16px 0 0; max-height: 92vh; }

    /* Form rows become single column */
    .form-row { grid-template-columns: 1fr; }

    /* Pipeline cards full width on mobile */
    .clinic-card { min-width: 0; max-width: 100%; width: 100%; }
    .stage-cards { flex-direction: column; }

    /* Toast above bottom nav */
    .toast { bottom: 72px; right: 12px; left: 12px; max-width: none; text-align: center; }
  }

  @media (min-width: 769px) {
    .toast { bottom: 24px; right: 24px; }
  }
`;

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icon = {
  Dashboard: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  Pipeline: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Edit: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Trash: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  ),
  X: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Check: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  ExternalLink: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  Clinic: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  ),
};

// ─── Inline Status Dropdown ───────────────────────────────────────────────────

function StatusDropdown({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const c = STATUS_COLORS[status] || STATUS_COLORS.lead;
  const dot = STAGE_DOT_COLOR[status] || "#94a3b8";

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="status-dropdown-wrap" ref={ref}>
      <span
        className="status-badge"
        style={{ background: c.bg, color: c.text, borderColor: c.border }}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
      >
        <span className="status-dot" style={{ background: dot }} />
        {stageLabel(status)}
        <span style={{ marginLeft: 2, opacity: 0.5, display: "flex" }}><Icon.ChevronDown /></span>
      </span>
      {open && (
        <div className="status-dropdown">
          {PIPELINE_STAGES.map(s => (
            <button
              key={s.id}
              className={"status-option" + (s.id === status ? " active" : "")}
              onClick={(e) => { e.stopPropagation(); onChange(s.id); setOpen(false); }}
            >
              <span className="status-option-dot" style={{ background: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.lead;
  const dot = STAGE_DOT_COLOR[status] || "#94a3b8";
  return (
    <span className="status-badge-readonly" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
      <span className="status-dot" style={{ background: dot }} />
      {stageLabel(status)}
    </span>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast">✓ {message}</div>;
}

// ─── Clinic Form Modal ────────────────────────────────────────────────────────

const BLANK = { name: "", contact_name: "", contact_email: "", contact_phone: "", website: "", status: "lead", start_date: "" };

function ClinicModal({ clinic, onSave, onClose }) {
  const [form, setForm] = useState(clinic ? { ...clinic } : { ...BLANK });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{clinic ? "Edit Clinic" : "Add Clinic"}</span>
          <button className="modal-close" onClick={onClose}><Icon.X /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Clinic Name *</label>
            <input className="form-input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Spinal Health Center" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contact Name</label>
              <input className="form-input" value={form.contact_name} onChange={e => set("contact_name", e.target.value)} placeholder="Dr. Smith" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} placeholder="(555) 000-0000" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={form.contact_email} onChange={e => set("contact_email", e.target.value)} placeholder="dr@clinic.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Website</label>
              <input className="form-input" value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://clinic.com" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => set("status", e.target.value)}>
                {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input type="date" className="form-input" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => { if (form.name.trim()) onSave(form); }}>{clinic ? "Save Changes" : "Add Clinic"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ clinic, onClose, onUpdate }) {
  const [newTask, setNewTask] = useState("");
  const tasks = clinic.tasks || [];
  const done = tasks.filter(t => t.done).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={e => e.stopPropagation()}>
        <div className="detail-header">
          <div>
            <div className="detail-title">{clinic.name}</div>
            <div className="detail-meta">Added {formatDate(clinic.created_at)}</div>
          </div>
          <button className="modal-close" onClick={onClose}><Icon.X /></button>
        </div>
        <div className="detail-body">
          <div>
            <div className="detail-section-title">Status</div>
            <StatusBadge status={clinic.status} />
          </div>
          <div>
            <div className="detail-section-title">Contact Info</div>
            <div className="info-grid">
              <div><div className="info-label">Contact</div><div className="info-value">{clinic.contact_name || "—"}</div></div>
              <div><div className="info-label">Phone</div><div className="info-value" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{clinic.contact_phone || "—"}</div></div>
              <div><div className="info-label">Email</div><div className="info-value" style={{ fontSize: 12 }}>{clinic.contact_email || "—"}</div></div>
              <div><div className="info-label">Start Date</div><div className="info-value">{formatDate(clinic.start_date)}</div></div>
              {clinic.website && <div style={{ gridColumn: "span 2" }}><div className="info-label">Website</div><div className="info-value" style={{ fontSize: 12 }}>{clinic.website}</div></div>}
            </div>
          </div>
          <div>
            <div className="detail-section-title">Onboarding Tasks ({done}/{tasks.length})</div>
            {tasks.length > 0 && (
              <><div className="task-progress-label">{pct}% complete</div>
              <div className="task-progress"><div className="task-progress-bar" style={{ width: pct + "%" }} /></div></>
            )}
            <div className="task-list">
              {tasks.map(t => (
                <div key={t.id} className="task-item">
                  <div className={"task-checkbox" + (t.done ? " done" : "")}
                    onClick={() => onUpdate({ ...clinic, tasks: tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x) })}>
                    {t.done && <Icon.Check />}
                  </div>
                  <span className={"task-name" + (t.done ? " done" : "")}>{t.name}</span>
                  <button className="task-delete" onClick={() => onUpdate({ ...clinic, tasks: tasks.filter(x => x.id !== t.id) })}>✕</button>
                </div>
              ))}
            </div>
            <div className="add-task-row" style={{ marginTop: 8 }}>
              <input className="add-task-input" placeholder="Add a task…" value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newTask.trim()) { onUpdate({ ...clinic, tasks: [...tasks, { id: uid(), name: newTask.trim(), done: false }] }); setNewTask(""); } }} />
              <button className="btn-primary" style={{ padding: "8px 12px", fontSize: 12 }}
                onClick={() => { if (newTask.trim()) { onUpdate({ ...clinic, tasks: [...tasks, { id: uid(), name: newTask.trim(), done: false }] }); setNewTask(""); } }}>Add</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard View ───────────────────────────────────────────────────────────

function DashboardView({ clinics, onAdd, onEdit, onDelete, onSelect, onStatusChange }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = clinics.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.contact_name || "").toLowerCase().includes(q) || (c.contact_email || "").toLowerCase().includes(q);
    return matchSearch && (filter === "all" || c.status === filter);
  });

  return (
    <>
      <div className="main-header">
        <div>
          <div className="page-title">Clinics</div>
          <div className="page-subtitle">{clinics.length} total {clinics.length === 1 ? "clinic" : "clinics"}</div>
        </div>
        <button className="btn-primary header-add-btn" onClick={onAdd}><Icon.Plus /> Add Clinic</button>
      </div>
      <div className="main-content">
        <div className="toolbar">
          <div className="search-wrap">
            <span className="search-icon"><Icon.Search /></span>
            <input className="search-input" placeholder="Search clinics…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {/* Desktop table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Clinic Name</th><th>Contact</th><th>Phone</th><th>Status</th><th>Start Date</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-icon">🏥</div>
                    <div className="empty-title">{clinics.length === 0 ? "No clinics yet" : "No results found"}</div>
                    <div className="empty-sub">{clinics.length === 0 ? "Click 'Add Clinic' to get started" : "Try adjusting your search or filter"}</div>
                  </div>
                </td></tr>
              ) : filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="clinic-name-cell">
                      <span className="clinic-name-text">{c.name}</span>
                      <span className="link-icon" onClick={() => onSelect(c)}><Icon.ExternalLink /></span>
                    </div>
                  </td>
                  <td>
                    <div className="contact-name">{c.contact_name || "—"}</div>
                    {c.contact_email && <div className="contact-email">{c.contact_email}</div>}
                  </td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{c.contact_phone || "—"}</td>
                  <td>
                    <StatusDropdown status={c.status} onChange={(newStatus) => onStatusChange(c.id, newStatus)} />
                  </td>
                  <td style={{ fontSize: 12, color: "#64748b" }}>{formatDate(c.start_date)}</td>
                  <td>
                    <div className="actions-cell">
                      <button className="btn-ghost" onClick={() => onEdit(c)} style={{ padding: "5px 8px" }}><Icon.Edit /></button>
                      <button className="btn-danger" onClick={() => onDelete(c.id)}><Icon.Trash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="clinic-card-list">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏥</div>
              <div className="empty-title">{clinics.length === 0 ? "No clinics yet" : "No results found"}</div>
              <div className="empty-sub">{clinics.length === 0 ? "Tap + to add a clinic" : "Try adjusting your search or filter"}</div>
            </div>
          ) : filtered.map(c => {
            const sc = STATUS_COLORS[c.status] || STATUS_COLORS.lead;
            const dot = STAGE_DOT_COLOR[c.status] || "#94a3b8";
            return (
              <div key={c.id} className="clinic-list-card" onClick={() => onSelect(c)}>
                <div className="clinic-list-card-icon"><Icon.Clinic /></div>
                <div className="clinic-list-card-body">
                  <div className="clinic-list-card-name">{c.name}</div>
                  <div className="clinic-list-card-sub">{c.contact_name || "—"}</div>
                </div>
                <div className="clinic-list-card-right">
                  <span className="status-badge-readonly" style={{ background: sc.bg, color: sc.text, borderColor: sc.border }}>
                    <span className="status-dot" style={{ background: dot }} />{stageLabel(c.status)}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn-ghost" onClick={e => { e.stopPropagation(); onEdit(c); }} style={{ padding: "4px 8px", fontSize: 11 }}><Icon.Edit /></button>
                    <button className="btn-danger" onClick={e => { e.stopPropagation(); onDelete(c.id); }}><Icon.Trash /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Pipeline View with Drag & Drop ──────────────────────────────────────────

function PipelineView({ clinics, onSelect, onStatusChange }) {
  const [open, setOpen] = useState(() => {
    const map = {};
    PIPELINE_STAGES.forEach(s => { map[s.id] = true; });
    return map;
  });
  const [dragOver, setDragOver] = useState(null);
  const [dragging, setDragging] = useState(null);
  const dragId = useRef(null);

  const toggle = (id) => setOpen(o => ({ ...o, [id]: !o[id] }));

  return (
    <>
      <div className="main-header">
        <div>
          <div className="page-title">Pipeline</div>
          <div className="page-subtitle">Drag cards between stages · click to open details</div>
        </div>
      </div>
      <div className="main-content">
        <div className="pipeline-list">
          {PIPELINE_STAGES.map(stage => {
            const stageClinics = clinics.filter(c => c.status === stage.id);
            const isOpen = open[stage.id];
            const isOver = dragOver === stage.id;
            return (
              <div
                key={stage.id}
                className={"stage-row" + (isOver ? " drag-over" : "")}
                onDragOver={e => { e.preventDefault(); setDragOver(stage.id); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
                onDrop={e => {
                  e.preventDefault();
                  if (dragId.current) { onStatusChange(dragId.current, stage.id); dragId.current = null; }
                  setDragOver(null); setDragging(null);
                }}
              >
                <div className="stage-header" onClick={() => toggle(stage.id)}>
                  <span className={"stage-chevron" + (isOpen ? " open" : "")}><Icon.ChevronRight /></span>
                  <span className="stage-dot" style={{ background: stage.color }} />
                  <span className="stage-label">{stage.label}</span>
                  <span className={"stage-count" + (stageClinics.length === 0 ? " zero" : "")}>{stageClinics.length}</span>
                </div>
                {isOpen && (
                  stageClinics.length > 0 ? (
                    <div className="stage-cards">
                      {stageClinics.map(c => (
                        <div
                          key={c.id}
                          className={"clinic-card" + (dragging === c.id ? " dragging" : "")}
                          style={{ borderLeftColor: stage.color }}
                          draggable
                          onDragStart={e => { dragId.current = c.id; setDragging(c.id); e.dataTransfer.effectAllowed = "move"; }}
                          onDragEnd={() => { dragId.current = null; setDragging(null); setDragOver(null); }}
                          onClick={() => onSelect(c)}
                        >
                          <div className="card-icon"><Icon.Clinic /></div>
                          <div className="card-info">
                            <div className="card-name">{c.name}</div>
                            <div className="card-contact">{c.contact_name || "—"}</div>
                            <div className="card-date">{formatDate(c.start_date)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="stage-drop-hint">Drop a clinic here to move it to {stage.label}</div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Simple Login ─────────────────────────────────────────────────────────────

function SimpleLogin({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === APP_PASSWORD) {
      localStorage.setItem("aa_auth", "1");
      onLogin();
    } else {
      setError("Incorrect password");
      setPassword("");
    }
  };

  return (
    <>
      <style>{css}</style>
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">
            <img src="data:image/png;base64,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" alt="Logo" />
            <div className="login-logo-text">
              <div className="login-logo-name">Alignment</div>
              <div className="login-logo-name">Automations</div>
            </div>
          </div>
          <div className="login-title">Enter Password</div>
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}
            <div className="form-group">
              <input 
                className="form-input" 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="Password" 
                required 
                autoFocus 
              />
            </div>
            <button className="btn-login" type="submit">Sign in</button>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [authed, setAuthed] = useState(() => localStorage.getItem("aa_auth") === "1");
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!authed) { setLoading(false); return; }
    supa.getAll()
      .then(data => { setClinics(data || []); setLoading(false); })
      .catch(() => { setClinics([]); setLoading(false); });
  }, [authed]);

  const showToast = (msg) => setToast(msg);

  const handleStatusChange = useCallback(async (id, newStatus) => {
    setClinics(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    setSelected(sel => sel?.id === id ? { ...sel, status: newStatus } : sel);
    try { await supa.update(id, { status: newStatus }); } catch (_) {}
    showToast(`Moved to ${stageLabel(newStatus)}`);
  }, []);

  const handleSave = useCallback(async (form) => {
    if (modal === "add") {
      const newClinic = { ...form, id: uid(), created_at: new Date().toISOString(), tasks: DEFAULT_TASKS.map(name => ({ id: uid(), name, done: false })) };
      setClinics(prev => [newClinic, ...prev]);
      try { await supa.upsert(newClinic); } catch (_) {}
      showToast("Clinic added");
    } else {
      const updated = { ...form };
      setClinics(prev => prev.map(c => c.id === form.id ? { ...c, ...updated } : c));
      if (selected?.id === form.id) setSelected(s => ({ ...s, ...updated }));
      try { await supa.update(form.id, updated); } catch (_) {}
      showToast("Changes saved");
    }
    setModal(null);
  }, [modal, selected]);

  const handleDelete = useCallback(async (id) => {
    setClinics(prev => prev.filter(c => c.id !== id));
    if (selected?.id === id) setSelected(null);
    try { await supa.delete(id); } catch (_) {}
    showToast("Clinic removed");
  }, [selected]);

  const handleUpdate = useCallback(async (updated) => {
    setClinics(prev => prev.map(c => c.id === updated.id ? updated : c));
    setSelected(updated);
    try { await supa.update(updated.id, { tasks: updated.tasks }); } catch (_) {}
  }, []);

  if (!authed) return <SimpleLogin onLogin={() => setAuthed(true)} />;
  if (loading) return <><style>{css}</style><div className="app"><div className="loading">Loading…</div></div></>;

  const handleLogout = () => {
    localStorage.removeItem("aa_auth");
    setAuthed(false);
    setClinics([]);
  };

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-icon">
              <img src="data:image/png;base64,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" alt="Alignment Automations" />
            </div>
            <div className="brand-text">
              <div className="brand-name">Alignment</div>
              <div className="brand-name">Automations</div>
            </div>
          </div>
          <nav className="sidebar-nav">
            <button className={"nav-item" + (page === "dashboard" ? " active" : "")} onClick={() => setPage("dashboard")}>
              <span className="nav-icon"><Icon.Dashboard /></span>Dashboard
            </button>
            <button className={"nav-item" + (page === "pipeline" ? " active" : "")} onClick={() => setPage("pipeline")}>
              <span className="nav-icon"><Icon.Pipeline /></span>Pipeline
            </button>

            <button className="logout-btn" onClick={handleLogout}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign out
            </button>
          </nav>
        </aside>

        <main className="main">
          {page === "dashboard" ? (
            <DashboardView clinics={clinics} onAdd={() => setModal("add")} onEdit={c => setModal(c)} onDelete={handleDelete} onSelect={setSelected} onStatusChange={handleStatusChange} />
          ) : (
            <PipelineView clinics={clinics} onSelect={setSelected} onStatusChange={handleStatusChange} />
          )}
        </main>

        {/* Mobile bottom nav */}
        <nav className="bottom-nav">
          <div className="bottom-nav-inner">
            <button className={"bottom-nav-item" + (page === "dashboard" ? " active" : "")} onClick={() => setPage("dashboard")}>
              <Icon.Dashboard /><span>Clinics</span>
            </button>
            <button className={"bottom-nav-item" + (page === "pipeline" ? " active" : "")} onClick={() => setPage("pipeline")}>
              <Icon.Pipeline /><span>Pipeline</span>
            </button>
          </div>
        </nav>

        {/* Mobile FAB */}
        <button className="fab" onClick={() => setModal("add")}>＋</button>

        {modal && <ClinicModal clinic={modal === "add" ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />}
        {selected && <DetailPanel clinic={selected} onClose={() => setSelected(null)} onUpdate={handleUpdate} />}
        {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      </div>
    </>
  );
}
