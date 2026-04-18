import { useState, useEffect, useCallback, useRef } from "react";

// ─── Pipeline ─────────────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { id: "lead",             label: "Lead",              color: "#94a3b8" },
  { id: "demo_booked",      label: "Demo Booked",       color: "#f59e0b" },
  { id: "demo_done",        label: "Demo Done",         color: "#f59e0b" },
  { id: "yes_closed_won",   label: "Yes / Closed-Won",  color: "#10b981" },
  { id: "onboarding_sent",  label: "Onboarding Sent",   color: "#3b82f6" },
  { id: "build_in_progress",label: "Build In Progress", color: "#8b5cf6" },
  { id: "testing",          label: "Testing",           color: "#f97316" },
  { id: "live",             label: "Live",              color: "#10b981" },
  { id: "monthly_support",  label: "Monthly Support",   color: "#06b6d4" },
  { id: "closed_lost",      label: "Closed-Lost",       color: "#ef4444" },
];

const STATUS_COLORS = {
  lead:             { bg:"rgba(148,163,184,0.15)", text:"#94a3b8", border:"rgba(148,163,184,0.4)" },
  demo_booked:      { bg:"rgba(245,158,11,0.15)",  text:"#f59e0b", border:"rgba(245,158,11,0.4)"  },
  demo_done:        { bg:"rgba(245,158,11,0.15)",  text:"#f59e0b", border:"rgba(245,158,11,0.4)"  },
  yes_closed_won:   { bg:"rgba(16,185,129,0.15)",  text:"#10b981", border:"rgba(16,185,129,0.4)"  },
  onboarding_sent:  { bg:"rgba(234,179,8,0.15)",   text:"#eab308", border:"rgba(234,179,8,0.4)"   },
  build_in_progress:{ bg:"rgba(139,92,246,0.15)",  text:"#8b5cf6", border:"rgba(139,92,246,0.4)"  },
  testing:          { bg:"rgba(249,115,22,0.15)",  text:"#f97316", border:"rgba(249,115,22,0.4)"  },
  live:             { bg:"rgba(16,185,129,0.15)",  text:"#10b981", border:"rgba(16,185,129,0.4)"  },
  monthly_support:  { bg:"rgba(6,182,212,0.15)",   text:"#06b6d4", border:"rgba(6,182,212,0.4)"   },
  closed_lost:      { bg:"rgba(239,68,68,0.15)",   text:"#ef4444", border:"rgba(239,68,68,0.4)"   },
};

const STAGE_DOT = {
  lead:"#94a3b8", demo_booked:"#f59e0b", demo_done:"#f59e0b", yes_closed_won:"#10b981",
  onboarding_sent:"#eab308", build_in_progress:"#8b5cf6", testing:"#f97316",
  live:"#10b981", monthly_support:"#06b6d4", closed_lost:"#ef4444",
};

// When a clinic moves to these stages, auto-suggest a follow-up trigger
const STAGE_AUTO_TRIGGER = {
  yes_closed_won:  "new_client",
  onboarding_sent: "new_client",
  live:            "new_client",
  monthly_support: "no_activity",
  closed_lost:     "no_activity",
};

// ─── Checklist Modules ────────────────────────────────────────────────────────

const MODULES = {
  A: {
    clinic: [
      { name:"Create Calendly account",                                    done:false, section:"Accounts & Access" },
      { name:"Connect calendar to Calendly",                               done:false, section:"Accounts & Access" },
      { name:"Set appointment availability",                               done:false, section:"Accounts & Access" },
      { name:"Create intake form tool (Google Forms / Tally / Typeform)",  done:false, section:"Accounts & Access" },
      { name:"Create Zapier or Make account",                              done:false, section:"Accounts & Access" },
      { name:"Provide master contact email",                               done:false, section:"Accounts & Access" },
      { name:"Approve intake questions",                                   done:false, section:"Approvals"         },
      { name:"Approve confirmation message copy",                          done:false, section:"Approvals"         },
      { name:"Give admin access to Calendly",                              done:false, section:"Accounts & Access" },
      { name:"Give admin access to Form tool",                             done:false, section:"Accounts & Access" },
      { name:"Give admin access to Zapier/Make",                           done:false, section:"Accounts & Access" },
    ],
    alignment: [
      { name:"Confirm intake flow structure",                 done:false, section:"Build"            },
      { name:"Create intake form",                            done:false, section:"Build"            },
      { name:"Configure form validation",                     done:false, section:"Build"            },
      { name:"Create automation trigger",                     done:false, section:"Build"            },
      { name:"Build form to confirmation email automation",   done:false, section:"Build"            },
      { name:"Insert booking link into confirmation message", done:false, section:"Build"            },
      { name:"Configure internal notification email",         done:false, section:"Build"            },
      { name:"Create lead logging sheet or CRM entry",        done:false, section:"Build"            },
      { name:"Test form submission (desktop)",                done:false, section:"Testing & Launch" },
      { name:"Test form submission (mobile)",                 done:false, section:"Testing & Launch" },
      { name:"Confirm booking link works",                    done:false, section:"Testing & Launch" },
      { name:"Confirm calendar receives appointment",         done:false, section:"Testing & Launch" },
      { name:"Confirm notification email is received",        done:false, section:"Testing & Launch" },
      { name:"Mark system Ready for Launch",                  done:false, section:"Testing & Launch" },
      { name:"Send clinic walkthrough",                       done:false, section:"Testing & Launch" },
    ],
  },
  B: {
    clinic: [
      { name:"Create Twilio account",                       done:false, section:"Accounts & Access" },
      { name:"Purchase phone number",                       done:false, section:"Accounts & Access" },
      { name:"Register business profile (A2P if required)", done:false, section:"Accounts & Access" },
      { name:"Add Alignment Automations as admin",          done:false, section:"Accounts & Access" },
      { name:"Provide clinic booking link",                 done:false, section:"Accounts & Access" },
      { name:"Confirm call handling preference",            done:false, section:"Approvals"         },
    ],
    alignment: [
      { name:"Connect Twilio number",           done:false, section:"Build"            },
      { name:"Configure missed call detection", done:false, section:"Build"            },
      { name:"Create SMS response template",    done:false, section:"Build"            },
      { name:"Insert booking link in response", done:false, section:"Build"            },
      { name:"Configure response delay",        done:false, section:"Build"            },
      { name:"Configure spam filtering",        done:false, section:"Build"            },
      { name:"Create logging for phone leads",  done:false, section:"Build"            },
      { name:"Test missed call trigger",        done:false, section:"Testing & Launch" },
      { name:"Test SMS delivery",               done:false, section:"Testing & Launch" },
      { name:"Test booking link from text",     done:false, section:"Testing & Launch" },
      { name:"Confirm notification workflow",   done:false, section:"Testing & Launch" },
      { name:"Mark system Ready",               done:false, section:"Testing & Launch" },
    ],
  },
  C: {
    clinic: [
      { name:"Provide business name",                           done:false, section:"Accounts & Access" },
      { name:"Provide logo",                                    done:false, section:"Accounts & Access" },
      { name:"Provide services list",                           done:false, section:"Accounts & Access" },
      { name:"Provide service descriptions (or approve draft)", done:false, section:"Accounts & Access" },
      { name:"Provide contact information",                     done:false, section:"Accounts & Access" },
      { name:"Provide address",                                 done:false, section:"Accounts & Access" },
      { name:"Provide booking link",                            done:false, section:"Accounts & Access" },
      { name:"Approve website copy",                            done:false, section:"Approvals"         },
      { name:"Approve page structure",                          done:false, section:"Approvals"         },
    ],
    alignment: [
      { name:"Create website project",                done:false, section:"Build"            },
      { name:"Build homepage layout",                 done:false, section:"Build"            },
      { name:"Build services page",                   done:false, section:"Build"            },
      { name:"Build booking page",                    done:false, section:"Build"            },
      { name:"Build contact page",                    done:false, section:"Build"            },
      { name:"Insert booking call-to-action buttons", done:false, section:"Build"            },
      { name:"Optimize for mobile",                   done:false, section:"Build"            },
      { name:"Configure domain",                      done:false, section:"Build"            },
      { name:"Connect hosting",                       done:false, section:"Build"            },
      { name:"Test booking links",                    done:false, section:"Testing & Launch" },
      { name:"Test mobile layout",                    done:false, section:"Testing & Launch" },
      { name:"Publish website",                       done:false, section:"Testing & Launch" },
      { name:"Send review link",                      done:false, section:"Testing & Launch" },
      { name:"Mark Website Live",                     done:false, section:"Testing & Launch" },
    ],
  },
  D: {
    clinic: [
      { name:"Create Twilio account",                   done:false, section:"Accounts & Access" },
      { name:"Purchase phone number",                   done:false, section:"Accounts & Access" },
      { name:"Provide booking link",                    done:false, section:"Accounts & Access" },
      { name:"Give Alignment Automations admin access", done:false, section:"Accounts & Access" },
    ],
    alignment: [
      { name:"Connect Twilio number",           done:false, section:"Build"            },
      { name:"Configure missed-call trigger",   done:false, section:"Build"            },
      { name:"Create SMS auto-response",        done:false, section:"Build"            },
      { name:"Insert booking link",             done:false, section:"Build"            },
      { name:"Configure quiet hours if needed", done:false, section:"Build"            },
      { name:"Test missed call",                done:false, section:"Testing & Launch" },
      { name:"Test SMS delivery",               done:false, section:"Testing & Launch" },
      { name:"Confirm booking link works",      done:false, section:"Testing & Launch" },
      { name:"Mark Call Protection Active",     done:false, section:"Testing & Launch" },
    ],
  },
};

const PACKAGE_MODULES = {
  "Automation Core":           ["A"],
  "Intake Foundation":         ["A","C"],
  "Call Protection":           ["D"],
  "Call Capture":              ["B"],
  "Core + Call Protection":    ["A","D"],
  "Foundation + Core":         ["A","C"],
  "Full Intake Infrastructure":["A","B","C"],
};

function getPackageTasks(pkg) {
  const keys = PACKAGE_MODULES[pkg] || [];
  const al = [], cl = [];
  keys.forEach(k => { if (MODULES[k]) { al.push(...MODULES[k].alignment); cl.push(...MODULES[k].clinic); } });
  return { alignment: al, clinic: cl };
}

const DEFAULT_TASKS = {
  alignment: [
    { name:"Define project scope", done:false, section:"Planning" },
    { name:"Gather requirements",  done:false, section:"Planning" },
    { name:"Build solution",       done:false, section:"Build"    },
    { name:"Test & QA",            done:false, section:"QA"       },
    { name:"Deploy",               done:false, section:"Launch"   },
  ],
  clinic: [
    { name:"Provide access",   done:false, section:"Setup"     },
    { name:"Review & approve", done:false, section:"Approvals" },
    { name:"Go live",          done:false, section:"Launch"    },
  ],
};

