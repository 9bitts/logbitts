import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAuth } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { DispatchShell } from "@/components/dispatch-shell";
import { allowDemoBootstrap } from "@/server/env";

export const dynamic = "force-dynamic";

export default async function DispatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const db = await getDb();
  const [membership] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.userId, session.user.id))
    .limit(1);

  if (membership?.role === "driver") {
    redirect("/motorista");
  }
  if (membership?.role === "warehouse") {
    redirect("/armazem");
  }

  let orgName = "Logbitts";
  if (membership) {
    const [org] = await db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.id, membership.organizationId))
      .limit(1);
    if (org) orgName = org.name;
  }

  return (
    <DispatchShell
      userName={session.user.name}
      orgName={orgName}
      showDemoApps={allowDemoBootstrap()}
    >
      {children}
    </DispatchShell>
  );
}
