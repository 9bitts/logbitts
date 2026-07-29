import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id } from "@/server/lib/ids";

export async function GET(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const invoiceId = new URL(req.url).searchParams.get("id");
    const db = await getDb();

    if (invoiceId) {
      const [inv] = await db
        .select({
          invoice: schema.freightInvoice,
          carrier: schema.carrier,
        })
        .from(schema.freightInvoice)
        .innerJoin(
          schema.carrier,
          eq(schema.freightInvoice.carrierId, schema.carrier.id),
        )
        .where(
          and(
            eq(schema.freightInvoice.id, invoiceId),
            eq(schema.freightInvoice.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!inv) return json({ error: "Não encontrado" }, 404);
      const lines = await db
        .select()
        .from(schema.freightInvoiceLine)
        .where(eq(schema.freightInvoiceLine.invoiceId, invoiceId));
      return json({ ...inv.invoice, carrier: inv.carrier, lines });
    }

    const rows = await db
      .select({
        invoice: schema.freightInvoice,
        carrier: schema.carrier,
      })
      .from(schema.freightInvoice)
      .innerJoin(
        schema.carrier,
        eq(schema.freightInvoice.carrierId, schema.carrier.id),
      )
      .where(eq(schema.freightInvoice.organizationId, ctx.organizationId))
      .orderBy(desc(schema.freightInvoice.createdAt));

    return json(rows.map((r) => ({ ...r.invoice, carrier: r.carrier })));
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

    if (!action || action === "create") {
      const cteIds: string[] = body.cteIds || [];
      const ctes =
        cteIds.length === 0
          ? []
          : await db
              .select()
              .from(schema.cteDocument)
              .where(
                and(
                  eq(schema.cteDocument.organizationId, ctx.organizationId),
                  inArray(schema.cteDocument.id, cteIds),
                ),
              );

      const totalFromCtes = ctes.reduce((s, c) => s + (c.freightAmount || 0), 0);
      const totalAmount = Number(body.totalAmount ?? totalFromCtes);

      const inv = {
        id: id("fin"),
        organizationId: ctx.organizationId,
        carrierId: String(body.carrierId),
        number: String(body.number || "").trim(),
        issueDate: body.issueDate || new Date().toISOString().slice(0, 10),
        totalAmount,
        status: "open",
        notes: body.notes || null,
        createdAt: new Date(),
        reconciledAt: null,
      };
      if (!inv.carrierId || !inv.number) {
        return json({ error: "carrierId e number obrigatórios" }, 400);
      }
      await db.insert(schema.freightInvoice).values(inv);

      for (const cte of ctes) {
        const expected = cte.expectedAmount ?? cte.freightAmount;
        const variance = cte.freightAmount - (expected || 0);
        const ok = Math.abs(variance) <= Math.max((expected || 0) * 0.05, 1);
        await db.insert(schema.freightInvoiceLine).values({
          id: id("fil"),
          organizationId: ctx.organizationId,
          invoiceId: inv.id,
          cteId: cte.id,
          shipmentId: cte.shipmentId,
          description: `CT-e ${cte.number || cte.chave || cte.id}`,
          amount: cte.freightAmount,
          expectedAmount: expected,
          variance,
          status: ok ? "ok" : "mismatch",
        });
      }

      return json(inv, 201);
    }

    if (action === "reconcile") {
      const lines = await db
        .select()
        .from(schema.freightInvoiceLine)
        .where(eq(schema.freightInvoiceLine.invoiceId, body.id));
      const hasMismatch = lines.some((l) => l.status === "mismatch");
      await db
        .update(schema.freightInvoice)
        .set({
          status: hasMismatch ? "disputed" : "reconciled",
          reconciledAt: hasMismatch ? null : new Date(),
        })
        .where(
          and(
            eq(schema.freightInvoice.id, body.id),
            eq(schema.freightInvoice.organizationId, ctx.organizationId),
          ),
        );
      for (const cteId of lines.map((l) => l.cteId).filter(Boolean)) {
        await db
          .update(schema.cteDocument)
          .set({ status: hasMismatch ? "mismatch" : "reconciled" })
          .where(eq(schema.cteDocument.id, cteId!));
      }
      return json({ ok: true, status: hasMismatch ? "disputed" : "reconciled" });
    }

    return json({ error: "action inválida" }, 400);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
