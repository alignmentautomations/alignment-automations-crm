// Cloudflare Pages Function: /functions/api/prospects/[id].js

import { deriveAutoSignals, computeScore, tierFor } from "../_lib/prospecting.js";

function parseProspect(p) {
  return {
    ...p,
    website_check: p.website_check ? JSON.parse(p.website_check) : {},
    manual_signals: p.manual_signals ? JSON.parse(p.manual_signals) : { runsAds: false, growthIntent: false, ownerOperated: false },
  };
}

export async function onRequestPatch({ params, request, env }) {
  try {
    const { id } = params;
    const patch = await request.json();

    const { results: rows } = await env.DB.prepare("SELECT * FROM prospects WHERE id = ?").bind(id).all();
    const current = rows[0];
    if (!current) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }

    const currentSignals = current.manual_signals ? JSON.parse(current.manual_signals) : { runsAds: false, growthIntent: false, ownerOperated: false };
    const mergedSignals = { ...currentSignals, ...(patch.manualSignals || {}) };

    const nextWebsite = patch.website !== undefined ? patch.website : current.website;
    const nextEmail = patch.email !== undefined ? patch.email : current.email;
    const nextPhone = patch.phone !== undefined ? patch.phone : current.phone;
    const websiteCheck = current.website_check ? JSON.parse(current.website_check) : {};

    const auto = deriveAutoSignals({ website: nextWebsite, websiteCheck, phone: nextPhone, email: nextEmail });
    const signals = { ...auto, ...mergedSignals };
    const score = computeScore(signals);
    const tier = tierFor(score).label;

    const updates = ["manual_signals = ?", "score = ?", "tier = ?"];
    const values = [JSON.stringify(mergedSignals), score, tier];

    if (patch.email !== undefined) { updates.push("email = ?"); values.push(patch.email); }
    if (patch.phone !== undefined) { updates.push("phone = ?"); values.push(patch.phone); }
    if (patch.website !== undefined) { updates.push("website = ?"); values.push(patch.website); }
    if (patch.channel !== undefined) { updates.push("channel = ?"); values.push(patch.channel); }
    if (patch.leakFlagged !== undefined) { updates.push("leak_flagged = ?"); values.push(patch.leakFlagged); }
    if (patch.dateSent !== undefined) { updates.push("date_sent = ?"); values.push(patch.dateSent); }
    if (patch.watched !== undefined) { updates.push("watched = ?"); values.push(patch.watched ? 1 : 0); }
    if (patch.replied !== undefined) { updates.push("replied = ?"); values.push(patch.replied ? 1 : 0); }
    if (patch.nextFollowUp !== undefined) { updates.push("next_follow_up = ?"); values.push(patch.nextFollowUp); }
    if (patch.outreachStage !== undefined) { updates.push("outreach_stage = ?"); values.push(patch.outreachStage); }

    await env.DB.prepare(`UPDATE prospects SET ${updates.join(", ")} WHERE id = ?`).bind(...values, id).run();

    const { results: updatedRows } = await env.DB.prepare("SELECT * FROM prospects WHERE id = ?").bind(id).all();
    return new Response(JSON.stringify(parseProspect(updatedRows[0])), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}

export async function onRequestDelete({ params, env }) {
  try {
    const { id } = params;
    await env.DB.prepare("DELETE FROM prospects WHERE id = ?").bind(id).run();
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
