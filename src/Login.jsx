import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) setErr(error.message);
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: 16 }}>
      <h2>Sign in</h2>
      <form onSubmit={handleLogin} style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
        />
        <button disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        {err ? <div style={{ color: "crimson" }}>{err}</div> : null}
      </form>
    </div>
  );
}