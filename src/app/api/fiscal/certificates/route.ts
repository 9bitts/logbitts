import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id, todayISO } from "@/server/lib/ids";
import { emitDomainEvent } from "@/server/events/emit";

function fakeFingerprint() {
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 40; i++) s += hex[Math.floor(Math.random() * 16)];
  return s.match(/.{1,2}/g)?.join(":") || s;
}

export async function GET() {
  try {
    const ctx = await requireDispatcher();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.fiscalCertificate)
      .where(eq(schema.fiscalCertificate.organizationId, ctx.organizationId))
      .orderBy(desc(schema.fiscalCertificate.createdAt));
    return json(rows);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const body = await req.json();
    const db = await getDb();
    const action = body.action as string | undefined;

    if (!action || action === "register") {
      // Demo: "upload" is metadata only — never store private key material
      const row = {
        id: id("crt"),
        organizationId: ctx.organizationId,
        type: body.type === "A3" ? "A3" : "A1",
        alias: String(body.alias || `Cert ${body.type || "A1"}`).trim(),
        cnpj: body.cnpj || null,
        fingerprint: body.fingerprint || fakeFingerprint(),
        storageRef: `demo://cert/${Date.now()}`,
        validFrom: body.validFrom || todayISO(),
        validTo:
          body.validTo ||
          new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
        status: "pending",
        createdAt: new Date(),
      };
      await db.insert(schema.fiscalCertificate).values(row);
      await emitDomainEvent({
        organizationId: ctx.organizationId,
        eventType: "fiscal.certificate.registered",
        entityType: "fiscal_certificate",
        entityId: row.id,
        payload: { type: row.type, alias: row.alias },
      });
      return json(row, 201);
    }

    if (action === "activate") {
      await db
        .update(schema.fiscalCertificate)
        .set({ status: "active" })
        .where(
          and(
            eq(schema.fiscalCertificate.id, body.id),
            eq(schema.fiscalCertificate.organizationId, ctx.organizationId),
          ),
        );
      // Prefer SEFAZ direct when activating cert
      const [cfg] = await db
        .select()
        .from(schema.fiscalProviderConfig)
        .where(
          and(
            eq(schema.fiscalProviderConfig.organizationId, ctx.organizationId),
            eq(schema.fiscalProviderConfig.active, true),
          ),
        )
        .limit(1);
      if (cfg) {
        await db
          .update(schema.fiscalProviderConfig)
          .set({ provider: "sefaz_direct" })
          .where(eq(schema.fiscalProviderConfig.id, cfg.id));
      }
      return json({ ok: true, provider: "sefaz_direct" });
    }

    if (action === "revoke") {
      await db
        .update(schema.fiscalCertificate)
        .set({ status: "revoked" })
        .where(
          and(
            eq(schema.fiscalCertificate.id, body.id),
            eq(schema.fiscalCertificate.organizationId, ctx.organizationId),
          ),
        );
      return json({ ok: true });
    }

    return json({ error: "action inválida" }, 400);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
