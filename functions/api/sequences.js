// Cloudflare Pages Function: /functions/api/sequences.js
// Stores all sequences as a single JSON document (key="all")

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT data FROM sequences WHERE id = 'all'"
    ).all();
    const data = results[0]?.data ? JSON.parse(results[0].data) : [];
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const sequences = await request.json();
    // Upsert: insert the row if it doesn't exist yet, otherwise update it.
    // (A bare UPDATE silently no-ops on a fresh DB, losing the save.)
    await env.DB.prepare(
      `INSERT INTO sequences (id, data, updated_at)
       VALUES ('all', ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    ).bind(JSON.stringify(sequences)).run();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