const PACKAGES = {
  individual: ["Automation Core","Intake Foundation","Call Protection","Call Capture"],
  bundles:    ["Core + Call Protection","Foundation + Core","Full Intake Infrastructure"],
};

// ─── Follow-up ────────────────────────────────────────────────────────────────

const TRIGGER_TYPES = [
  { id:"new_client",       label:"New Client Onboarded", icon:"\u2726", color:"#4ade80" },
  { id:"package_purchase", label:"Package Purchase",     icon:"\u25c8", color:"#60a5fa" },
  { id:"no_activity",      label:"No Activity",          icon:"\u25cc", color:"#f59e0b" },
  { id:"missed_call",      label:"Missed Call",          icon:"\u27f3", color:"#f87171" },
  { id:"form_inquiry",     label:"Form Inquiry",         icon:"\u25fb", color:"#a78bfa" },
  { id:"manual",           label:"Manual Trigger",       icon:"\u25c6", color:"#64748b" },
];

const DEFAULT_SEQUENCES = [
  { id:"seq_1", name:"New Client Welcome", trigger:"new_client", active:true, steps:[
    { id:"s1", delay:0,  delayUnit:"hours",   channel:"email",
      subject:"Welcome to {{clinic_name}} \u2014 You\'re all set",
      body:"Hi {{first_name}},\n\nWelcome aboard! Your intake system is live.\n\n\u2192 Booking link active\n\u2192 Leads captured automatically\n\u2192 Weekly summary incoming\n\nAny questions? Reply anytime.\n\n\u2014 Alignment Automations" },
    { id:"s2", delay:2,  delayUnit:"days",    channel:"sms",   subject:"",
      body:"Hey {{first_name}}, your system has been live 2 days \u2014 seeing new inquiries? Let us know if you need anything. \u2014 Alignment Automations" },
    { id:"s3", delay:7,  delayUnit:"days",    channel:"email",
      subject:"Your first week \u2014 how\'s it going?",
      body:"Hi {{first_name}},\n\nOne week in \u2014 intake, confirmations, and call capture should all be running. If anything feels off, let\'s jump on a call.\n\n\u2014 Alignment Automations" },
  ]},
  { id:"seq_2", name:"Missed Call Recovery", trigger:"missed_call", active:true, steps:[
    { id:"s4", delay:5,  delayUnit:"minutes", channel:"sms",   subject:"",
      body:"Hi {{first_name}}, sorry we missed your call! Book a time: https://calendly.com/alignment-automations/new-meeting" },
    { id:"s5", delay:1,  delayUnit:"days",    channel:"email",
      subject:"We missed you \u2014 let\'s connect",
      body:"Hi {{first_name}},\n\nWe missed your call. Grab 15 minutes:\nhttps://calendly.com/alignment-automations/new-meeting\n\n\u2014 Alignment Automations" },
  ]},
  { id:"seq_3", name:"Form Inquiry Follow-up", trigger:"form_inquiry", active:true, steps:[
    { id:"s6", delay:10, delayUnit:"minutes", channel:"email",
      subject:"Got your message \u2014 here\'s what\'s next",
      body:"Hi {{first_name}},\n\nThanks for reaching out! Book a discovery call:\nhttps://calendly.com/alignment-automations/new-meeting\n\n\u2014 Alignment Automations" },
    { id:"s7", delay:30, delayUnit:"minutes", channel:"sms",   subject:"",
      body:"Hey {{first_name}}! Got your inquiry. Book here: https://calendly.com/alignment-automations/new-meeting" },
  ]},
  { id:"seq_4", name:"Re-engagement", trigger:"no_activity", active:false, steps:[
    { id:"s8", delay:30, delayUnit:"days",    channel:"email",
      subject:"Still here if you need us",
      body:"Hi {{first_name}},\n\nJust checking in on {{clinic_name}} \u2014 if you have questions or want to explore new automations, we\'re available.\n\n\u2014 Alignment Automations" },
    { id:"s9", delay:45, delayUnit:"days",    channel:"sms",   subject:"",
      body:"Hey {{first_name}}, it\'s been a while! Want to revisit your setup? We\'re here. \u2014 Alignment Automations" },
  ]},
];

// ─── DB (Cloudflare D1 via Pages Functions) ───────────────────────────────────

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || "8n4kvkar";
const API_BASE = "/api";

