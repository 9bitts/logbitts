import { and, eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import type { MemberRole } from "./db/schema";
import { getAuth } from "./auth";
import { headers } from "next/headers";

export type SessionContext = {
  user: { id: string; name: string; email: string };
  organizationId: string;
  role: MemberRole;
};

export async function requireSession(): Promise<SessionContext> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401,
    });
  }

  const db = await getDb();
  const orgId =
    (session.session as { activeOrganizationId?: string | null })
      .activeOrganizationId || null;

  let membership = orgId
    ? (
        await db
          .select()
          .from(schema.member)
          .where(
            and(
              eq(schema.member.userId, session.user.id),
              eq(schema.member.organizationId, orgId),
            ),
          )
          .limit(1)
      )[0]
    : undefined;

  if (!membership) {
    membership = (
      await db
        .select()
        .from(schema.member)
        .where(eq(schema.member.userId, session.user.id))
        .limit(1)
    )[0];
  }

  if (!membership) {
    throw new Response(
      JSON.stringify({ error: "Usuário sem organização" }),
      { status: 403 },
    );
  }

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
    organizationId: membership.organizationId,
    role: membership.role as MemberRole,
  };
}

export async function requireDispatcher() {
  const ctx = await requireSession();
  if (ctx.role === "driver") {
    throw new Response(JSON.stringify({ error: "Sem permissão" }), {
      status: 403,
    });
  }
  return ctx;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}
