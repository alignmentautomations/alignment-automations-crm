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

// ─── Checklist Modules ────────────────────────────────────────────────────────

const MODULES = {
  A: {
    clinic: [
      { name: "Create Calendly account", done: false, section: "Accounts & Access" },
      { name: "Connect calendar to Calendly", done: false, section: "Accounts & Access" },
      { name: "Set appointment availability", done: false, section: "Accounts & Access" },
      { name: "Create intake form tool (Google Forms / Tally / Typeform)", done: false, section: "Accounts & Access" },
      { name: "Create Zapier or Make account", done: false, section: "Accounts & Access" },
      { name: "Provide master contact email", done: false, section: "Accounts & Access" },
      { name: "Approve intake questions", done: false, section: "Approvals" },
      { name: "Approve confirmation message copy", done: false, section: "Approvals" },
      { name: "Give admin access to Calendly", done: false, section: "Accounts & Access" },
      { name: "Give admin access to Form tool", done: false, section: "Accounts & Access" },
      { name: "Give admin access to Zapier/Make", done: false, section: "Accounts & Access" },
    ],
    alignment: [
      { name: "Confirm intake flow structure", done: false, section: "Build" },
      { name: "Create intake form", done: false, section: "Build" },
      { name: "Configure form validation", done: false, section: "Build" },
      { name: "Create automation trigger", done: false, section: "Build" },
      { name: "Build form → confirmation email automation", done: false, section: "Build" },
      { name: "Insert booking link into confirmation message", done: false, section: "Build" },
      { name: "Configure internal notification email", done: false, section: "Build" },
      { name: "Create lead logging sheet or CRM entry", done: false, section: "Build" },
      { name: "Test form submission (desktop)", done: false, section: "Testing & Launch" },
      { name: "Test form submission (mobile)", done: false, section: "Testing & Launch" },
      { name: "Confirm booking link works", done: false, section: "Testing & Launch" },
      { name: "Confirm calendar receives appointment", done: false, section: "Testing & Launch" },
      { name: "Confirm notification email is received", done: false, section: "Testing & Launch" },
      { name: "Mark system Ready for Launch", done: false, section: "Testing & Launch" },
      { name: "Send clinic walkthrough", done: false, section: "Testing & Launch" },
    ],
  },
  B: {
    clinic: [
      { name: "Create Twilio account", done: false, section: "Accounts & Access" },
      { name: "Purchase phone number", done: false, section: "Accounts & Access" },
      { name: "Register business profile (A2P if required)", done: false, section: "Accounts & Access" },
      { name: "Add Alignment Automations as admin", done: false, section: "Accounts & Access" },
      { name: "Provide clinic booking link", done: false, section: "Accounts & Access" },
      { name: "Confirm call handling preference", done: false, section: "Approvals" },
    ],
    alignment: [
      { name: "Connect Twilio number", done: false, section: "Build" },
      { name: "Configure missed call detection", done: false, section: "Build" },
      { name: "Create SMS response template", done: false, section: "Build" },
      { name: "Insert booking link in response", done: false, section: "Build" },
      { name: "Configure response delay (if needed)", done: false, section: "Build" },
      { name: "Configure spam filtering", done: false, section: "Build" },
      { name: "Create logging for phone leads", done: false, section: "Build" },
      { name: "Test missed call trigger", done: false, section: "Testing & Launch" },
      { name: "Test SMS delivery", done: false, section: "Testing & Launch" },
      { name: "Test booking link from text", done: false, section: "Testing & Launch" },
      { name: "Confirm notification workflow", done: false, section: "Testing & Launch" },
      { name: "Mark system Ready", done: false, section: "Testing & Launch" },
    ],
  },
  C: {
    clinic: [
      { name: "Provide business name", done: false, section: "Accounts & Access" },
      { name: "Provide logo", done: false, section: "Accounts & Access" },
      { name: "Provide services list", done: false, section: "Accounts & Access" },
      { name: "Provide service descriptions (or approve draft)", done: false, section: "Accounts & Access" },
      { name: "Provide contact information", done: false, section: "Accounts & Access" },
      { name: "Provide address", done: false, section: "Accounts & Access" },
      { name: "Provide booking link", done: false, section: "Accounts & Access" },
      { name: "Approve website copy", done: false, section: "Approvals" },
      { name: "Approve page structure", done: false, section: "Approvals" },
    ],
    alignment: [
      { name: "Create website project", done: false, section: "Build" },
      { name: "Build homepage layout", done: false, section: "Build" },
      { name: "Build services page", done: false, section: "Build" },
      { name: "Build booking page", done: false, section: "Build" },
      { name: "Build contact page", done: false, section: "Build" },
      { name: "Insert booking call-to-action buttons", done: false, section: "Build" },
      { name: "Optimize for mobile", done: false, section: "Build" },
      { name: "Configure domain", done: false, section: "Build" },
      { name: "Connect hosting", done: false, section: "Build" },
      { name: "Test booking links", done: false, section: "Testing & Launch" },
      { name: "Test mobile layout", done: false, section: "Testing & Launch" },
      { name: "Publish website", done: false, section: "Testing & Launch" },
      { name: "Send review link", done: false, section: "Testing & Launch" },
      { name: "Mark Website Live", done: false, section: "Testing & Launch" },
    ],
  },
  D: {
    clinic: [
      { name: "Create Twilio account", done: false, section: "Accounts & Access" },
      { name: "Purchase phone number", done: false, section: "Accounts & Access" },
      { name: "Provide booking link", done: false, section: "Accounts & Access" },
      { name: "Give Alignment Automations admin access", done: false, section: "Accounts & Access" },
    ],
    alignment: [
      { name: "Connect Twilio number", done: false, section: "Build" },
      { name: "Configure missed-call trigger", done: false, section: "Build" },
      { name: "Create SMS auto-response", done: false, section: "Build" },
      { name: "Insert booking link", done: false, section: "Build" },
      { name: "Configure quiet hours if needed", done: false, section: "Build" },
      { name: "Test missed call", done: false, section: "Testing & Launch" },
      { name: "Test SMS delivery", done: false, section: "Testing & Launch" },
      { name: "Confirm booking link works", done: false, section: "Testing & Launch" },
      { name: "Mark Call Protection Active", done: false, section: "Testing & Launch" },
    ],
  },
};

const PACKAGE_MODULES = {
  "Automation Core": ["A"],
  "Intake Foundation": ["A", "C"],
  "Call Protection": ["D"],
  "Call Capture": ["B"],
  "Core + Call Protection": ["A", "D"],
  "Foundation + Core": ["A", "C"],
  "Full Intake Infrastructure": ["A", "B", "C"],
};

function getPackageTasks(packageName) {
  const moduleKeys = PACKAGE_MODULES[packageName] || [];
  const alignment = [];
  const clinic = [];
  moduleKeys.forEach(key => {
    if (MODULES[key]) {
      alignment.push(...MODULES[key].alignment);
      clinic.push(...MODULES[key].clinic);
    }
  });
  return { alignment, clinic };
}

const DEFAULT_TASKS = {
  alignment: [
    { name: "Define project scope", done: false, section: "Planning" },
    { name: "Gather requirements", done: false, section: "Planning" },
    { name: "Build solution", done: false, section: "Build" },
    { name: "Test & QA", done: false, section: "QA" },
    { name: "Deploy", done: false, section: "Launch" },
  ],
  clinic: [
    { name: "Provide access", done: false, section: "Setup" },
    { name: "Review & approve", done: false, section: "Approvals" },
    { name: "Go live", done: false, section: "Launch" },
  ],
};