const db = {
  async getAll() {
    const r = await fetch(`${API_BASE}/clinics`);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async create(c) {
    const r = await fetch(`${API_BASE}/clinics`, {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(c),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async update(id, p) {
    const r = await fetch(`${API_BASE}/clinics/${id}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(p),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async delete(id) {
    const r = await fetch(`${API_BASE}/clinics/${id}`, { method:"DELETE" });
    if (!r.ok) throw new Error(await r.text());
    return { success:true };
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }

function formatDate(iso) {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString("en-US",{ month:"short", day:"numeric", year:"numeric" });
}

function timeAgo(ts) {
  const d = Date.now() - ts, m = Math.floor(d/60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

function stageLabel(id) { return PIPELINE_STAGES.find(s => s.id === id)?.label ?? id; }
function getTrigger(id)  { return TRIGGER_TYPES.find(t => t.id === id) || TRIGGER_TYPES[5]; }

function renderBody(body, clinic) {
  return body
    .replace(/{{first_name}}/g,  clinic.contact_name?.split(" ")[0] || "there")
    .replace(/{{clinic_name}}/g, clinic.name || "your clinic");
}


// ─── CSS ──────────────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Manrope', sans-serif; background: #0B1121; color: #f8fafc; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

  .app { display: flex; height: 100vh; overflow: hidden; }

  .sidebar { width: 240px; min-width: 240px; background: #161f32; border-right: 1px solid rgba(255,255,255,0.07); display: flex; flex-direction: column; overflow: hidden; }
  .sidebar-brand { display: flex; align-items: center; gap: 10px; padding: 20px 18px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); }
  .brand-name { font-size: 13px; font-weight: 700; color: #f8fafc; line-height: 1.3; }
  .sidebar-nav { padding: 12px 10px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
  .nav-section-label { padding: 16px 10px 6px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #334155; }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 7px; cursor: pointer; font-size: 13px; font-weight: 500; color: #64748b; transition: all 0.15s; border: none; background: none; width: 100%; text-align: left; position: relative; font-family: 'Manrope', sans-serif; }
  .nav-item:hover { color: #94a3b8; background: rgba(255,255,255,0.04); }
  .nav-item.active { color: #f8fafc; background: rgba(37,99,235,0.12); }
  .nav-item.active::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 3px; height: 60%; background: #2563eb; border-radius: 0 2px 2px 0; }
  .nav-icon { opacity: 0.8; display: flex; flex-shrink: 0; }
  .nav-badge { margin-left: auto; min-width: 18px; height: 18px; padding: 0 5px; background: #2563eb; color: white; border-radius: 9px; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .logout-btn { display: flex; align-items: center; gap: 7px; width: 100%; padding: 9px 10px; margin-top: auto; border: none; background: none; color: #475569; font-size: 12px; font-weight: 500; font-family: 'Manrope', sans-serif; cursor: pointer; border-radius: 7px; transition: all 0.15s; }
  .logout-btn:hover { color: #ef4444; background: rgba(239,68,68,0.08); }

  .bottom-nav { display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 60; background: #161f32; border-top: 1px solid rgba(255,255,255,0.07); padding: 8px 0 max(8px, env(safe-area-inset-bottom)); }
  .bottom-nav-inner { display: flex; justify-content: space-around; }
  .bottom-nav-item { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 12px; border: none; background: none; cursor: pointer; color: #475569; font-size: 10px; font-weight: 600; font-family: 'Manrope', sans-serif; letter-spacing: 0.04em; text-transform: uppercase; transition: color 0.15s; }
  .bottom-nav-item.active { color: #3b82f6; }

  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
  .main-header { padding: 22px 28px 0; display: flex; align-items: flex-start; justify-content: space-between; flex-shrink: 0; gap: 12px; flex-wrap: wrap; }
  .page-title { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #f8fafc; }
  .page-subtitle { font-size: 12px; color: #475569; margin-top: 2px; font-weight: 500; }
  .main-content { flex: 1; overflow-y: auto; min-height: 0; padding: 20px 28px 28px; }

  .toolbar { display: flex; gap: 10px; margin-bottom: 16px; align-items: center; flex-wrap: wrap; }
  .search-wrap { position: relative; flex: 1; min-width: 160px; }
  .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #475569; pointer-events: none; }
  .search-input { width: 100%; padding: 9px 12px 9px 36px; background: #161f32; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #f8fafc; font-size: 13px; font-family: 'Manrope', sans-serif; outline: none; }
  .search-input::placeholder { color: #475569; }
  .search-input:focus { border-color: rgba(37,99,235,0.5); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
  .filter-select { padding: 9px 32px 9px 12px; background: #161f32; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #f8fafc; font-size: 13px; font-family: 'Manrope', sans-serif; outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; min-width: 140px; }

  .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'Manrope', sans-serif; cursor: pointer; white-space: nowrap; transition: background 0.15s; }
  .btn-primary:hover { background: #3b82f6; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-ghost { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; background: transparent; color: #64748b; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; font-size: 12px; font-family: 'Manrope', sans-serif; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
  .btn-ghost:hover { color: #f8fafc; border-color: rgba(255,255,255,0.2); }
  .btn-danger { display: inline-flex; align-items: center; padding: 6px 8px; background: transparent; color: #64748b; border: none; border-radius: 5px; cursor: pointer; transition: all 0.15s; }
  .btn-danger:hover { color: #ef4444; background: rgba(239,68,68,0.1); }
  .btn-success { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'Manrope', sans-serif; cursor: pointer; white-space: nowrap; transition: background 0.15s; }
  .btn-success:hover { background: #059669; }
  .btn-success:disabled { opacity: 0.4; cursor: not-allowed; }

  .table-wrap { background: #161f32; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 11px 16px; text-align: left; font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; background: #0d1526; border-bottom: 1px solid rgba(255,255,255,0.06); white-space: nowrap; }
  td { padding: 13px 16px; font-size: 13px; color: #cbd5e1; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tbody tr { transition: background 0.1s; }
  tbody tr:hover td { background: rgba(30,41,59,0.6); }
  .clinic-name-cell { display: flex; align-items: center; gap: 8px; }
  .clinic-name-text { font-weight: 600; color: #f8fafc; }
  .link-icon { color: #475569; cursor: pointer; transition: color 0.15s; display: flex; flex-shrink: 0; }
  .link-icon:hover { color: #3b82f6; }
  .actions-cell { display: flex; align-items: center; gap: 4px; opacity: 0; transition: opacity 0.15s; }
  tbody tr:hover .actions-cell { opacity: 1; }

  .clinic-card-list { display: none; flex-direction: column; gap: 8px; }
  .clinic-list-card { background: #161f32; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; }
  .clinic-list-card-icon { width: 38px; height: 38px; background: rgba(37,99,235,0.15); border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #3b82f6; }
  .clinic-list-card-body { flex: 1; min-width: 0; }
  .clinic-list-card-name { font-size: 14px; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .clinic-list-card-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
  .clinic-list-card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }

  .status-dropdown-wrap { position: relative; display: inline-flex; }
  .status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; border: 1px solid; white-space: nowrap; cursor: pointer; transition: opacity 0.15s; user-select: none; }
  .status-badge:hover { opacity: 0.8; }
  .status-badge-ro { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; border: 1px solid; white-space: nowrap; }
  .status-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .status-dropdown { position: absolute; top: calc(100% + 6px); left: 0; z-index: 50; background: #1e293b; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); overflow: hidden; min-width: 190px; animation: dropIn 0.12s ease; }
  @keyframes dropIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
  .status-option { display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: pointer; font-size: 12px; font-weight: 500; color: #cbd5e1; transition: background 0.1s; border: none; background: none; width: 100%; text-align: left; }
  .status-option:hover { background: rgba(255,255,255,0.06); color: #f8fafc; }
  .status-option.active { color: #f8fafc; background: rgba(37,99,235,0.15); }
  .status-option-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

  .fu-badge { display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
  .fu-active    { background: rgba(74,222,128,0.12);  color: #4ade80; }
  .fu-paused    { background: rgba(245,158,11,0.12);  color: #f59e0b; }
  .fu-done      { background: rgba(148,163,184,0.12); color: #94a3b8; }
  .fu-cancelled { background: rgba(239,68,68,0.12);   color: #ef4444; }

  .pipeline-list { display: flex; flex-direction: column; gap: 2px; }
  .stage-row { background: #161f32; border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; overflow: hidden; transition: border-color 0.15s, background 0.15s; }
  .stage-row.drag-over { border-color: #2563eb; background: rgba(37,99,235,0.05); }
  .stage-header { display: flex; align-items: center; gap: 12px; padding: 14px 18px; cursor: pointer; user-select: none; transition: background 0.1s; }
  .stage-header:hover { background: rgba(30,41,59,0.5); }
  .stage-chevron { color: #475569; transition: transform 0.2s; flex-shrink: 0; display: flex; }
  .stage-chevron.open { transform: rotate(90deg); }
  .stage-dot-lg { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
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

  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .modal { background: #161f32; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 48px rgba(0,0,0,0.6); animation: modalIn 0.2s ease; }
  .modal-lg { max-width: 760px; }
  @keyframes modalIn { from { opacity:0; transform:translateY(-10px) scale(0.98); } to { opacity:1; transform:none; } }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); position: sticky; top: 0; background: #161f32; z-index: 1; }
  .modal-title { font-size: 16px; font-weight: 700; color: #f8fafc; }
  .modal-close { background: none; border: none; color: #475569; cursor: pointer; padding: 4px; border-radius: 5px; transition: all 0.15s; display: flex; }
  .modal-close:hover { color: #f8fafc; background: rgba(255,255,255,0.07); }
  .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
  .modal-footer { padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.07); display: flex; justify-content: flex-end; gap: 10px; position: sticky; bottom: 0; background: #161f32; }

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

  .toast { position: fixed; bottom: 80px; right: 16px; z-index: 200; background: #1e293b; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #f8fafc; box-shadow: 0 8px 24px rgba(0,0,0,0.4); animation: toastIn 0.2s ease; max-width: 300px; }
  @keyframes toastIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }

  .detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(3px); z-index: 80; display: flex; justify-content: flex-end; }
  .detail-panel { width: 480px; background: #161f32; border-left: 1px solid rgba(255,255,255,0.08); height: 100%; overflow-y: auto; display: flex; flex-direction: column; animation: slideIn 0.2s ease; }
  @keyframes slideIn { from { transform:translateX(20px); opacity:0; } to { transform:none; opacity:1; } }
  .detail-header { padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; position: sticky; top: 0; background: #161f32; z-index: 1; }
  .detail-title { font-size: 17px; font-weight: 700; color: #f8fafc; }
  .detail-meta { font-size: 11px; color: #475569; margin-top: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .detail-tabs { display: flex; border-bottom: 1px solid rgba(255,255,255,0.07); padding: 0 20px; }
  .detail-tab { padding: 12px 14px; font-size: 13px; font-weight: 600; color: #475569; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.15s; font-family: 'Manrope', sans-serif; }
  .detail-tab:hover { color: #94a3b8; }
  .detail-tab.active { color: #f8fafc; border-bottom-color: #2563eb; }
  .detail-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; flex: 1; }
  .detail-section-title { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #475569; margin-bottom: 10px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .info-label { font-size: 10px; color: #475569; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
  .info-value { font-size: 13px; color: #f8fafc; margin-top: 2px; font-weight: 500; word-break: break-word; }

  .task-list { display: flex; flex-direction: column; gap: 6px; }
  .task-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(11,17,33,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 7px; transition: background 0.1s; }
  .task-item:hover { background: rgba(30,41,59,0.5); }
  .task-checkbox { width: 20px; height: 20px; border-radius: 5px; border: 1.5px solid rgba(255,255,255,0.2); background: transparent; cursor: pointer; flex-shrink: 0; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
  .task-checkbox.done { background: #10b981; border-color: #10b981; }
  .task-name { flex: 1; font-size: 13px; color: #cbd5e1; }
  .task-name.done { text-decoration: line-through; color: #475569; }
  .task-delete { background: none; border: none; color: #334155; cursor: pointer; padding: 4px; border-radius: 3px; transition: color 0.1s; }
  .task-delete:hover { color: #ef4444; }
  .add-task-row { display: flex; gap: 8px; margin-top: 4px; }
  .add-task-input { flex: 1; padding: 10px 12px; background: rgba(11,17,33,0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #f8fafc; font-size: 13px; font-family: 'Manrope', sans-serif; outline: none; }
  .add-task-input:focus { border-color: rgba(37,99,235,0.4); }
  .task-progress { height: 3px; background: rgba(255,255,255,0.07); border-radius: 2px; margin-bottom: 10px; }
  .task-progress-bar { height: 100%; background: #10b981; border-radius: 2px; transition: width 0.3s; }
  .task-progress-label { font-size: 10px; color: #475569; margin-bottom: 6px; }

  .fu-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; background: rgba(11,17,33,0.6); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; }
  .fu-row-body { flex: 1; min-width: 0; }
  .fu-row-name { font-size: 13px; font-weight: 600; color: #f8fafc; }
  .fu-row-meta { font-size: 11px; color: #475569; margin-top: 2px; }
  .fu-row-actions { display: flex; gap: 4px; flex-shrink: 0; align-items: flex-start; }

  .suggest-banner { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.25); border-radius: 8px; }
  .suggest-text { flex: 1; }
  .suggest-title { font-weight: 700; font-size: 13px; color: #bfdbfe; margin-bottom: 2px; }
  .suggest-body { font-size: 12px; color: #93c5fd; }

  .seq-card { background: #161f32; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; overflow: hidden; transition: border-color 0.2s; }
  .seq-card:hover { border-color: rgba(255,255,255,0.14); }
  .seq-card-header { display: flex; align-items: center; gap: 14px; padding: 16px 18px; }
  .seq-trigger-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
  .seq-step-pill { width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .seq-connector { width: 12px; height: 1px; background: rgba(255,255,255,0.12); flex-shrink: 0; }
  .seq-preview { border-top: 1px solid rgba(255,255,255,0.07); padding: 14px 18px; display: flex; flex-direction: column; gap: 8px; }
  .seq-step-preview { background: #0B1121; border: 1px solid rgba(255,255,255,0.07); border-radius: 7px; padding: 10px 14px; }

  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
  .stat-card { background: #161f32; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 18px 20px; }
  .stat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; margin-bottom: 10px; }
  .stat-value { font-size: 28px; font-weight: 700; color: #f8fafc; font-family: 'JetBrains Mono', monospace; }

  .trigger-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .trigger-btn { background: #0B1121; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px 16px; cursor: pointer; text-align: left; transition: border-color 0.2s; }

  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #475569; text-align: center; }
  .empty-icon { font-size: 36px; margin-bottom: 12px; opacity: 0.4; }
  .empty-title { font-size: 14px; font-weight: 600; color: #64748b; }
  .empty-sub { font-size: 12px; margin-top: 4px; }

  .login-page { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0B1121; padding: 20px; }
  .login-card { background: #161f32; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 40px; width: 100%; max-width: 380px; box-shadow: 0 24px 48px rgba(0,0,0,0.5); }
  .login-title { font-size: 20px; font-weight: 700; color: #f8fafc; margin-bottom: 24px; }
  .login-error { padding: 10px 12px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 7px; font-size: 12px; color: #ef4444; }
  .btn-login { padding: 11px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; font-family: 'Manrope', sans-serif; cursor: pointer; transition: background 0.15s; }
  .btn-login:hover { background: #3b82f6; }

  .fab { display: none; position: fixed; bottom: 72px; right: 16px; z-index: 55; width: 52px; height: 52px; border-radius: 50%; background: #2563eb; color: white; border: none; cursor: pointer; font-size: 24px; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(37,99,235,0.5); }
  .loading { display: flex; align-items: center; justify-content: center; height: 100%; color: #475569; font-size: 14px; }

  @media (max-width: 768px) {
    .sidebar { display: none; } .bottom-nav { display: block; } .fab { display: flex; }
    .main-header { padding: 16px 16px 0; } .page-title { font-size: 20px; } .main-content { padding: 14px 16px 80px; }
    .table-wrap { display: none; } .clinic-card-list { display: flex; }
    .search-wrap { flex: 1 1 100%; } .filter-select { flex: 1; min-width: 0; font-size: 12px; }
    .btn-primary.header-add-btn { display: none; }
    .detail-panel { width: 100%; border-left: none; }
    .modal-overlay { align-items: flex-end; padding: 0; } .modal { border-radius: 16px 16px 0 0; max-height: 92vh; }
    .form-row { grid-template-columns: 1fr; } .form-row-3 { grid-template-columns: 1fr 1fr; }
    .clinic-card { min-width: 0; max-width: 100%; width: 100%; } .stage-cards { flex-direction: column; }
    .toast { bottom: 72px; right: 12px; left: 12px; max-width: none; text-align: center; }
    .stats-grid { grid-template-columns: 1fr 1fr; gap: 10px; } .trigger-grid { grid-template-columns: 1fr; }
  }
  @media (min-width: 769px) { .toast { bottom: 24px; right: 24px; } }
`;


// ─── Icons ────────────────────────────────────────────────────────────────────

const Ic = {
  Dashboard:    () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Pipeline:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  Followup:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Plus:         () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Search:       () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Edit:         () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash:        () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  X:            () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Check:        () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  ExternalLink: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  ChevronRight: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
  ChevronDown:  () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>,
  Clinic:       () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  Mail:         () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Sms:          () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Play:         () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  Pause:        () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  Stop:         () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
  ArrowLeft:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  Zap:          () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Logout:       () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

// ─── Shared UI ────────────────────────────────────────────────────────────────

function StatusDropdown({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const c = STATUS_COLORS[status] || STATUS_COLORS.lead;
  const dot = STAGE_DOT[status] || "#94a3b8";
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div className="status-dropdown-wrap" ref={ref}>
      <span className="status-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>
        <span className="status-dot" style={{ background: dot }} />
        {stageLabel(status)}
        <span style={{ marginLeft: 2, opacity: 0.5, display: "flex" }}><Ic.ChevronDown /></span>
      </span>
      {open && (
        <div className="status-dropdown">
          {PIPELINE_STAGES.map(s => (
            <button key={s.id} className={"status-option" + (s.id === status ? " active" : "")}
              onClick={e => { e.stopPropagation(); onChange(s.id); setOpen(false); }}>
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
  const dot = STAGE_DOT[status] || "#94a3b8";
  return (
    <span className="status-badge-ro" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
      <span className="status-dot" style={{ background: dot }} />{stageLabel(status)}
    </span>
  );
}

function FuBadge({ fu }) {
  if (!fu) return null;
  const m = { active:"fu-active", paused:"fu-paused", completed:"fu-done", cancelled:"fu-cancelled" };
  const l = { active:"Active", paused:"Paused", completed:"Done", cancelled:"Cancelled" };
  return <span className={`fu-badge ${m[fu.status] || "fu-done"}`}>{l[fu.status] || fu.status}</span>;
}

function Toast({ message, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast">&#10003; {message}</div>;
}

// ─── Clinic Form Modal ────────────────────────────────────────────────────────

function ClinicModal({ clinic, onSave, onClose }) {
  const [form, setForm] = useState(clinic
    ? { ...clinic }
    : { name:"", contact_name:"", contact_email:"", contact_phone:"", website:"", status:"lead", start_date:"", package:"" }
  );
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{clinic ? "Edit Clinic" : "Add Clinic"}</span>
          <button className="modal-close" onClick={onClose}><Ic.X /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Clinic Name *</label>
            <input className="form-input" value={form.name} onChange={e => s("name", e.target.value)} placeholder="e.g. Spinal Health Center" />
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Contact Name</label><input className="form-input" value={form.contact_name} onChange={e => s("contact_name", e.target.value)} placeholder="Dr. Smith" /></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.contact_phone} onChange={e => s("contact_phone", e.target.value)} placeholder="(555) 000-0000" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={form.contact_email} onChange={e => s("contact_email", e.target.value)} placeholder="dr@clinic.com" /></div>
            <div className="form-group"><label className="form-label">Website</label><input className="form-input" value={form.website} onChange={e => s("website", e.target.value)} placeholder="https://clinic.com" /></div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Package</label>
              <select className="form-select" value={form.package || ""} onChange={e => s("package", e.target.value)}>
                <option value="">Select package...</option>
                <optgroup label="Individual">{PACKAGES.individual.map(p => <option key={p} value={p}>{p}</option>)}</optgroup>
                <optgroup label="Bundles">{PACKAGES.bundles.map(p => <option key={p} value={p}>{p}</option>)}</optgroup>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => s("status", e.target.value)}>
                {PIPELINE_STAGES.map(st => <option key={st.id} value={st.id}>{st.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input type="date" className="form-input" value={form.start_date} onChange={e => s("start_date", e.target.value)} />
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

// ─── Launch Modal ─────────────────────────────────────────────────────────────

function LaunchModal({ clinic, sequences, prefillTrigger, onLaunch, onClose }) {
  const [step, setStep] = useState(prefillTrigger ? 2 : 1);
  const [trigger, setTrigger] = useState(prefillTrigger || null);
  const [seqId, setSeqId] = useState(null);
  const [launched, setLaunched] = useState(false);

  const matched = trigger ? sequences.filter(s => s.trigger === trigger.id && s.active) : [];

  useEffect(() => {
    if (matched.length > 0 && !seqId) setSeqId(matched[0].id);
  }, [trigger]);

  const go = () => {
    const seq = sequences.find(s => s.id === seqId);
    if (!seq) return;
    const fu = {
      id: uid(), seqId: seq.id, seqName: seq.name, trigger: trigger.id,
      triggeredAt: Date.now(), status: "active", currentStep: 0, totalSteps: seq.steps.length,
      steps: seq.steps.map((s, i) => ({ ...s, sentAt: i === 0 ? Date.now() : null, status: i === 0 ? "sent" : "pending" })),
    };
    setLaunched(true);
    setTimeout(() => { onLaunch(fu); onClose(); }, 1600);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {launched ? (
          <div style={{ padding:"48px 24px", textAlign:"center" }}>
            <div style={{ width:56, height:56, borderRadius:"50%", background:"rgba(74,222,128,0.12)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", color:"#4ade80", fontSize:28 }}>&#10003;</div>
            <div style={{ color:"#f8fafc", fontWeight:700, fontSize:18, marginBottom:6 }}>Sequence Launched</div>
            <div style={{ color:"#64748b", fontSize:13 }}>Linked to {clinic.name}</div>
          </div>
        ) : step === 1 ? (
          <>
            <div className="modal-header">
              <span className="modal-title">Select Trigger</span>
              <button className="modal-close" onClick={onClose}><Ic.X /></button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize:13, color:"#64748b", marginBottom:4 }}>For <strong style={{ color:"#f8fafc" }}>{clinic.name}</strong></div>
              <div className="trigger-grid">
                {TRIGGER_TYPES.map(t => {
                  const has = sequences.some(s => s.trigger === t.id && s.active);
                  return (
                    <button key={t.id} className="trigger-btn"
                      style={{ opacity: has ? 1 : 0.35, cursor: has ? "pointer" : "not-allowed" }}
                      onClick={() => has && (setTrigger(t), setStep(2))}
                      onMouseEnter={e => has && (e.currentTarget.style.borderColor = t.color)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}>
                      <div style={{ fontSize:18, color:t.color, marginBottom:6 }}>{t.icon}</div>
                      <div style={{ color:"#e2e8f0", fontSize:13, fontWeight:600 }}>{t.label}</div>
                      {!has && <div style={{ fontSize:10, color:"#475569", marginTop:3 }}>No active sequence</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="modal-header">
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                {!prefillTrigger && (
                  <button style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", padding:0, display:"flex" }} onClick={() => setStep(1)}>
                    <Ic.ArrowLeft />
                  </button>
                )}
                <span className="modal-title">Confirm Launch</span>
              </div>
              <button className="modal-close" onClick={onClose}><Ic.X /></button>
            </div>
            <div className="modal-body">
              <div style={{ padding:"12px 14px", background:"rgba(11,17,33,0.6)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8 }}>
                <div style={{ fontSize:11, color:"#475569", textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700, marginBottom:6 }}>Clinic</div>
                <div style={{ fontWeight:700, color:"#f8fafc", fontSize:14 }}>{clinic.name}</div>
                <div style={{ color:"#64748b", fontSize:12, marginTop:2 }}>{clinic.contact_name || "&#8212;"} &middot; {clinic.contact_email || "no email"}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Sequence</label>
                <select className="form-select" value={seqId || ""} onChange={e => setSeqId(e.target.value)}>
                  {matched.map(s => <option key={s.id} value={s.id}>{s.name} ({s.steps.length} steps)</option>)}
                </select>
              </div>
              {seqId && (() => {
                const seq = sequences.find(s => s.id === seqId);
                return seq ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {seq.steps.map((s, i) => (
                      <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"rgba(11,17,33,0.6)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:7 }}>
                        <span style={{ color:"#475569", fontSize:11, fontFamily:"monospace", minWidth:16 }}>#{i+1}</span>
                        <span style={{ color: s.channel === "email" ? "#60a5fa" : "#a78bfa" }}>{s.channel === "email" ? <Ic.Mail /> : <Ic.Sms />}</span>
                        <span style={{ color:"#94a3b8", fontSize:12, flex:1 }}>
                          {s.channel === "email" ? (s.subject || "No subject") : "SMS"} &middot; {i === 0 ? "Immediately" : `+${s.delay} ${s.delayUnit}`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-success" onClick={go} disabled={!seqId}><Ic.Zap /> Launch Sequence</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Message Preview Modal ────────────────────────────────────────────────────

function MsgPreviewModal({ step, clinic, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ color: step.channel === "email" ? "#60a5fa" : "#a78bfa" }}>{step.channel === "email" ? <Ic.Mail /> : <Ic.Sms />}</span>
            <span className="modal-title">{step.channel === "email" ? "Email" : "SMS"} Preview</span>
          </div>
          <button className="modal-close" onClick={onClose}><Ic.X /></button>
        </div>
        <div className="modal-body">
          {step.channel === "email" && step.subject && (
            <div style={{ padding:"8px 12px", background:"rgba(96,165,250,0.08)", borderRadius:6, fontSize:13, color:"#bfdbfe", fontWeight:600 }}>
              Subject: {renderBody(step.subject, clinic)}
            </div>
          )}
          <div style={{ padding:14, background:"#0B1121", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, fontSize:13, color:"#cbd5e1", lineHeight:1.7, whiteSpace:"pre-wrap", fontFamily: step.channel === "sms" ? "monospace" : "inherit" }}>
            {renderBody(step.body, clinic)}
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span className={`fu-badge ${step.status === "sent" ? "fu-active" : "fu-paused"}`}>{step.status}</span>
            {step.sentAt && <span style={{ fontSize:11, color:"#475569" }}>Sent {timeAgo(step.sentAt)}</span>}
          </div>
        </div>
        <div className="modal-footer"><button className="btn-ghost" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

// ─── Clinic Picker (for launching from Follow-ups page with no clinic) ────────

function ClinicPickerModal({ clinics, onSelect, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Select Clinic</span>
          <button className="modal-close" onClick={onClose}><Ic.X /></button>
        </div>
        <div className="modal-body">
          <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:360, overflowY:"auto" }}>
            {clinics.length === 0 && <div style={{ color:"#475569", fontSize:13, textAlign:"center", padding:"24px 0" }}>No clinics yet. Add one first.</div>}
            {clinics.map(c => (
              <button key={c.id} onClick={() => onSelect(c)}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"#0B1121", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, cursor:"pointer", textAlign:"left", transition:"border-color 0.15s", width:"100%" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#3b82f6")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}>
                <div style={{ width:34, height:34, borderRadius:8, background:"rgba(37,99,235,0.15)", display:"flex", alignItems:"center", justifyContent:"center", color:"#3b82f6", flexShrink:0 }}><Ic.Clinic /></div>
                <div>
                  <div style={{ fontWeight:600, color:"#f8fafc", fontSize:13 }}>{c.name}</div>
                  <div style={{ fontSize:11, color:"#475569" }}>{c.contact_name || "&#8212;"} &middot; {stageLabel(c.status)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sequence Editor Modal ────────────────────────────────────────────────────

function SequenceEditorModal({ seq, onSave, onClose }) {
  const [form, setForm] = useState(seq || { id:`seq_${Date.now()}`, name:"", trigger:"new_client", active:true, steps:[] });
  const [editStep, setEditStep] = useState(null);

  const addStep = () => {
    const s = { id:`step_${Date.now()}`, delay:1, delayUnit:"days", channel:"email", subject:"", body:"" };
    setForm(f => ({ ...f, steps:[...f.steps, s] }));
    setEditStep(s.id);
  };
  const upd = (id, p) => setForm(f => ({ ...f, steps: f.steps.map(s => s.id === id ? { ...s, ...p } : s) }));
  const rem = id => { setForm(f => ({ ...f, steps: f.steps.filter(s => s.id !== id) })); if (editStep === id) setEditStep(null); };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{seq ? "Edit Sequence" : "New Sequence"}</span>
          <button className="modal-close" onClick={onClose}><Ic.X /></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Name</label>
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
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <label className="form-label" style={{ margin:0 }}>Steps ({form.steps.length})</label>
              <button className="btn-ghost" style={{ fontSize:12, padding:"5px 12px" }} onClick={addStep}><Ic.Plus /> Add Step</button>
            </div>
            {form.steps.length === 0 && (
              <div style={{ border:"1px dashed rgba(255,255,255,0.08)", borderRadius:8, padding:20, textAlign:"center", color:"#475569", fontSize:13 }}>No steps yet</div>
            )}
            {form.steps.map((step, idx) => (
              <div key={step.id} style={{ border:`1px solid ${editStep === step.id ? "#3b82f6" : "rgba(255,255,255,0.08)"}`, borderRadius:8, marginBottom:8, overflow:"hidden", transition:"border-color 0.2s" }}>
                <div onClick={() => setEditStep(editStep === step.id ? null : step.id)}
                  style={{ padding:"11px 14px", display:"flex", alignItems:"center", gap:10, cursor:"pointer", background:"#0B1121" }}>
                  <span style={{ color:"#475569", fontSize:11, fontFamily:"monospace", minWidth:18 }}>#{idx+1}</span>
                  <span style={{ color: step.channel === "email" ? "#60a5fa" : "#a78bfa" }}>{step.channel === "email" ? <Ic.Mail /> : <Ic.Sms />}</span>
                  <span style={{ color:"#94a3b8", fontSize:13, flex:1 }}>
                    {step.channel === "email" ? (step.subject || "No subject") : "SMS"} &middot; {idx === 0 ? "Immediately" : `+${step.delay} ${step.delayUnit}`}
                  </span>
                  <button onClick={e => { e.stopPropagation(); rem(step.id); }} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", padding:4 }}><Ic.Trash /></button>
                </div>
                {editStep === step.id && (
                  <div style={{ padding:14, borderTop:"1px solid rgba(255,255,255,0.07)", display:"flex", flexDirection:"column", gap:12 }}>
                    <div className="form-row-3">
                      <div className="form-group"><label className="form-label">Channel</label><select className="form-select" value={step.channel} onChange={e => upd(step.id,{channel:e.target.value})}><option value="email">Email</option><option value="sms">SMS</option></select></div>
                      <div className="form-group"><label className="form-label">Wait</label><input type="number" min={0} className="form-input" value={step.delay} onChange={e => upd(step.id,{delay:Number(e.target.value)})}/></div>
                      <div className="form-group"><label className="form-label">Unit</label><select className="form-select" value={step.delayUnit} onChange={e => upd(step.id,{delayUnit:e.target.value})}><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></div>
                    </div>
                    {step.channel === "email" && (
                      <div className="form-group"><label className="form-label">Subject</label><input className="form-input" value={step.subject} onChange={e => upd(step.id,{subject:e.target.value})} placeholder="Email subject line"/></div>
                    )}
                    <div className="form-group">
                      <label className="form-label">Body &mdash; use &#123;&#123;first_name&#125;&#125;, &#123;&#123;clinic_name&#125;&#125;</label>
                      <textarea className="form-textarea" rows={5} value={step.body} onChange={e => upd(step.id,{body:e.target.value})} />
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


// ─── Detail Panel (3 tabs: Overview / Tasks / Follow-ups) ────────────────────

function DetailPanel({ clinic, sequences, onClose, onUpdate, onOpenLaunch }) {
  const [tab, setTab] = useState("overview");
  const [newATask, setNewATask] = useState("");
  const [newCTask, setNewCTask] = useState("");
  const [expanded, setExpanded] = useState({});
  const [previewStep, setPreviewStep] = useState(null);

  const aTasks  = clinic.alignmentTasks || [];
  const cTasks  = clinic.clinicTasks    || [];
  const fus     = clinic.followUps      || [];
  const allT    = [...aTasks, ...cTasks];
  const doneT   = allT.filter(t => t.done).length;
  const pct     = allT.length ? Math.round((doneT / allT.length) * 100) : 0;
  const activeFu = fus.filter(f => f.status === "active");
  const histFu   = fus.filter(f => f.status !== "active");

  const toggleExp = k => setExpanded(p => ({ ...p, [k]: !p[k] }));
  const updateFu  = (fuId, patch) => onUpdate({ ...clinic, followUps: fus.map(f => f.id === fuId ? { ...f, ...patch } : f) });

  const sugTrigId    = STAGE_AUTO_TRIGGER[clinic.status];
  const sugTrig      = sugTrigId ? getTrigger(sugTrigId) : null;
  const alreadyRunning = sugTrigId && fus.some(f => f.trigger === sugTrigId && f.status === "active");
  const showSuggest  = sugTrig && !alreadyRunning && sequences.some(s => s.trigger === sugTrigId && s.active);

  const SuggestBanner = () => !showSuggest ? null : (
    <div className="suggest-banner">
      <span style={{ fontSize:20 }}>{sugTrig.icon}</span>
      <div className="suggest-text">
        <div className="suggest-title">Suggested: {sugTrig.label}</div>
        <div className="suggest-body">Stage is <strong>{stageLabel(clinic.status)}</strong> &mdash; launch a follow-up?</div>
      </div>
      <button className="btn-primary" style={{ fontSize:12, padding:"7px 12px" }} onClick={() => onOpenLaunch(clinic, sugTrig)}>
        <Ic.Zap /> Launch
      </button>
    </div>
  );

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="detail-header">
          <div>
            <div className="detail-title">{clinic.name}</div>
            <div className="detail-meta">
              <StatusBadge status={clinic.status} />
              {activeFu.length > 0 && <span className="fu-badge fu-active">{activeFu.length} running</span>}
            </div>
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
            <button className="btn-success" style={{ padding:"7px 12px", fontSize:12 }} onClick={() => onOpenLaunch(clinic)}>
              <Ic.Zap /> Follow-up
            </button>
            <button className="modal-close" onClick={onClose}><Ic.X /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="detail-tabs">
          {[
            ["overview", "Overview"],
            ["tasks",    "Tasks"],
            ["followups", `Follow-ups${activeFu.length > 0 ? ` (${activeFu.length})` : ""}`],
          ].map(([id, label]) => (
            <button key={id} className={"detail-tab" + (tab === id ? " active" : "")} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        <div className="detail-body">

          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <>
              <SuggestBanner />
              <div>
                <div className="detail-section-title">Contact Info</div>
                <div className="info-grid">
                  <div><div className="info-label">Contact</div><div className="info-value">{clinic.contact_name || "&#8212;"}</div></div>
                  <div><div className="info-label">Phone</div><div className="info-value" style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>{clinic.contact_phone || "&#8212;"}</div></div>
                  <div><div className="info-label">Email</div><div className="info-value" style={{ fontSize:12 }}>{clinic.contact_email || "&#8212;"}</div></div>
                  <div><div className="info-label">Start Date</div><div className="info-value">{formatDate(clinic.start_date)}</div></div>
                  {clinic.website && <div style={{ gridColumn:"span 2" }}><div className="info-label">Website</div><div className="info-value" style={{ fontSize:12 }}>{clinic.website}</div></div>}
                  {clinic.package && <div style={{ gridColumn:"span 2" }}><div className="info-label">Package</div><div className="info-value" style={{ color:"#3b82f6", fontWeight:700 }}>{clinic.package}</div></div>}
                </div>
              </div>
              <div>
                <div className="detail-section-title">Accounts Needed</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {(() => {
                    const a = new Set();
                    cTasks.forEach(t => {
                      if (t.name.includes("Calendly"))                                              a.add("Calendly");
                      if (t.name.includes("form tool") || t.name.includes("Tally") || t.name.includes("Typeform")) a.add("Form Tool");
                      if (t.name.includes("Zapier") || t.name.includes("Make"))                    a.add("Zapier/Make");
                      if (t.name.includes("Twilio"))                                               a.add("Twilio");
                    });
                    if (!a.size) return <span style={{ fontSize:12, color:"#64748b" }}>None required</span>;
                    return [...a].map(x => (
                      <span key={x} style={{ padding:"5px 11px", background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.3)", borderRadius:6, fontSize:11, fontWeight:600, color:"#60a5fa" }}>{x}</span>
                    ));
                  })()}
                </div>
              </div>
              <div>
                <div className="detail-section-title">Onboarding Progress ({doneT}/{allT.length})</div>
                {allT.length > 0 && (
                  <><div className="task-progress-label">{pct}% complete</div><div className="task-progress"><div className="task-progress-bar" style={{ width: pct + "%" }} /></div></>
                )}
              </div>
            </>
          )}

          {/* ── TASKS ── */}
          {tab === "tasks" && (
            [["alignment", aTasks, "alignmentTasks", "\uD83E\uDDD1\u200D\uD83D\uDCBB Alignment Automations"],
             ["clinic",    cTasks, "clinicTasks",    "\uD83C\uDFE5 Clinic"]].map(([type, tasks, key, label]) => {
              const secs = [...new Set(tasks.map(t => t.section).filter(Boolean))];
              return (
                <div key={type}>
                  <div className="detail-section-title" style={{ display:"flex", alignItems:"center", gap:6 }}>{label}</div>
                  {secs.map(sec => {
                    const st = tasks.filter(t => t.section === sec);
                    const sd = st.filter(t => t.done).length;
                    const isExp = expanded[type + "-" + sec];
                    return (
                      <div key={sec} style={{ marginBottom:10 }}>
                        <div onClick={() => toggleExp(type + "-" + sec)}
                          style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", background:"rgba(11,17,33,0.6)", borderRadius:6, cursor:"pointer", userSelect:"none" }}>
                          <span style={{ transform: isExp ? "rotate(90deg)" : "none", transition:"transform 0.2s", fontSize:10, color:"#64748b" }}>&#9654;</span>
                          <span style={{ fontSize:11, fontWeight:700, color:"#cbd5e1", textTransform:"uppercase", letterSpacing:"0.08em", flex:1 }}>{sec}</span>
                          <span style={{ fontSize:10, color:"#64748b", fontFamily:"'JetBrains Mono',monospace" }}>{sd}/{st.length}</span>
                        </div>
                        {isExp && (
                          <div className="task-list" style={{ marginTop:6 }}>
                            {st.map(t => (
                              <div key={t.id} className="task-item">
                                <div className={"task-checkbox" + (t.done ? " done" : "")}
                                  onClick={() => onUpdate({ ...clinic, [key]: tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x) })}>
                                  {t.done && <Ic.Check />}
                                </div>
                                <span className={"task-name" + (t.done ? " done" : "")}>{t.name}</span>
                                <button className="task-delete" onClick={() => onUpdate({ ...clinic, [key]: tasks.filter(x => x.id !== t.id) })}>&#x2715;</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="add-task-row">
                    <input className="add-task-input"
                      placeholder={`Add ${type === "alignment" ? "Alignment" : "Clinic"} task\u2026`}
                      value={type === "alignment" ? newATask : newCTask}
                      onChange={e => type === "alignment" ? setNewATask(e.target.value) : setNewCTask(e.target.value)}
                      onKeyDown={e => {
                        const v = type === "alignment" ? newATask : newCTask;
                        if (e.key === "Enter" && v.trim()) {
                          onUpdate({ ...clinic, [key]: [...tasks, { id: uid(), name: v.trim(), done: false }] });
                          type === "alignment" ? setNewATask("") : setNewCTask("");
                        }
                      }} />
                    <button className="btn-primary" style={{ padding:"8px 12px", fontSize:12 }} onClick={() => {
                      const v = type === "alignment" ? newATask : newCTask;
                      if (v.trim()) {
                        onUpdate({ ...clinic, [key]: [...tasks, { id: uid(), name: v.trim(), done: false }] });
                        type === "alignment" ? setNewATask("") : setNewCTask("");
                      }
                    }}>Add</button>
                  </div>
                </div>
              );
            })
          )}

          {/* ── FOLLOW-UPS ── */}
          {tab === "followups" && (
            <>
              <SuggestBanner />
              {fus.length === 0 ? (
                <div className="empty-state" style={{ padding:"32px 0" }}>
                  <div className="empty-icon">&#9889;</div>
                  <div className="empty-title">No sequences yet</div>
                  <div className="empty-sub">Launch a follow-up sequence for this clinic</div>
                  <button className="btn-primary" style={{ marginTop:16 }} onClick={() => onOpenLaunch(clinic)}>
                    <Ic.Zap /> Launch Sequence
                  </button>
                </div>
              ) : (
                <>
                  {activeFu.length > 0 && (
                    <div>
                      <div className="detail-section-title">Active ({activeFu.length})</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                        {activeFu.map(fu => {
                          const trig = getTrigger(fu.trigger);
                          const sent = fu.steps.filter(s => s.status === "sent").length;
                          const p    = fu.totalSteps ? Math.round((sent / fu.totalSteps) * 100) : 0;
                          return (
                            <div key={fu.id} className="fu-row">
                              <div style={{ width:32, height:32, borderRadius:8, background:`${trig.color}18`, display:"flex", alignItems:"center", justifyContent:"center", color:trig.color, fontSize:15, flexShrink:0 }}>{trig.icon}</div>
                              <div className="fu-row-body">
                                <div className="fu-row-name">{fu.seqName}</div>
                                <div className="fu-row-meta">{trig.label} &middot; {timeAgo(fu.triggeredAt)}</div>
                                <div style={{ marginTop:6 }}>
                                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                                    <span style={{ fontSize:10, color:"#475569" }}>Step {sent}/{fu.totalSteps}</span>
                                    <span style={{ fontSize:10, color:"#475569" }}>{p}%</span>
                                  </div>
                                  <div className="task-progress" style={{ marginBottom:0 }}>
                                    <div className="task-progress-bar" style={{ width: p + "%" }} />
                                  </div>
                                </div>
                                <div style={{ display:"flex", gap:5, marginTop:8, flexWrap:"wrap" }}>
                                  {fu.steps.map((s, i) => (
                                    <button key={s.id} onClick={() => setPreviewStep(s)}
                                      style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 8px", borderRadius:5, background: s.status === "sent" ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.05)", border:`1px solid ${s.status === "sent" ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.08)"}`, cursor:"pointer", fontSize:11, color: s.status === "sent" ? "#4ade80" : "#64748b" }}>
                                      {s.channel === "email" ? <Ic.Mail /> : <Ic.Sms />} #{i+1}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="fu-row-actions">
                                <button className="btn-danger" title="Pause"  onClick={() => updateFu(fu.id, { status:"paused"    })}><Ic.Pause /></button>
                                <button className="btn-danger" title="Cancel" onClick={() => updateFu(fu.id, { status:"cancelled" })}><Ic.Stop /></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {histFu.length > 0 && (
                    <div>
                      <div className="detail-section-title">History ({histFu.length})</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {histFu.map(fu => {
                          const trig = getTrigger(fu.trigger);
                          return (
                            <div key={fu.id} className="fu-row" style={{ opacity:0.65 }}>
                              <div style={{ width:32, height:32, borderRadius:8, background:`${trig.color}12`, display:"flex", alignItems:"center", justifyContent:"center", color:trig.color, fontSize:15, flexShrink:0 }}>{trig.icon}</div>
                              <div className="fu-row-body">
                                <div className="fu-row-name">{fu.seqName}</div>
                                <div className="fu-row-meta">{trig.label} &middot; {timeAgo(fu.triggeredAt)}</div>
                              </div>
                              <FuBadge fu={fu} />
                              {fu.status === "paused" && (
                                <button className="btn-ghost" style={{ fontSize:11, padding:"4px 8px", marginLeft:6 }}
                                  onClick={() => updateFu(fu.id, { status:"active" })}>
                                  <Ic.Play /> Resume
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

        </div>
      </div>

      {previewStep && <MsgPreviewModal step={previewStep} clinic={clinic} onClose={() => setPreviewStep(null)} />}
    </div>
  );
}


// ─── Dashboard View ───────────────────────────────────────────────────────────

function DashboardView({ clinics, sequences, onAdd, onEdit, onDelete, onSelect, onStatusChange, onOpenLaunch }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = clinics.filter(c => {
    const q = search.toLowerCase();
    const ms = !q || c.name.toLowerCase().includes(q) || (c.contact_name||"").toLowerCase().includes(q) || (c.contact_email||"").toLowerCase().includes(q);
    return ms && (filter === "all" || c.status === filter);
  });

  return (
    <>
      <div className="main-header">
        <div>
          <div className="page-title">Clinics</div>
          <div className="page-subtitle">
            {clinics.length} total &middot; {clinics.filter(c => (c.followUps||[]).some(f => f.status === "active")).length} with active follow-ups
          </div>
        </div>
        <button className="btn-primary header-add-btn" onClick={onAdd}><Ic.Plus /> Add Clinic</button>
      </div>
      <div className="main-content">
        <div className="toolbar">
          <div className="search-wrap">
            <span className="search-icon"><Ic.Search /></span>
            <input className="search-input" placeholder="Search clinics&#8230;" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {/* Desktop table */}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Clinic</th><th>Contact</th><th>Package</th><th>Status</th><th>Follow-ups</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-icon">&#127973;</div>
                    <div className="empty-title">{clinics.length === 0 ? "No clinics yet" : "No results"}</div>
                    <div className="empty-sub">{clinics.length === 0 ? "Click 'Add Clinic' to get started" : "Adjust search or filter"}</div>
                  </div>
                </td></tr>
              ) : filtered.map(c => {
                const activeFuCount = (c.followUps||[]).filter(f => f.status === "active").length;
                const hasSuggest    = !activeFuCount && STAGE_AUTO_TRIGGER[c.status] && sequences.some(s => s.trigger === STAGE_AUTO_TRIGGER[c.status] && s.active);
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="clinic-name-cell">
                        <span className="clinic-name-text">{c.name}</span>
                        <span className="link-icon" onClick={() => onSelect(c)}><Ic.ExternalLink /></span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight:500, color:"#f8fafc" }}>{c.contact_name || "&#8212;"}</div>
                      {c.contact_email && <div style={{ fontSize:11, color:"#475569", marginTop:1 }}>{c.contact_email}</div>}
                    </td>
                    <td style={{ fontSize:12, color:"#64748b" }}>{c.package || "&#8212;"}</td>
                    <td><StatusDropdown status={c.status} onChange={s => onStatusChange(c.id, s)} /></td>
                    <td>
                      <td>
                        {activeFuCount > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {c.followUps.filter(f => f.status === "active").map(fu => (
                        <span 
                        key={fu.id} 
                        className="fu-badge fu-active" 
                        style={{ cursor: "pointer", fontSize: '10px' }} 
                        onClick={() => onSelect(c)}
                        >
                        {fu.seqName} {/* Now displays "New Client Welcome", etc. */}
                        </span>
      ))}
    </div>
  ) : hasSuggest ? (
    <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 8px", borderColor: "rgba(37,99,235,0.3)", color: "#60a5fa" }} onClick={() => onOpenLaunch(c)}>
      <Ic.Zap /> Suggested
    </button>
  ) : (
    <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => onOpenLaunch(c)}>
      <Ic.Zap /> Launch
    </button>
  )}
</td>

                    </td>
                    <td>
                      <div className="actions-cell">
                        <button className="btn-ghost" onClick={() => onEdit(c)} style={{ padding:"5px 8px" }}><Ic.Edit /></button>
                        <button className="btn-danger" onClick={() => onDelete(c.id)}><Ic.Trash /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="clinic-card-list">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">&#127973;</div>
              <div className="empty-title">{clinics.length === 0 ? "No clinics yet" : "No results"}</div>
              <div className="empty-sub">{clinics.length === 0 ? "Tap + to add" : "Adjust search"}</div>
            </div>
          ) : filtered.map(c => {
            const activeFuCount = (c.followUps||[]).filter(f => f.status === "active").length;
            return (
              <div key={c.id} className="clinic-list-card" onClick={() => onSelect(c)}>
                <div className="clinic-list-card-icon"><Ic.Clinic /></div>
                <div className="clinic-list-card-body">
                  <div className="clinic-list-card-name">{c.name}</div>
                  <div className="clinic-list-card-sub">{c.contact_name || "&#8212;"}</div>
                </div>
                <div className="clinic-list-card-right">
                  <div onClick={e => e.stopPropagation()}><StatusDropdown status={c.status} onChange={s => onStatusChange(c.id, s)} /></div>
                  {activeFuCount > 0 && <span className="fu-badge fu-active">{activeFuCount} active</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Pipeline View ────────────────────────────────────────────────────────────

function PipelineView({ clinics, sequences, onSelect, onStatusChange, onOpenLaunch }) {
  const [open, setOpen] = useState(() => { const m = {}; PIPELINE_STAGES.forEach(s => { m[s.id] = true; }); return m; });
  const [dragOver, setDragOver] = useState(null);
  const [dragging, setDragging] = useState(null);
  const dragId = useRef(null);

  return (
    <>
      <div className="main-header">
        <div>
          <div className="page-title">Pipeline</div>
          <div className="page-subtitle">Drag cards between stages &middot; click to view details</div>
        </div>
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
                <div className="stage-header" onClick={() => setOpen(o => ({ ...o, [stage.id]: !o[stage.id] }))}>
                  <span className={"stage-chevron" + (isOpen ? " open" : "")}><Ic.ChevronRight /></span>
                  <span className="stage-dot-lg" style={{ background: stage.color }} />
                  <span className="stage-label">{stage.label}</span>
                  <span className={"stage-count" + (stageClinics.length === 0 ? " zero" : "")}>{stageClinics.length}</span>
                </div>
                {isOpen && (stageClinics.length > 0 ? (
                  <div className="stage-cards">
                    {stageClinics.map(c => {
                      const activeFu  = (c.followUps||[]).filter(f => f.status === "active");
                      const hasSuggest = !activeFu.length && STAGE_AUTO_TRIGGER[c.status] && sequences.some(s => s.trigger === STAGE_AUTO_TRIGGER[c.status] && s.active);
                      return (
                        <div key={c.id} className={"clinic-card" + (dragging === c.id ? " dragging" : "")}
                          style={{ borderLeftColor: stage.color }}
                          draggable
                          onDragStart={e => { dragId.current = c.id; setDragging(c.id); e.dataTransfer.effectAllowed = "move"; }}
                          onDragEnd={() => { dragId.current = null; setDragging(null); setDragOver(null); }}
                          onClick={() => onSelect(c)}>
                          <div className="card-icon"><Ic.Clinic /></div>
                          <div className="card-info">
                            <div className="card-name">{c.name}</div>
                            <div className="card-contact">{c.contact_name || "&#8212;"}</div>
                            <div className="card-date">{formatDate(c.start_date)}</div>
                          
                           {activeFu.length > 0 && (
                           <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 5 }}>
                              {activeFu.map(fu => (
                             <div key={fu.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                              <span style={{ fontSize: 10, color: "#4ade80", fontWeight: 600 }}>
                              {fu.seqName}
                              </span>
                             </div>
                           ))}
                          </div>
                        )}


                            {hasSuggest && (
                              <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:5 }}
                                onClick={e => { e.stopPropagation(); onOpenLaunch(c); }}>
                                <span style={{ width:6, height:6, borderRadius:"50%", background:"#3b82f6", display:"inline-block" }} />
                                <span style={{ fontSize:10, color:"#60a5fa", cursor:"pointer" }}>Follow-up suggested &#8599;</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <div className="stage-drop-hint">Drop a clinic here</div>)}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Follow-up View ───────────────────────────────────────────────────────────

function FollowupView({ clinics, sequences, setSequences, onOpenLaunch, onSelectClinic }) {
  const [fuTab, setFuTab] = useState("activity");
  const [editingSeq, setEditingSeq] = useState(null);
  const [showNewSeq, setShowNewSeq] = useState(false);
  const [previewSeq, setPreviewSeq] = useState(null);

  const allFu      = clinics.flatMap(c => (c.followUps||[]).map(f => ({ ...f, clinic: c })));
  const activeFu   = allFu.filter(f => f.status === "active");
  const completedFu = allFu.filter(f => f.status === "completed");
  const pausedFu   = allFu.filter(f => f.status === "paused");

  const saveSeq = seq => {
    setSequences(prev => { const ex = prev.find(s => s.id === seq.id); return ex ? prev.map(s => s.id === seq.id ? seq : s) : [...prev, seq]; });
    setEditingSeq(null); setShowNewSeq(false);
  };

  return (
    <>
      <div className="main-header">
        <div>
          <div className="page-title">Follow-ups</div>
          <div className="page-subtitle">{activeFu.length} active &middot; {sequences.filter(s => s.active).length} sequences enabled</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn-ghost" onClick={() => setShowNewSeq(true)}><Ic.Plus /> Sequence</button>
          <button className="btn-primary" onClick={() => onOpenLaunch(null)}><Ic.Zap /> Launch</button>
        </div>
      </div>
      <div className="main-content">

        {/* Sub-tabs */}
        <div style={{ display:"flex", gap:2, marginBottom:20, borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
          {[["activity","Activity"],["sequences","Sequences"]].map(([id,label]) => (
            <button key={id} onClick={() => setFuTab(id)}
              style={{ background:"none", border:"none", cursor:"pointer", padding:"10px 16px", fontSize:13, fontWeight:600, color: fuTab===id ? "#f8fafc" : "#475569", borderBottom: fuTab===id ? "2px solid #2563eb" : "2px solid transparent", marginBottom:-1, transition:"all 0.15s", fontFamily:"Manrope,sans-serif" }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Activity ── */}
        {fuTab === "activity" && (
          <>
            <div className="stats-grid">
              {[
                { label:"Active",    value: activeFu.length,    color:"#4ade80" },
                { label:"Paused",    value: pausedFu.length,    color:"#f59e0b" },
                { label:"Completed", value: completedFu.length, color:"#94a3b8" },
                { label:"Sequences", value: sequences.filter(s => s.active).length, color:"#60a5fa" },
              ].map((st, i) => (
                <div key={i} className="stat-card">
                  <div className="stat-label" style={{ color: st.color }}>{st.label}</div>
                  <div className="stat-value">{st.value}</div>
                </div>
              ))}
            </div>

            {allFu.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">&#9889;</div>
                <div className="empty-title">No follow-ups yet</div>
                <div className="empty-sub">Launch a sequence from a clinic, or click Launch above</div>
              </div>
            ) : (
              <div className="table-wrap">
                <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ color:"#f8fafc", fontWeight:700, fontSize:14 }}>All Follow-ups</span>
                  <span style={{ color:"#475569", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>{allFu.length} total</span>
                </div>
                <table>
                  <thead><tr><th>Clinic</th><th>Sequence</th><th>Trigger</th><th>Progress</th><th>Status</th><th>Launched</th></tr></thead>
                  <tbody>
                    {allFu.sort((a,b) => b.triggeredAt - a.triggeredAt).map(fu => {
                      const trig = getTrigger(fu.trigger);
                      const sent = fu.steps.filter(s => s.status === "sent").length;
                      const p    = fu.totalSteps ? Math.round((sent / fu.totalSteps) * 100) : 0;
                      return (
                        <tr key={fu.id} style={{ cursor:"pointer" }} onClick={() => onSelectClinic(fu.clinic)}>
                          <td>
                            <div style={{ fontWeight:600, color:"#f8fafc" }}>{fu.clinic.name}</div>
                            <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>{fu.clinic.contact_name || "&#8212;"}</div>
                          </td>
                          <td style={{ color:"#94a3b8", fontSize:13 }}>{fu.seqName}</td>
                          <td>
                            <span style={{ display:"inline-flex", alignItems:"center", gap:6, color:trig.color, fontSize:12, fontWeight:600 }}>
                              {trig.icon} {trig.label}
                            </span>
                          </td>
                          <td>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <div style={{ flex:1, height:4, background:"rgba(255,255,255,0.07)", borderRadius:2, minWidth:60 }}>
                                <div style={{ height:"100%", background: fu.status === "active" ? "#4ade80" : "#64748b", borderRadius:2, width: p + "%" }} />
                              </div>
                              <span style={{ fontSize:11, color:"#475569", fontFamily:"monospace", whiteSpace:"nowrap" }}>{sent}/{fu.totalSteps}</span>
                            </div>
                          </td>
                          <td><FuBadge fu={fu} /></td>
                          <td style={{ fontSize:12, color:"#475569" }}>{timeAgo(fu.triggeredAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Sequences ── */}
        {fuTab === "sequences" && (
          <>
            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
              <button className="btn-primary" onClick={() => setShowNewSeq(true)}><Ic.Plus /> New Sequence</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {sequences.map(seq => {
                const trig     = getTrigger(seq.trigger);
                const expanded = previewSeq === seq.id;
                const usage    = clinics.filter(c => (c.followUps||[]).some(f => f.seqId === seq.id)).length;
                return (
                  <div key={seq.id} className="seq-card">
                    <div className="seq-card-header">
                      <div className="seq-trigger-icon" style={{ background:`${trig.color}18`, color:trig.color }}>{trig.icon}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <span style={{ color:"#f8fafc", fontWeight:700, fontSize:14 }}>{seq.name}</span>
                          <span className={`fu-badge ${seq.active ? "fu-active" : "fu-paused"}`}>{seq.active ? "Active" : "Paused"}</span>
                          {usage > 0 && <span style={{ fontSize:11, color:"#64748b" }}>Used by {usage} clinic{usage > 1 ? "s" : ""}</span>}
                        </div>
                        <div style={{ color:"#475569", fontSize:12, marginTop:3 }}>
                          {trig.label} &middot; {seq.steps.length} steps &middot; {seq.steps.filter(s => s.channel==="email").length} email &middot; {seq.steps.filter(s => s.channel==="sms").length} SMS
                        </div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:3, flexShrink:0 }}>
                        {seq.steps.map((s,i) => (
                          <div key={s.id} style={{ display:"flex", alignItems:"center", gap:3 }}>
                            {i > 0 && <div className="seq-connector" />}
                            <div className="seq-step-pill" style={{ background: s.channel==="email" ? "rgba(96,165,250,0.15)" : "rgba(167,139,250,0.15)", color: s.channel==="email" ? "#60a5fa" : "#a78bfa" }}>
                              {s.channel === "email" ? <Ic.Mail /> : <Ic.Sms />}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display:"flex", gap:5, flexShrink:0, marginLeft:4 }}>
                        <button className="btn-ghost" style={{ padding:"5px 10px", fontSize:12 }} onClick={() => setPreviewSeq(expanded ? null : seq.id)}>
                          {expanded ? "Hide" : "Preview"}
                        </button>
                        <button className="btn-ghost" style={{ padding:"5px 8px" }} onClick={() => setSequences(prev => prev.map(s => s.id===seq.id ? { ...s, active:!s.active } : s))}>
                          {seq.active ? <Ic.Pause /> : <Ic.Play />}
                        </button>
                        <button className="btn-ghost" style={{ padding:"5px 8px" }} onClick={() => setEditingSeq(seq)}><Ic.Edit /></button>
                        <button className="btn-danger" onClick={() => setSequences(prev => prev.filter(s => s.id !== seq.id))}><Ic.Trash /></button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="seq-preview">
                        {seq.steps.map((s,i) => (
                          <div key={s.id} className="seq-step-preview">
                            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: s.body ? 6 : 0 }}>
                              <span style={{ color:"#475569", fontSize:11, fontFamily:"monospace" }}>Step {i+1}</span>
                              <span style={{ color: s.channel==="email" ? "#60a5fa" : "#a78bfa" }}>{s.channel==="email" ? <Ic.Mail /> : <Ic.Sms />}</span>
                              <span style={{ color:"#94a3b8", fontSize:12 }}>
                                {i===0 ? "Immediately" : `After ${s.delay} ${s.delayUnit}`}
                                {s.channel==="email" && s.subject ? ` \u2014 "${s.subject}"` : ""}
                              </span>
                            </div>
                            {s.body && <div style={{ color:"#64748b", fontSize:12, lineHeight:1.6, fontFamily:"monospace", whiteSpace:"pre-wrap", maxHeight:64, overflow:"hidden" }}>{s.body.slice(0,180)}{s.body.length > 180 ? "\u2026" : ""}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {(editingSeq || showNewSeq) && (
        <SequenceEditorModal seq={editingSeq} onSave={saveSeq} onClose={() => { setEditingSeq(null); setShowNewSeq(false); }} />
      )}
    </>
  );
}


// ─── Login ────────────────────────────────────────────────────────────────────

function SimpleLogin({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  return (
    <>
      <style>{css}</style>
      <div className="login-page">
        <div className="login-card">
          <div className="brand-name" style={{ fontSize:18, marginBottom:24 }}>Alignment Automations</div>
          <div className="login-title">Enter Password</div>
          <form style={{ display:"flex", flexDirection:"column", gap:14 }} onSubmit={e => {
            e.preventDefault();
            if (pw === APP_PASSWORD) { localStorage.setItem("aa_auth","1"); onLogin(); }
            else { setErr("Incorrect password"); setPw(""); }
          }}>
            {err && <div className="login-error">{err}</div>}
            <div className="form-group">
              <input className="form-input" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Password" required autoFocus />
            </div>
            <button className="btn-login" type="submit">Sign in</button>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [authed,    setAuthed]    = useState(() => localStorage.getItem("aa_auth") === "1");
  const [clinics,   setClinics]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [page,      setPage]      = useState("dashboard");
  const [modal,     setModal]     = useState(null);       // null | "add" | clinic obj
  const [selected,  setSelected]  = useState(null);      // clinic obj for detail panel
  const [toast,     setToast]     = useState(null);
  const [sequences, setSequences] = useState(DEFAULT_SEQUENCES);
  const [launchTarget, setLaunchTarget] = useState(null); // { clinic, prefillTrigger }
  const [showPicker,   setShowPicker]   = useState(false);

  useEffect(() => {
    if (!authed) { setLoading(false); return; }
    db.getAll()
      .then(data => { setClinics(data || []); setLoading(false); })
      .catch(() => { setClinics([]); setLoading(false); });
  }, [authed]);

  const showToast = msg => setToast(msg);

  // Open launch modal. If clinic=null, show clinic picker first.
  const openLaunch = useCallback((clinic, prefillTrigger = null) => {
    if (!clinic) { setShowPicker(true); return; }
    setLaunchTarget({ clinic, prefillTrigger });
  }, []);

  // Called when a sequence is successfully launched — writes followUp entry back to clinic
  const handleLaunch = useCallback(async (clinic, fu) => {
    const updated = { ...clinic, followUps: [...(clinic.followUps || []), fu] };
    setClinics(prev => prev.map(c => c.id === clinic.id ? updated : c));
    if (selected?.id === clinic.id) setSelected(updated);
    try { await db.update(clinic.id, { followUps: updated.followUps }); } catch (_) {}
    showToast(`Sequence launched for ${clinic.name}`);
  }, [selected]);

  const handleStatusChange = useCallback(async (id, newStatus) => {
    const clinic = clinics.find(c => c.id === id);
    setClinics(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    setSelected(sel => sel?.id === id ? { ...sel, status: newStatus } : sel);
    try { await db.update(id, { status: newStatus }); } catch (_) {}
    showToast(`Moved to ${stageLabel(newStatus)}`);
    // Auto-open detail panel with follow-up suggestion when stage has a mapped trigger
    const trigId = STAGE_AUTO_TRIGGER[newStatus];
    if (trigId && sequences.some(s => s.trigger === trigId && s.active) && clinic) {
      const alreadyRunning = (clinic.followUps||[]).some(f => f.trigger === trigId && f.status === "active");
      if (!alreadyRunning) {
        setTimeout(() => setSelected(prev => prev?.id === id ? { ...prev, status: newStatus } : { ...clinic, status: newStatus }), 350);
      }
    }
  }, [clinics, sequences]);

  const handleSave = useCallback(async form => {
    if (modal === "add") {
      const pt = form.package ? getPackageTasks(form.package) : DEFAULT_TASKS;
      const newClinic = {
        ...form, id: uid(), created_at: new Date().toISOString(), followUps: [],
        alignmentTasks: pt.alignment.map(t => ({ ...t, id: uid() })),
        clinicTasks:    pt.clinic.map(t    => ({ ...t, id: uid() })),
      };
      setClinics(prev => [newClinic, ...prev]);
      try { await db.create(newClinic); } catch (_) {}
      showToast("Clinic added");
    } else {
      setClinics(prev => prev.map(c => c.id === form.id ? { ...c, ...form } : c));
      if (selected?.id === form.id) setSelected(s => ({ ...s, ...form }));
      try { await db.update(form.id, form); } catch (_) {}
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
    try {
      await db.update(updated.id, {
        alignmentTasks: updated.alignmentTasks || [],
        clinicTasks:    updated.clinicTasks    || [],
        followUps:      updated.followUps      || [],
      });
    } catch (_) {}
  }, []);

  if (!authed) return <SimpleLogin onLogin={() => setAuthed(true)} />;
  if (loading)  return <><style>{css}</style><div className="app"><div className="loading">Loading&#8230;</div></div></>;

  const handleLogout = () => { localStorage.removeItem("aa_auth"); setAuthed(false); setClinics([]); };
  const activeFuTotal = clinics.reduce((n, c) => n + (c.followUps||[]).filter(f => f.status === "active").length, 0);

  return (
    <>
      <style>{css}</style>
      <div className="app">

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-text">
              <div className="brand-name">Alignment</div>
              <div className="brand-name">Automations</div>
            </div>
          </div>
          <nav className="sidebar-nav">
            <div className="nav-section-label">CRM</div>
            <button className={"nav-item" + (page === "dashboard" ? " active" : "")} onClick={() => setPage("dashboard")}>
              <span className="nav-icon"><Ic.Dashboard /></span>Dashboard
            </button>
            <button className={"nav-item" + (page === "pipeline" ? " active" : "")} onClick={() => setPage("pipeline")}>
              <span className="nav-icon"><Ic.Pipeline /></span>Pipeline
            </button>
            <div className="nav-section-label" style={{ marginTop:8 }}>Automation</div>
            <button className={"nav-item" + (page === "followup" ? " active" : "")} onClick={() => setPage("followup")}>
              <span className="nav-icon"><Ic.Followup /></span>Follow-ups
              {activeFuTotal > 0 && <span className="nav-badge">{activeFuTotal}</span>}
            </button>
            <button className="logout-btn" style={{ marginTop:"auto" }} onClick={handleLogout}>
              <Ic.Logout /> Sign out
            </button>
          </nav>
        </aside>

        {/* ── Main ── */}
        <main className="main">
          {page === "dashboard" && (
            <DashboardView
              clinics={clinics} sequences={sequences}
              onAdd={() => setModal("add")} onEdit={c => setModal(c)} onDelete={handleDelete}
              onSelect={setSelected} onStatusChange={handleStatusChange} onOpenLaunch={openLaunch}
            />
          )}
          {page === "pipeline" && (
            <PipelineView
              clinics={clinics} sequences={sequences}
              onSelect={setSelected} onStatusChange={handleStatusChange} onOpenLaunch={openLaunch}
            />
          )}
          {page === "followup" && (
            <FollowupView
              clinics={clinics} sequences={sequences} setSequences={setSequences}
              onOpenLaunch={openLaunch}
              onSelectClinic={c => setSelected(c)}
            />
          )}
        </main>

        {/* ── Mobile bottom nav ── */}
        <nav className="bottom-nav">
          <div className="bottom-nav-inner">
            <button className={"bottom-nav-item" + (page === "dashboard" ? " active" : "")} onClick={() => setPage("dashboard")}><Ic.Dashboard /><span>Clinics</span></button>
            <button className={"bottom-nav-item" + (page === "pipeline"  ? " active" : "")} onClick={() => setPage("pipeline")} ><Ic.Pipeline /><span>Pipeline</span></button>
            <button className={"bottom-nav-item" + (page === "followup"  ? " active" : "")} onClick={() => setPage("followup")} ><Ic.Followup /><span>Follow-ups</span></button>
            <button className="bottom-nav-item" onClick={handleLogout}><Ic.Logout /><span>Sign out</span></button>
          </div>
        </nav>

        <button className="fab" onClick={() => setModal("add")}>&#65291;</button>

        {/* Clinic form */}
        {modal && <ClinicModal clinic={modal === "add" ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />}

        {/* Clinic picker (launched from Follow-ups page with no pre-selected clinic) */}
        {showPicker && (
          <ClinicPickerModal
            clinics={clinics}
            onSelect={c => { setShowPicker(false); setLaunchTarget({ clinic: c, prefillTrigger: null }); }}
            onClose={() => setShowPicker(false)}
          />
        )}

        {/* Launch modal */}
        {launchTarget && (
          <LaunchModal
            clinic={launchTarget.clinic}
            sequences={sequences}
            prefillTrigger={launchTarget.prefillTrigger}
            onLaunch={fu => handleLaunch(launchTarget.clinic, fu)}
            onClose={() => setLaunchTarget(null)}
          />
        )}

        {/* Detail panel */}
        {selected && (
          <DetailPanel
            clinic={selected}
            sequences={sequences}
            onClose={() => setSelected(null)}
            onUpdate={handleUpdate}
            onOpenLaunch={(c, trig) => {
              setSelected(null);
              setTimeout(() => setLaunchTarget({ clinic: c, prefillTrigger: trig || null }), 100);
            }}
          />
        )}

        {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      </div>
    </>
  );
}
