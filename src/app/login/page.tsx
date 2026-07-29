"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const showDemo =
  process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === "1" ||
  process.env.NODE_ENV !== "production";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(showDemo ? "despacho@logbitts.demo" : "");
  const [password, setPassword] = useState(showDemo ? "demo1234" : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: err } = await authClient.signIn.email({ email, password });
      if (err) {
        setError(err.message || "Falha no login");
        return;
      }
      if (email.includes("motorista")) router.push("/motorista");
      else if (email.includes("armazem")) router.push("/armazem");
      else router.push("/torre");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível conectar ao servidor de autenticação",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="brand" style={{ marginBottom: "1rem" }}>
          <span className="brand-mark">L</span>
          <div>
            <strong>Logbitts</strong>
            <small>Plataforma completa</small>
          </div>
        </div>
        <h1>Entrar</h1>
        <p>Logbitts — DMS + WMS + TMS + YMS + ERP + 3PL + marketplace.</p>
        <div className="field">
          <label>E-mail</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label>Senha</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        {error ? (
          <p style={{ color: "var(--bad)", marginBottom: "0.75rem" }}>{error}</p>
        ) : null}
        <button className="btn" style={{ width: "100%" }} disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
        {showDemo ? (
          <p className="muted" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
            despacho@logbitts.demo / demo1234
            <br />
            armazem@logbitts.demo / demo1234
            <br />
            motorista@logbitts.demo / demo1234
          </p>
        ) : null}
      </form>
    </div>
  );
}
