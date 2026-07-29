"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const links = [
  { href: "/torre", label: "Torre" },
  { href: "/rotas", label: "Rotas" },
  { href: "/entregas", label: "Entregas" },
  { href: "/estoque", label: "Estoque" },
  { href: "/patio", label: "Pátio" },
  { href: "/frete", label: "Frete" },
  { href: "/cadastros", label: "Cadastros" },
];

export function DispatchShell({
  children,
  userName,
  orgName,
}: {
  children: React.ReactNode;
  userName?: string;
  orgName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="dispatch-shell min-h-screen">
      <header className="dispatch-header">
        <div className="brand">
          <span className="brand-mark">L</span>
          <div>
            <strong>Logbitts</strong>
            <small>{orgName || "Despacho"}</small>
          </div>
        </div>
        <nav>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname.startsWith(l.href) ? "active" : ""}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="header-right">
          <Link href="/armazem" className="ghost-link">
            App armazém
          </Link>
          <Link href="/motorista" className="ghost-link">
            App motorista
          </Link>
          <span className="user-chip">{userName}</span>
          <button
            type="button"
            className="btn-ghost"
            onClick={async () => {
              await authClient.signOut();
              router.push("/login");
            }}
          >
            Sair
          </button>
        </div>
      </header>
      <main className="dispatch-main">{children}</main>
    </div>
  );
}