const PACKAGES = {
  individual: ["Automation Core", "Intake Foundation", "Call Protection", "Call Capture"],
  bundles: ["Core + Call Protection", "Foundation + Core", "Full Intake Infrastructure"],
};

// ─── Follow-up System Data ─────────────────────────────────────────────────────

const TRIGGER_TYPES = [
  { id: "new_client", label: "New Client Onboarded", icon: "✦", color: "#4ade80" },
  { id: "package_purchase", label: "Package Purchase", icon: "◈", color: "#60a5fa" },
  { id: "no_activity", label: "No Activity", icon: "◌", color: "#f59e0b" },
  { id: "missed_call", label: "Missed Call", icon: "⟳", color: "#f87171" },
  { id: "form_inquiry", label: "Form Inquiry", icon: "◻", color: "#a78bfa" },
  { id: "manual", label: "Manual Trigger", icon: "◆", color: "#64748b" },
];

const DEFAULT_SEQUENCES = [
  {
    id: "seq_1", name: "New Client Welcome", trigger: "new_client", active: true,
    steps: [
      { id: "s1", delay: 0, delayUnit: "hours", channel: "email", subject: "Welcome to {{clinic_name}} — You're all set", body: "Hi {{first_name}},\n\nWelcome aboard! Your intake system is live and ready. Here's what happens next:\n\n→ Your booking link is active\n→ New leads will be captured automatically\n→ You'll receive a summary every Monday\n\nAny questions? Reply to this email or text us anytime.\n\n— The Alignment Automations Team" },
      { id: "s2", delay: 2, delayUnit: "days", channel: "sms", subject: "", body: "Hey {{first_name}}, just checking in — your system has been live for 2 days. Seeing any new inquiries come through? Let us know if you need anything. — Alignment Automations" },
      { id: "s3", delay: 7, delayUnit: "days", channel: "email", subject: "Your first week — how's it going?", body: "Hi {{first_name}},\n\nIt's been one week since you went live. By now you should be seeing automated intake forms routing to your calendar and new client confirmations going out automatically.\n\nIf anything feels off, let's jump on a quick call.\n\n— The Alignment Automations Team" },
    ],
  },
  {
    id: "seq_2", name: "Missed Call Recovery", trigger: "missed_call", active: true,
    steps: [
      { id: "s4", delay: 5, delayUnit: "minutes", channel: "sms", subject: "", body: "Hi {{first_name}}, sorry we missed your call! We'd love to connect — you can book a time here: https://calendly.com/alignment-automations/new-meeting or reply to this text." },
      { id: "s5", delay: 1, delayUnit: "days", channel: "email", subject: "We missed you — let's connect", body: "Hi {{first_name}},\n\nWe tried to reach you but missed your call. No worries — grab 15 minutes whenever works:\n\nhttps://calendly.com/alignment-automations/new-meeting\n\n— The Alignment Automations Team" },
    ],
  },
  {
    id: "seq_3", name: "Form Inquiry Follow-up", trigger: "form_inquiry", active: true,
    steps: [
      { id: "s6", delay: 10, delayUnit: "minutes", channel: "email", subject: "Got your message — here's what's next", body: "Hi {{first_name}},\n\nThanks for reaching out! We received your inquiry and will be in touch shortly.\n\nIn the meantime, feel free to book a discovery call directly:\nhttps://calendly.com/alignment-automations/new-meeting\n\n— The Alignment Automations Team" },
      { id: "s7", delay: 30, delayUnit: "minutes", channel: "sms", subject: "", body: "Hey {{first_name}}! Got your inquiry — we'll follow up soon. Want to skip the wait? Book here: https://calendly.com/alignment-automations/new-meeting" },
    ],
  },
  {
    id: "seq_4", name: "Re-engagement (Gone Quiet)", trigger: "no_activity", active: false,
    steps: [
      { id: "s8", delay: 30, delayUnit: "days", channel: "email", subject: "Still here if you need us", body: "Hi {{first_name}},\n\nWe noticed it's been a while — just wanted to check in and see how things are going at {{clinic_name}}.\n\nIf you have questions or want to explore additional automations, we're always available.\n\n— The Alignment Automations Team" },
      { id: "s9", delay: 45, delayUnit: "days", channel: "sms", subject: "", body: "Hey {{first_name}}, it's been a while! If you ever want to revisit your automation setup or explore new features, we're here. — Alignment Automations" },
    ],
  },
];

// ─── DB ───────────────────────────────────────────────────────────────────────

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || "8n4kvkar";
const API_BASE = "/api";

