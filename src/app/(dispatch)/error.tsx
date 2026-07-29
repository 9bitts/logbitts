"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="panel" style={{ margin: "1.25rem auto", maxWidth: 640 }}>
      <h1 className="page-title">Algo deu errado</h1>
      <p className="page-sub">{error.message || "Erro inesperado"}</p>
      <button type="button" className="btn" onClick={reset}>
        Tentar de novo
      </button>
    </div>
  );
}
