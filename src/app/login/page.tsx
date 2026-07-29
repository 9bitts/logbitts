"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("despacho@logbitts.demo");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: err } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message || "Falha no login");
      return;
    }
    if (email.includes("motorista")) router.push("/motorista");
    else if (email.includes("armazem")) router.push("/armazem");
    else router.push("/torre");
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="brand" style={{ marginBottom: "1rem" }}>
          <span className="brand-mark">L</span>
          <div>
            <strong>Logbitts</strong>
            <small>Fase 1 — DMS</small>
          </div>
        </div>
        <h1>Entrar</h1>
        <p>Fase 3 — DMS + WMS + Frete embarcador.</p>
        <div className="field">
          <label>E-mail</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </div>
        <div className="field">
          <label>Senha</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </div>
        {error ? (
          <p style={{ color: "var(--bad)", marginBottom: "0.75rem" }}>{error}</p>
        ) : null}
        <button className="btn" style={{ width: "100%" }} disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
        <p className="muted" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
          despacho@logbitts.demo / demo1234
          <br />
          armazem@logbitts.demo / demo1234
          <br />
          motorista@logbitts.demo / demo1234
        </p>
      </form>
    </div>
  );
}