const db = {
  async getAll() {
    const res = await fetch(`${API_BASE}/clinics`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },
  async create(clinic) {
    const res = await fetch(`${API_BASE}/clinics`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clinic),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },
  async update(id, patch) {
    const res = await fetch(`${API_BASE}/clinics/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },
  async delete(id) {
    const res = await fetch(`${API_BASE}/clinics/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    return { success: true };
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function stageLabel(id) { return PIPELINE_STAGES.find(s => s.id === id)?.label ?? id; }
function getTrigger(id) { return TRIGGER_TYPES.find(t => t.id === id) || TRIGGER_TYPES[5]; }
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Manrope', sans-serif; background: #0B1121; color: #f8fafc; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

  /* ── Layout ── */
  .app { display: flex; height: 100vh; overflow: hidden; }
  .sidebar { width: 240px; min-width: 240px; background: #161f32; border-right: 1px solid rgba(255,255,255,0.07); display: flex; flex-direction: column; overflow: hidden; }
  .sidebar-brand { display: flex; align-items: center; gap: 10px; padding: 20px 18px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); }
  .brand-icon { width: 32px; height: 32px; flex-shrink: 0; }
  .brand-icon img { width: 100%; height: 100%; object-fit: contain; }
  .brand-text { line-height: 1.2; }
  .brand-name { font-size: 13px; font-weight: 700; color: #f8fafc; }
  .sidebar-nav { padding: 12px 10px; flex: 1; overflow-y: auto; }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 7px; cursor: pointer; font-size: 13px; font-weight: 500; color: #64748b; transition: all 0.15s; border: none; background: none; width: 100%; text-align: left; position: relative; font-family: 'Manrope', sans-serif; }
  .nav-item:hover { color: #94a3b8; background: rgba(255,255,255,0.04); }
  .nav-item.active { color: #f8fafc; background: rgba(37,99,235,0.12); }
  .nav-item.active::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 3px; height: 60%; background: #2563eb; border-radius: 0 2px 2px 0; }
  .nav-icon { opacity: 0.8; display: flex; }
  .nav-section-label { padding: 16px 10px 6px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #334155; }

  /* ── Bottom nav (mobile) ── */
  .bottom-nav { display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 60; background: #161f32; border-top: 1px solid rgba(255,255,255,0.07); padding: 8px 0 max(8px, env(safe-area-inset-bottom)); }
  .bottom-nav-inner { display: flex; justify-content: space-around; }
  .bottom-nav-item { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 16px; border: none; background: none; cursor: pointer; color: #475569; font-size: 10px; font-weight: 600; font-family: 'Manrope', sans-serif; letter-spacing: 0.04em; text-transform: uppercase; transition: color 0.15s; }
  .bottom-nav-item.active { color: #3b82f6; }

  /* ── Main ── */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
  .main-header { padding: 22px 28px 0; display: flex; align-items: flex-start; justify-content: space-between; flex-shrink: 0; }
  .page-title { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; color: #f8fafc; }
  .page-subtitle { font-size: 12px; color: #475569; margin-top: 2px; font-weight: 500; }
  .main-content { flex: 1; overflow-y: auto; min-height: 0; padding: 20px 28px 28px; }

  /* ── Toolbar ── */
  .toolbar { display: flex; gap: 10px; margin-bottom: 16px; align-items: center; flex-wrap: wrap; }
  .search-wrap { position: relative; flex: 1; min-width: 180px; }
  .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #475569; pointer-events: none; }
  .search-input { width: 100%; padding: 9px 12px 9px 36px; background: #161f32; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #f8fafc; font-size: 13px; font-family: 'Manrope', sans-serif; outline: none; transition: border-color 0.15s; }
  .search-input::placeholder { color: #475569; }
  .search-input:focus { border-color: rgba(37,99,235,0.5); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
  .filter-select { padding: 9px 32px 9px 12px; background: #161f32; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #f8fafc; font-size: 13px; font-family: 'Manrope', sans-serif; outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; min-width: 140px; }

  /* ── Buttons ── */
  .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'Manrope', sans-serif; cursor: pointer; white-space: nowrap; transition: background 0.15s; }
  .btn-primary:hover { background: #3b82f6; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-ghost { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; background: transparent; color: #64748b; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; font-size: 12px; font-family: 'Manrope', sans-serif; cursor: pointer; transition: all 0.15s; }
  .btn-ghost:hover { color: #f8fafc; border-color: rgba(255,255,255,0.2); }
  .btn-danger { display: inline-flex; align-items: center; padding: 6px 8px; background: transparent; color: #64748b; border: none; border-radius: 5px; cursor: pointer; transition: all 0.15s; }
  .btn-danger:hover { color: #ef4444; background: rgba(239,68,68,0.1); }

  /* ── Table ── */
  .table-wrap { background: #161f32; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 11px 16px; text-align: left; font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; background: #0d1526; border-bottom: 1px solid rgba(255,255,255,0.06); white-space: nowrap; }
  td { padding: 13px 16px; font-size: 13px; color: #cbd5e1; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle; }
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
  .clinic-list-card { background: #161f32; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: background 0.1s; }
  .clinic-list-card:active { background: rgba(30,41,59,0.8); }
  .clinic-list-card-icon { width: 38px; height: 38px; background: rgba(37,99,235,0.15); border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #3b82f6; font-size: 16px; }
  .clinic-list-card-body { flex: 1; min-width: 0; }
  .clinic-list-card-name { font-size: 14px; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .clinic-list-card-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
  .clinic-list-card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }

  /* ── Status badges ── */
  .status-dropdown-wrap { position: relative; display: inline-flex; }
  .status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; border: 1px solid; white-space: nowrap; cursor: pointer; transition: opacity 0.15s; user-select: none; }
  .status-badge:hover { opacity: 0.8; }
  .status-badge-readonly { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; border: 1px solid; white-space: nowrap; }
  .status-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .status-dropdown { position: absolute; top: calc(100% + 6px); left: 0; z-index: 50; background: #1e293b; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); overflow: hidden; min-width: 190px; animation: dropIn 0.12s ease; }
  @keyframes dropIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .status-option { display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: pointer; font-size: 12px; font-weight: 500; color: #cbd5e1; transition: background 0.1s; border: none; background: none; width: 100%; text-align: left; }
  .status-option:hover { background: rgba(255,255,255,0.06); color: #f8fafc; }
  .status-option.active { color: #f8fafc; background: rgba(37,99,235,0.15); }
  .status-option-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

  /* ── Followup badges ── */
  .fu-badge { display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
  .fu-badge-active { background: rgba(74,222,128,0.12); color: #4ade80; }
  .fu-badge-completed { background: rgba(148,163,184,0.12); color: #94a3b8; }
  .fu-badge-paused { background: rgba(245,158,11,0.12); color: #f59e0b; }

  /* ── Empty state ── */
  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #475569; text-align: center; }
  .empty-icon { font-size: 36px; margin-bottom: 12px; opacity: 0.4; }
  .empty-title { font-size: 14px; font-weight: 600; color: #64748b; }
  .empty-sub { font-size: 12px; margin-top: 4px; }

  /* ── Pipeline ── */
  .pipeline-list { display: flex; flex-direction: column; gap: 2px; }
  .stage-row { background: #161f32; border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; overflow: hidden; transition: border-color 0.15s, background 0.15s; }
  .stage-row.drag-over { border-color: #2563eb; background: rgba(37,99,235,0.05); }
  .stage-header { display: flex; align-items: center; gap: 12px; padding: 14px 18px; cursor: pointer; user-select: none; transition: background 0.1s; }
  .stage-header:hover { background: rgba(30,41,59,0.5); }
  .stage-chevron { color: #475569; transition: transform 0.2s; flex-shrink: 0; display: flex; }
  .stage-chevron.open { transform: rotate(90deg); }
  .stage-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .stage-label { font-size: 13px; font-weight: 600; color: #cbd5e1; flex: 1; }
  .stage-count { min-width: 22px; height: 22px; padding: 0 7px; background: #2563eb; color: white; border-radius: 11px; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .stage-count.zero { background: rgba(255,255,255,0.06); color: #475569; }
  .stage-cards { padding: 4px 12px 12px; display: flex; flex-wrap: wrap; gap: 8px; }
  .stage-drop-hint { padding: 8px 18px 12px; font-size: 11px; color: #334155; font-style: italic; }
  .clinic-card { background: #0B1121; border: 1px solid rgba(255,255,255,0.08); border-left: 3px solid; border-radius: 7px; padding: 12px 14px; min-width: 200px; max-width: 260px; transition: all 0.15s; display: flex; align-items: flex-start; gap: 10px; cursor: grab; }
  .clinic-card:active { cursor: grabbing; }
  .clinic-card:hover { border-color: rgba(37,99,235,0.5); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
  .clinic-card.dragging { opacity: 0.35; transform: scale(0.97); }
  .card-icon { width: 32px; height: 32px; background: rgba(37,99,235,0.15); border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; color: #3b82f6; }
  .card-info { flex: 1; min-width: 0; }
  .card-name { font-size: 13px; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card-contact { font-size: 11px; color: #64748b; margin-top: 2px; }
  .card-date { font-size: 10px; color: #475569; margin-top: 3px; font-family: 'JetBrains Mono', monospace; }

  /* ── Modal ── */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .modal { background: #161f32; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 48px rgba(0,0,0,0.6); animation: modalIn 0.2s ease; }
  .modal-lg { max-width: 760px; }
  @keyframes modalIn { from { opacity: 0; transform: translateY(-10px) scale(0.98); } to { opacity: 1; transform: none; } }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); position: sticky; top: 0; background: #161f32; z-index: 1; }
  .modal-title { font-size: 16px; font-weight: 700; color: #f8fafc; }
  .modal-close { background: none; border: none; color: #475569; cursor: pointer; padding: 4px; border-radius: 5px; transition: all 0.15s; font-size: 18px; line-height: 1; }
  .modal-close:hover { color: #f8fafc; background: rgba(255,255,255,0.07); }
  .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
  .modal-footer { padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.07); display: flex; justify-content: flex-end; gap: 10px; position: sticky; bottom: 0; background: #161f32; }

  /* ── Forms ── */
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-label { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #475569; }
  .form-input, .form-select { padding: 10px 12px; background: #0B1121; border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; color: #f8fafc; font-size: 13px; font-family: 'Manrope', sans-serif; outline: none; transition: border-color 0.15s, box-shadow 0.15s; width: 100%; }
  .form-input:focus, .form-select:focus { border-color: rgba(37,99,235,0.5); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
  .form-select { appearance: none; cursor: pointer; }
  .form-input::placeholder { color: #334155; }
  .form-textarea { padding: 10px 12px; background: #0B1121; border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; color: #f8fafc; font-size: 12px; font-family: 'JetBrains Mono', monospace; outline: none; transition: border-color 0.15s; width: 100%; resize: vertical; line-height: 1.6; }
  .form-textarea:focus { border-color: rgba(37,99,235,0.5); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }

  /* ── Toast ── */
  .toast { position: fixed; bottom: 80px; right: 16px; z-index: 200; background: #1e293b; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #f8fafc; box-shadow: 0 8px 24px rgba(0,0,0,0.4); animation: toastIn 0.2s ease; max-width: 280px; }
  @keyframes toastIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

  /* ── Detail Panel ── */
  .detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(3px); z-index: 80; display: flex; justify-content: flex-end; }
  .detail-panel { width: 440px; background: #161f32; border-left: 1px solid rgba(255,255,255,0.08); height: 100%; overflow-y: auto; display: flex; flex-direction: column; animation: slideIn 0.2s ease; }
  @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }
  .detail-header { padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; position: sticky; top: 0; background: #161f32; z-index: 1; }
  .detail-title { font-size: 17px; font-weight: 700; color: #f8fafc; }
  .detail-meta { font-size: 11px; color: #475569; margin-top: 3px; }
  .detail-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
  .detail-section-title { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #475569; margin-bottom: 10px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .info-label { font-size: 10px; color: #475569; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
  .info-value { font-size: 13px; color: #f8fafc; margin-top: 2px; font-weight: 500; word-break: break-word; }

  /* ── Tasks ── */
  .task-list { display: flex; flex-direction: column; gap: 6px; }
  .task-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(11,17,33,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 7px; transition: background 0.1s; }
  .task-item:hover { background: rgba(30,41,59,0.5); }
  .task-checkbox { width: 20px; height: 20px; border-radius: 5px; border: 1.5px solid rgba(255,255,255,0.2); background: transparent; cursor: pointer; flex-shrink: 0; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
  .task-checkbox.done { background: #10b981; border-color: #10b981; }
  .task-name { flex: 1; font-size: 13px; color: #cbd5e1; }
  .task-name.done { text-decoration: line-through; color: #475569; }
  .task-delete { background: none; border: none; color: #334155; cursor: pointer; padding: 4px; border-radius: 3px; transition: color 0.1s; font-size: 14px; }
  .task-delete:hover { color: #ef4444; }
  .add-task-row { display: flex; gap: 8px; margin-top: 4px; }
  .add-task-input { flex: 1; padding: 10px 12px; background: rgba(11,17,33,0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #f8fafc; font-size: 14px; font-family: 'Manrope', sans-serif; outline: none; }
  .add-task-input:focus { border-color: rgba(37,99,235,0.4); }
  .task-progress { height: 3px; background: rgba(255,255,255,0.07); border-radius: 2px; margin-bottom: 10px; }
  .task-progress-bar { height: 100%; background: #10b981; border-radius: 2px; transition: width 0.3s; }
  .task-progress-label { font-size: 10px; color: #475569; margin-bottom: 6px; }

  /* ── Follow-up cards ── */
  .seq-card { background: #161f32; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; overflow: hidden; transition: border-color 0.2s; }
  .seq-card:hover { border-color: rgba(255,255,255,0.14); }
  .seq-card-header { display: flex; align-items: center; gap: 14px; padding: 16px 18px; }
  .seq-trigger-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
  .seq-step-pill { width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .seq-connector { width: 12px; height: 1px; background: rgba(255,255,255,0.12); flex-shrink: 0; }
  .seq-preview { border-top: 1px solid rgba(255,255,255,0.07); padding: 14px 18px; display: flex; flex-direction: column; gap: 8px; }
  .seq-step-preview { background: #0B1121; border: 1px solid rgba(255,255,255,0.07); border-radius: 7px; padding: 10px 14px; }

  /* ── Stats grid ── */
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
  .stat-card { background: #161f32; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 18px 20px; }
  .stat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; margin-bottom: 10px; }
  .stat-value { font-size: 28px; font-weight: 700; color: #f8fafc; font-family: 'JetBrains Mono', monospace; }

  /* ── Clients table ── */
  .clients-table-wrap { background: #161f32; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; overflow: hidden; }
  .clients-table-header { padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; justify-content: space-between; }

  /* ── Trigger grid ── */
  .trigger-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .trigger-btn { background: #0B1121; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px 16px; cursor: pointer; text-align: left; transition: border-color 0.2s; }
  .trigger-btn:hover { border-color: rgba(255,255,255,0.2); }

  /* ── Login ── */
  .login-page { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0B1121; padding: 20px; }
  .login-card { background: #161f32; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 40px; width: 100%; max-width: 380px; box-shadow: 0 24px 48px rgba(0,0,0,0.5); }
  .login-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
  .login-logo img { width: 36px; height: 36px; }
  .login-logo-text { line-height: 1.2; }
  .login-logo-name { font-size: 14px; font-weight: 700; color: #f8fafc; }
  .login-title { font-size: 20px; font-weight: 700; color: #f8fafc; margin-bottom: 24px; }
  .login-form { display: flex; flex-direction: column; gap: 14px; }
  .login-error { padding: 10px 12px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 7px; font-size: 12px; color: #ef4444; margin-bottom: 8px; }
  .btn-login { padding: 11px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; font-family: 'Manrope', sans-serif; cursor: pointer; transition: background 0.15s; }
  .btn-login:hover { background: #3b82f6; }
  .btn-login:disabled { opacity: 0.6; cursor: not-allowed; }
  .logout-btn { display: flex; align-items: center; gap: 7px; width: 100%; padding: 9px 10px; margin-top: auto; border: none; background: none; color: #475569; font-size: 12px; font-weight: 500; font-family: 'Manrope', sans-serif; cursor: pointer; border-radius: 7px; transition: all 0.15s; text-align: left; }
  .logout-btn:hover { color: #ef4444; background: rgba(239,68,68,0.08); }

  /* ── FAB ── */
  .fab { display: none; position: fixed; bottom: 72px; right: 16px; z-index: 55; width: 52px; height: 52px; border-radius: 50%; background: #2563eb; color: white; border: none; cursor: pointer; font-size: 24px; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(37,99,235,0.5); transition: background 0.15s; }
  .fab:active { background: #3b82f6; }

  .loading { display: flex; align-items: center; justify-content: center; height: 100%; color: #475569; font-size: 14px; }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .sidebar { display: none; }
    .bottom-nav { display: block; }
    .fab { display: flex; }
    .main-header { padding: 16px 16px 0; }
    .page-title { font-size: 20px; }
    .main-content { padding: 14px 16px 80px; }
    .table-wrap { display: none; }
    .clinic-card-list { display: flex; }
    .search-wrap { flex: 1 1 100%; }
    .filter-select { flex: 1; min-width: 0; font-size: 12px; }
    .btn-primary.header-add-btn { display: none; }
    .detail-panel { width: 100%; border-left: none; }
    .modal-overlay { align-items: flex-end; padding: 0; }
    .modal { border-radius: 16px 16px 0 0; max-height: 92vh; }
    .form-row { grid-template-columns: 1fr; }
    .form-row-3 { grid-template-columns: 1fr 1fr; }
    .clinic-card { min-width: 0; max-width: 100%; width: 100%; }
    .stage-cards { flex-direction: column; }
    .toast { bottom: 72px; right: 12px; left: 12px; max-width: none; text-align: center; }
    .stats-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
    .trigger-grid { grid-template-columns: 1fr; }
  }
  @media (min-width: 769px) {
    .toast { bottom: 24px; right: 24px; }
  }
`;

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icon = {
  Dashboard: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>),
  Pipeline: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>),
  Followup: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>),
  Plus: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  Search: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>),
  Edit: () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
  Trash: () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>),
  X: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
  Check: () => (<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>),
  ExternalLink: () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>),
  ChevronRight: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>),
  ChevronDown: () => (<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>),
  Clinic: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>),
  Mail: () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>),
  Sms: () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>),
  Play: () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>),
  Pause: () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>),
  ArrowLeft: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>),
  Users: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  Zap: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>),
  Logout: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>),
};

// ─── Shared Components ────────────────────────────────────────────────────────

function StatusDropdown({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const c = STATUS_COLORS[status] || STATUS_COLORS.lead;
  const dot = STAGE_DOT_COLOR[status] || "#94a3b8";
  useEffect(() => {
    if (!open) return;
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);
  return (
    <div className="status-dropdown-wrap" ref={ref}>
      <span className="status-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }} onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>
        <span className="status-dot" style={{ background: dot }} />{stageLabel(status)}<span style={{ marginLeft: 2, opacity: 0.5, display: "flex" }}><Icon.ChevronDown /></span>
      </span>
      {open && (
        <div className="status-dropdown">
          {PIPELINE_STAGES.map(s => (
            <button key={s.id} className={"status-option" + (s.id === status ? " active" : "")} onClick={e => { e.stopPropagation(); onChange(s.id); setOpen(false); }}>
              <span className="status-option-dot" style={{ background: s.color }} />{s.label}
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
      <span className="status-dot" style={{ background: dot }} />{stageLabel(status)}
    </span>
  );
}

function FuBadge({ active }) {
  if (active === true) return <span className="fu-badge fu-badge-active">Active</span>;
  if (active === false) return <span className="fu-badge fu-badge-paused">Paused</span>;
  return <span className="fu-badge fu-badge-completed">Done</span>;
}

function Toast({ message, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast">✓ {message}</div>;
}

// ─── Clinic Form Modal ────────────────────────────────────────────────────────

const BLANK = { name: "", contact_name: "", contact_email: "", contact_phone: "", website: "", status: "lead", start_date: "" };

function ClinicModal({ clinic, onSave, onClose }) {
  const [form, setForm] = useState(clinic ? { ...clinic } : { ...BLANK });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
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
              <label className="form-label">Package</label>
              <select className="form-input" value={form.package || ""} onChange={e => set("package", e.target.value)}>
                <option value="">Select package...</option>
                <optgroup label="Individual Packages">{PACKAGES.individual.map(p => <option key={p} value={p}>{p}</option>)}</optgroup>
                <optgroup label="Bundles">{PACKAGES.bundles.map(p => <option key={p} value={p}>{p}</option>)}</optgroup>
              </select>
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

function DetailPanel({ clinic, onClose, onUpdate, onTriggerManual }) {
  const [newAlignmentTask, setNewAlignmentTask] = useState("");
  const [newClinicTask, setNewClinicTask] = useState("");
  const [expandedSections, setExpandedSections] = useState({});
  
  const alignmentTasks = clinic.alignmentTasks || [];
  const clinicTasks = clinic.clinicTasks || [];
  const allTasks = [...alignmentTasks, ...clinicTasks];
  const done = allTasks.filter(t => t.done).length;
  const pct = allTasks.length ? Math.round((done / allTasks.length) * 100) : 0;
  
  const toggleSection = key => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  const alignmentSections = [...new Set(alignmentTasks.map(t => t.section).filter(Boolean))];
  const clinicSections = [...new Set(clinicTasks.map(t => t.section).filter(Boolean))];

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
          {/* Active Automation Integration */}
          {clinic.activeSequenceId ? (
            <div style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div className="detail-section-title" style={{ color: '#60a5fa', marginBottom: 8 }}>Active Automation</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
                    {clinic.activeSequenceId === 'seq_1' ? "New Client Welcome" : "Active Sequence"}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                    Started {formatDate(clinic.sequenceStartedAt)}
                  </div>
                </div>
                <button className="btn-ghost" style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                  onClick={() => onUpdate({ ...clinic, activeSequenceId: null })}>
                  Stop
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onTriggerManual(clinic)}>
                <Icon.Zap /> Start Follow-up Sequence
              </button>
            </div>
          )}

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
            </div>
          </div>

          <div>
            <div className="detail-section-title">Onboarding Progress ({done}/{allTasks.length})</div>
            {allTasks.length > 0 && (
              <>
                <div className="task-progress-label">{pct}% complete</div>
                <div className="task-progress"><div className="task-progress-bar" style={{ width: pct + "%" }} /></div>
              </>
            )}
          </div>
          
          {/* Task Sections Loop */}
          {["alignment", "clinic"].map(type => {
            const tasks = type === "alignment" ? alignmentTasks : clinicTasks;
            const sections = type === "alignment" ? alignmentSections : clinicSections;
            const label = type === "alignment" ? "🧑‍💻 Alignment Automations" : "🏥 Clinic";
            return (
              <div key={type} style={{ marginTop: 20 }}>
                <div className="detail-section-title">{label}</div>
                {sections.map(section => (
                  <div key={section} style={{ marginBottom: 10 }}>
                    <div onClick={() => toggleSection(type + "-" + section)} style={{ display: "flex", alignItems: "center", padding: "8px 10px", background: "rgba(11,17,33,0.6)", borderRadius: 6, cursor: "pointer" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#cbd5e1", flex: 1 }}>{section}</span>
                    </div>
                    {expandedSections[type + "-" + section] && (
                      <div className="task-list" style={{ marginTop: 6 }}>
                        {tasks.filter(t => t.section === section).map(t => (
                          <div key={t.id} className="task-item">
                            <div className={"task-checkbox" + (t.done ? " done" : "")} onClick={() => {
                              const updated = tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x);
                              onUpdate({ ...clinic, [type === "alignment" ? "alignmentTasks" : "clinicTasks"]: updated });
                            }}>{t.done && <Icon.Check />}</div>
                            <span className={"task-name" + (t.done ? " done" : "")}>{t.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Clinic Name</th><th>Contact</th><th>Phone</th><th>Status</th><th>Start Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon">🏥</div><div className="empty-title">{clinics.length === 0 ? "No clinics yet" : "No results found"}</div><div className="empty-sub">{clinics.length === 0 ? "Click 'Add Clinic' to get started" : "Try adjusting your search or filter"}</div></div></td></tr>
              ) : filtered.map(c => (
                <tr key={c.id}>
                  <td><div className="clinic-name-cell"><span className="clinic-name-text">{c.name}</span><span className="link-icon" onClick={() => onSelect(c)}><Icon.ExternalLink /></span></div></td>
                  <td><div className="contact-name">{c.contact_name || "—"}</div>{c.contact_email && <div className="contact-email">{c.contact_email}</div>}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{c.contact_phone || "—"}</td>
                  <td><StatusDropdown status={c.status} onChange={s => onStatusChange(c.id, s)} /></td>
                  <td style={{ fontSize: 12, color: "#64748b" }}>{formatDate(c.start_date)}</td>
                  <td><div className="actions-cell"><button className="btn-ghost" onClick={() => onEdit(c)} style={{ padding: "5px 8px" }}><Icon.Edit /></button><button className="btn-danger" onClick={() => onDelete(c.id)}><Icon.Trash /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="clinic-card-list">
          {filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🏥</div><div className="empty-title">{clinics.length === 0 ? "No clinics yet" : "No results found"}</div><div className="empty-sub">{clinics.length === 0 ? "Tap + to add a clinic" : "Try adjusting your search or filter"}</div></div>
          ) : filtered.map(c => (
            <div key={c.id} className="clinic-list-card" onClick={() => onSelect(c)}>
              <div className="clinic-list-card-icon"><Icon.Clinic /></div>
              <div className="clinic-list-card-body"><div className="clinic-list-card-name">{c.name}</div><div className="clinic-list-card-sub">{c.contact_name || "—"}</div></div>
              <div className="clinic-list-card-right">
                <div onClick={e => e.stopPropagation()}><StatusDropdown status={c.status} onChange={s => onStatusChange(c.id, s)} /></div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn-ghost" onClick={e => { e.stopPropagation(); onEdit(c); }} style={{ padding: "4px 8px", fontSize: 11 }}><Icon.Edit /></button>
                  <button className="btn-danger" onClick={e => { e.stopPropagation(); onDelete(c.id); }}><Icon.Trash /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Pipeline View ────────────────────────────────────────────────────────────

function PipelineView({ clinics, onSelect, onStatusChange }) {
  const [open, setOpen] = useState(() => { const m = {}; PIPELINE_STAGES.forEach(s => { m[s.id] = true; }); return m; });
  const [dragOver, setDragOver] = useState(null);
  const [dragging, setDragging] = useState(null);
  const dragId = useRef(null);
  const toggle = id => setOpen(o => ({ ...o, [id]: !o[id] }));
  return (
    <>
      <div className="main-header">
        <div><div className="page-title">Pipeline</div><div className="page-subtitle">Drag cards between stages · click to open details</div></div>
      </div>
      <div className="main-content">
        <div className="pipeline-list">
          {PIPELINE_STAGES.map(stage => {
            const stageClinics = clinics.filter(c => c.status === stage.id);
            const isOpen = open[stage.id];
            const isOver = dragOver === stage.id;
            return (
              <div key={stage.id} className={"stage-row" + (isOver ? " drag-over" : "")}
                onDragOver={e => { e.preventDefault(); setDragOver(stage.id); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
                onDrop={e => { e.preventDefault(); if (dragId.current) { onStatusChange(dragId.current, stage.id); dragId.current = null; } setDragOver(null); setDragging(null); }}>
                <div className="stage-header" onClick={() => toggle(stage.id)}>
                  <span className={"stage-chevron" + (isOpen ? " open" : "")}><Icon.ChevronRight /></span>
                  <span className="stage-dot" style={{ background: stage.color }} />
                  <span className="stage-label">{stage.label}</span>
                  <span className={"stage-count" + (stageClinics.length === 0 ? " zero" : "")}>{stageClinics.length}</span>
                </div>
                {isOpen && (stageClinics.length > 0 ? (
                  <div className="stage-cards">
                    {stageClinics.map(c => (
                      <div key={c.id} className={"clinic-card" + (dragging === c.id ? " dragging" : "")} style={{ borderLeftColor: stage.color }}
                        draggable onDragStart={e => { dragId.current = c.id; setDragging(c.id); e.dataTransfer.effectAllowed = "move"; }}
                        onDragEnd={() => { dragId.current = null; setDragging(null); setDragOver(null); }}
                        onClick={() => onSelect(c)}>
                        <div className="card-icon"><Icon.Clinic /></div>
                        <div className="card-info"><div className="card-name">{c.name}</div><div className="card-contact">{c.contact_name || "—"}</div><div className="card-date">{formatDate(c.start_date)}</div></div>
                      </div>
                    ))}
                  </div>
                ) : (<div className="stage-drop-hint">Drop a clinic here to move it to {stage.label}</div>))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Follow-up: Sequence Editor Modal ────────────────────────────────────────

function SequenceEditorModal({ seq, onSave, onClose }) {
  const [form, setForm] = useState(seq || { id: `seq_${Date.now()}`, name: "", trigger: "new_client", active: true, steps: [] });
  const [editingStep, setEditingStep] = useState(null);

  const addStep = () => {
    const s = { id: `step_${Date.now()}`, delay: 1, delayUnit: "days", channel: "email", subject: "", body: "" };
    setForm(f => ({ ...f, steps: [...f.steps, s] }));
    setEditingStep(s.id);
  };
  const updateStep = (id, patch) => setForm(f => ({ ...f, steps: f.steps.map(s => s.id === id ? { ...s, ...patch } : s) }));
  const removeStep = id => { setForm(f => ({ ...f, steps: f.steps.filter(s => s.id !== id) })); if (editingStep === id) setEditingStep(null); };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{seq ? "Edit Sequence" : "New Sequence"}</span>
          <button className="modal-close" onClick={onClose}><Icon.X /></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Sequence Name</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. New Client Welcome" />
            </div>
            <div className="form-group">
              <label className="form-label">Trigger</label>
              <select className="form-select" value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}>
                {TRIGGER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <label className="form-label" style={{ margin: 0 }}>Steps ({form.steps.length})</label>
              <button className="btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} onClick={addStep}><Icon.Plus /> Add Step</button>
            </div>
            {form.steps.length === 0 && (
              <div style={{ border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 8, padding: 20, textAlign: "center", color: "#475569", fontSize: 13 }}>No steps yet — add your first message above</div>
            )}
            {form.steps.map((step, idx) => (
              <div key={step.id} style={{ border: `1px solid ${editingStep === step.id ? "#3b82f6" : "rgba(255,255,255,0.08)"}`, borderRadius: 8, marginBottom: 8, overflow: "hidden", transition: "border-color 0.2s" }}>
                <div onClick={() => setEditingStep(editingStep === step.id ? null : step.id)} style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: "#0B1121" }}>
                  <span style={{ color: "#475569", fontSize: 11, fontFamily: "monospace", minWidth: 18 }}>#{idx + 1}</span>
                  <span style={{ color: step.channel === "email" ? "#60a5fa" : "#a78bfa" }}>{step.channel === "email" ? <Icon.Mail /> : <Icon.Sms />}</span>
                  <span style={{ color: "#94a3b8", fontSize: 13, flex: 1 }}>{step.channel === "email" ? (step.subject || "No subject") : "SMS"} · Wait {step.delay} {step.delayUnit}</span>
                  <button onClick={e => { e.stopPropagation(); removeStep(step.id); }} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", padding: 4 }}><Icon.Trash /></button>
                </div>
                {editingStep === step.id && (
                  <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="form-row-3">
                      <div className="form-group">
                        <label className="form-label">Channel</label>
                        <select className="form-select" value={step.channel} onChange={e => updateStep(step.id, { channel: e.target.value })}><option value="email">Email</option><option value="sms">SMS</option></select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Wait</label>
                        <input type="number" min={0} className="form-input" value={step.delay} onChange={e => updateStep(step.id, { delay: Number(e.target.value) })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Unit</label>
                        <select className="form-select" value={step.delayUnit} onChange={e => updateStep(step.id, { delayUnit: e.target.value })}><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select>
                      </div>
                    </div>
                    {step.channel === "email" && (
                      <div className="form-group">
                        <label className="form-label">Subject</label>
                        <input className="form-input" value={step.subject} onChange={e => updateStep(step.id, { subject: e.target.value })} placeholder="Email subject line" />
                      </div>
                    )}
                    <div className="form-group">
                      <label className="form-label">Body <span style={{ color: "#334155", textTransform: "none", fontWeight: 400 }}>— use {"{{first_name}}"}, {"{{clinic_name}}"}</span></label>
                      <textarea className="form-textarea" rows={5} value={step.body} onChange={e => updateStep(step.id, { body: e.target.value })} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(form)}>Save Sequence</button>
        </div>
      </div>
    </div>
  );
}

// ─── Follow-up: Trigger Modal ─────────────────────────────────────────────────

function TriggerModal({ sequences, clinics, onClose, onLaunched }) {
  const [step, setStep] = useState(1);
  const [selectedTrigger, setSelectedTrigger] = useState(null);
  const [clientName, setClientName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedSeq, setSelectedSeq] = useState(null);
  const [done, setDone] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState("");

  const matchedSeqs = selectedTrigger ? sequences.filter(s => s.trigger === selectedTrigger.id && s.active) : [];

  const handleTriggerSelect = t => {
    setSelectedTrigger(t);
    const matched = sequences.filter(s => s.trigger === t.id && s.active);
    setSelectedSeq(matched[0]?.id || null);
    setStep(2);
  };

  const handleClinicSelect = id => {
    setSelectedClinic(id);
    const c = clinics.find(c => c.id === id);
    if (c) { setClientName(c.contact_name || ""); setClinicName(c.name || ""); setEmail(c.contact_email || ""); setPhone(c.contact_phone || ""); }
  };

  const handleLaunch = () => {
    setDone(true);
    setTimeout(() => { setDone(false); onLaunched && onLaunched(); onClose(); }, 1800);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {done ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(74,222,128,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#4ade80", fontSize: 28 }}>✓</div>
            <div style={{ color: "#f8fafc", fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Sequence Launched</div>
            <div style={{ color: "#64748b", fontSize: 13 }}>Messages will send on schedule</div>
          </div>
        ) : step === 1 ? (
          <>
            <div className="modal-header">
              <span className="modal-title">Select Trigger</span>
              <button className="modal-close" onClick={onClose}><Icon.X /></button>
            </div>
            <div className="modal-body">
              <div className="trigger-grid">
                {TRIGGER_TYPES.map(t => (
                  <button key={t.id} className="trigger-btn" onClick={() => handleTriggerSelect(t)}
                    onMouseEnter={e => e.currentTarget.style.borderColor = t.color}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}>
                    <div style={{ fontSize: 18, color: t.color, marginBottom: 6 }}>{t.icon}</div>
                    <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{t.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 0 }} onClick={() => setStep(1)}><Icon.ArrowLeft /></button>
                <span className="modal-title">Client Details</span>
              </div>
              <button className="modal-close" onClick={onClose}><Icon.X /></button>
            </div>
            <div className="modal-body">
              {clinics.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Import from CRM (optional)</label>
                  <select className="form-select" value={selectedClinic} onChange={e => handleClinicSelect(e.target.value)}>
                    <option value="">Select a clinic…</option>
                    {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-row">
                <div className="form-group"><label className="form-label">First Name</label><input className="form-input" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Jane" /></div>
                <div className="form-group"><label className="form-label">Clinic Name</label><input className="form-input" value={clinicName} onChange={e => setClinicName(e.target.value)} placeholder="Wellness Chiro" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@clinic.com" /></div>
                <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000" /></div>
              </div>
              {matchedSeqs.length > 0 ? (
                <div className="form-group">
                  <label className="form-label">Sequence</label>
                  <select className="form-select" value={selectedSeq || ""} onChange={e => setSelectedSeq(e.target.value)}>
                    {matchedSeqs.map(s => <option key={s.id} value={s.id}>{s.name} ({s.steps.length} steps)</option>)}
                  </select>
                </div>
              ) : (
                <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: 12, color: "#f59e0b", fontSize: 13 }}>No active sequences for this trigger. Create one first.</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={handleLaunch} disabled={!clientName || !matchedSeqs.length}><Icon.Zap /> Launch</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Follow-up View ───────────────────────────────────────────────────────────

function FollowupView({ clinics }) {
  const [sequences, setSequences] = useState(DEFAULT_SEQUENCES);
  const [editingSeq, setEditingSeq] = useState(null);
  const [showNewSeq, setShowNewSeq] = useState(false);
  const [showTrigger, setShowTrigger] = useState(false);
  const [previewSeq, setPreviewSeq] = useState(null);
  const [fuTab, setFuTab] = useState("dashboard");

  // SEAMLESS INTEGRATION: Filter real clinics that have an active sequence
  const activeFollowups = clinics.filter(c => c.activeSequenceId);

  const saveSeq = seq => {
    setSequences(prev => {
      const exists = prev.find(s => s.id === seq.id);
      return exists ? prev.map(s => s.id === seq.id ? seq : s) : [...prev, seq];
    });
    setEditingSeq(null);
    setShowNewSeq(false);
  };

  return (
    <>
      <div className="main-header">
        <div>
          <div className="page-title">Follow-up System</div>
          <div className="page-subtitle">{activeFollowups.length} active automations</div>
        </div>
        <button className="btn-primary" onClick={() => setShowTrigger(true)}><Icon.Zap /> Trigger Follow-up</button>
      </div>
      <div className="main-content">
        <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: 0 }}>
          {[{ id: "dashboard", label: "Dashboard" }, { id: "sequences", label: "Sequences" }].map(t => (
            <button key={t.id} onClick={() => setFuTab(t.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 16px", fontSize: 13, fontWeight: 600, color: fuTab === t.id ? "#f8fafc" : "#475569", borderBottom: fuTab === t.id ? "2px solid #2563eb" : "2px solid transparent", marginBottom: -1 }}>{t.label}</button>
          ))}
        </div>

        {fuTab === "dashboard" && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label" style={{ color: "#3b82f6" }}>Active Sequences</div>
                <div className="stat-value">{activeFollowups.length}</div>
              </div>
            </div>

            <div className="clients-table-wrap">
              <div className="clients-table-header">
                <span style={{ color: "#f8fafc", fontWeight: 700, fontSize: 14 }}>Active Contacts</span>
              </div>
              <table>
                <thead>
                  <tr><th>Contact</th><th>Sequence</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {activeFollowups.length === 0 ? (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: '#475569', padding: '40px' }}>No active follow-ups found.</td></tr>
                  ) : activeFollowups.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: "#f8fafc" }}>{c.contact_name || c.name}</div>
                        <div style={{ color: "#475569", fontSize: 11 }}>{c.name}</div>
                      </td>
                      <td style={{ color: "#94a3b8" }}>{c.activeSequenceId === 'seq_1' ? "Welcome Sequence" : "Re-engagement"}</td>
                      <td><FuBadge active={true} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {fuTab === "sequences" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sequences.map(seq => (
              <div key={seq.id} className="seq-card">
                <div className="seq-card-header">
                  <div style={{ flex: 1 }}>
                    <span style={{ color: "#f8fafc", fontWeight: 700 }}>{seq.name}</span>
                  </div>
                  <button className="btn-ghost" onClick={() => setEditingSeq(seq)}><Icon.Edit /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(editingSeq || showNewSeq) && <SequenceEditorModal seq={editingSeq} onSave={saveSeq} onClose={() => { setEditingSeq(null); setShowNewSeq(false); }} />}
      {showTrigger && <TriggerModal sequences={sequences} clinics={clinics} onClose={() => setShowTrigger(false)} />}
    </>
  );
}


// ─── Login ────────────────────────────────────────────────────────────────────

function SimpleLogin({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const handleSubmit = e => {
    e.preventDefault();
    if (password === APP_PASSWORD) { localStorage.setItem("aa_auth", "1"); onLogin(); }
    else { setError("Incorrect password"); setPassword(""); }
  };
  return (
    <>
      <style>{css}</style>
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">
            <div className="login-logo-text"><div className="login-logo-name">Alignment Automations</div></div>
          </div>
          <div className="login-title">Enter Password</div>
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}
            <div className="form-group"><input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required autoFocus /></div>
            <button className="btn-login" type="submit">Sign in</button>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [authed, setAuthed] = useState(() => localStorage.getItem("aa_auth") === "1");
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [triggerForClinic, setTriggerForClinic] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!authed) { setLoading(false); return; }
    db.getAll().then(data => { setClinics(data || []); setLoading(false); }).catch(() => { setClinics([]); setLoading(false); });
  }, [authed]);

  const showToast = msg => setToast(msg);

  const handleStatusChange = useCallback(async (id, newStatus) => {
  setClinics(prev => prev.map(c => {
    if (c.id !== id) return c;
    
    let updates = { status: newStatus };

    // Seamless Integration: Auto-triggering sequences based on CRM status
    if (newStatus === "onboarding_sent") {
      updates.activeSequenceId = "seq_1"; // Connects to New Client Welcome
      updates.sequenceStartedAt = new Date().toISOString();
    }
    
    if (newStatus === "closed_lost") {
      updates.activeSequenceId = "seq_4"; // Connects to Gone Quiet
    }
    
    return { ...c, ...updates };
  }));
  // ... database update logic
}, []);



  const handleSave = useCallback(async form => {
    if (modal === "add") {
      const packageTasks = form.package ? getPackageTasks(form.package) : DEFAULT_TASKS;
      const alignmentTasks = packageTasks.alignment.map(t => ({ ...t, id: uid() }));
      const clinicTasks = packageTasks.clinic.map(t => ({ ...t, id: uid() }));
      const newClinic = { ...form, id: uid(), created_at: new Date().toISOString(), alignmentTasks, clinicTasks };
      setClinics(prev => [newClinic, ...prev]);
      try { await db.create(newClinic); } catch (_) {}
      showToast("Clinic added");
    } else {
      const updated = { ...form };
      setClinics(prev => prev.map(c => c.id === form.id ? { ...c, ...updated } : c));
      if (selected?.id === form.id) setSelected(s => ({ ...s, ...updated }));
      try { await db.update(form.id, updated); } catch (_) {}
      showToast("Changes saved");
    }
    setModal(null);
  }, [modal, selected]);

  const handleDelete = useCallback(async id => {
    setClinics(prev => prev.filter(c => c.id !== id));
    if (selected?.id === id) setSelected(null);
    try { await db.delete(id); } catch (_) {}
    showToast("Clinic removed");
  }, [selected]);

  const handleUpdate = useCallback(async updated => {
    setClinics(prev => prev.map(c => c.id === updated.id ? updated : c));
    setSelected(updated);
    try { await db.update(updated.id, { alignmentTasks: updated.alignmentTasks || [], clinicTasks: updated.clinicTasks || [] }); } catch (_) {}
  }, []);

  if (!authed) return <SimpleLogin onLogin={() => setAuthed(true)} />;
  if (loading) return <><style>{css}</style><div className="app"><div className="loading">Loading…</div></div></>;

  const handleLogout = () => { localStorage.removeItem("aa_auth"); setAuthed(false); setClinics([]); };

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-text"><div className="brand-name">Alignment</div><div className="brand-name">Automations</div></div>
          </div>
          <nav className="sidebar-nav">
            <div className="nav-section-label">CRM</div>
            <button className={"nav-item" + (page === "dashboard" ? " active" : "")} onClick={() => setPage("dashboard")}>
              <span className="nav-icon"><Icon.Dashboard /></span>Dashboard
            </button>
            <button className={"nav-item" + (page === "pipeline" ? " active" : "")} onClick={() => setPage("pipeline")}>
              <span className="nav-icon"><Icon.Pipeline /></span>Pipeline
            </button>
            <div className="nav-section-label" style={{ marginTop: 8 }}>Automation</div>
            <button className={"nav-item" + (page === "followup" ? " active" : "")} onClick={() => setPage("followup")}>
              <span className="nav-icon"><Icon.Followup /></span>Follow-up
            </button>
            <button className="logout-btn" onClick={handleLogout} style={{ marginTop: 16 }}>
              <Icon.Logout />Sign out
            </button>
          </nav>
        </aside>

        <main className="main">
          {page === "dashboard" && <DashboardView clinics={clinics} onAdd={() => setModal("add")} onEdit={c => setModal(c)} onDelete={handleDelete} onSelect={setSelected} onStatusChange={handleStatusChange} />}
          {page === "pipeline" && <PipelineView clinics={clinics} onSelect={setSelected} onStatusChange={handleStatusChange} />}
          {page === "followup" && <FollowupView clinics={clinics} />}
        </main>

        <nav className="bottom-nav">
          <div className="bottom-nav-inner">
            <button className={"bottom-nav-item" + (page === "dashboard" ? " active" : "")} onClick={() => setPage("dashboard")}><Icon.Dashboard /><span>Clinics</span></button>
            <button className={"bottom-nav-item" + (page === "pipeline" ? " active" : "")} onClick={() => setPage("pipeline")}><Icon.Pipeline /><span>Pipeline</span></button>
            <button className={"bottom-nav-item" + (page === "followup" ? " active" : "")} onClick={() => setPage("followup")}><Icon.Followup /><span>Follow-up</span></button>
            <button className="bottom-nav-item" onClick={handleLogout}><Icon.Logout /><span>Sign out</span></button>
          </div>
        </nav>

        <button className="fab" onClick={() => setModal("add")}>＋</button>
        {modal && <ClinicModal clinic={modal === "add" ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />}
        {selected && (
  <DetailPanel 
    clinic={selected} 
    onClose={() => setSelected(null)} 
    onUpdate={handleUpdate}
    // This is the bridge: it closes the CRM panel and opens the Follow-up trigger
    onTriggerManual={(c) => {
      setSelected(null);
      setTriggerForClinic(c); 
    }}
  />
)}

   {toast && <Toast message={toast} onDone={() => setToast(null)} />}
        
        {/* ADD THIS MODAL RENDER AT THE BOTTOM TOO */}
        {triggerForClinic && (
          <TriggerModal 
            sequences={DEFAULT_SEQUENCES} 
            clinics={clinics} 
            preSelectedClinicId={triggerForClinic.id}
            onClose={() => setTriggerForClinic(null)} 
          />
        )}
      </div>
    </>
  );
}

