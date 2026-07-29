import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id } from "@/server/lib/ids";

const TOLERANCE = 0.05; // 5%

export async function GET() {
  try {
    const ctx = await requireDispatcher();
    const db = await getDb();
    const rows = await db
      .select({
        cte: schema.cteDocument,
        carrier: schema.carrier,
        shipment: schema.freightShipment,
      })
      .from(schema.cteDocument)
      .leftJoin(schema.carrier, eq(schema.cteDocument.carrierId, schema.carrier.id))
      .leftJoin(
        schema.freightShipment,
        eq(schema.cteDocument.shipmentId, schema.freightShipment.id),
      )
      .where(eq(schema.cteDocument.organizationId, ctx.organizationId))
      .orderBy(desc(schema.cteDocument.createdAt));
    return json(
      rows.map((r) => ({
        ...r.cte,
        carrier: r.carrier,
        shipment: r.shipment,
      })),
    );
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

    if (!action || action === "import") {
      // Manual / JSON stub of CT-e (XML parse deferred to fiscal phase)
      let shipmentId = body.shipmentId || null;
      let expectedAmount: number | null = body.expectedAmount ?? null;
      let carrierId = body.carrierId || null;

      if (shipmentId) {
        const [sh] = await db
          .select()
          .from(schema.freightShipment)
          .where(
            and(
              eq(schema.freightShipment.id, shipmentId),
              eq(schema.freightShipment.organizationId, ctx.organizationId),
            ),
          )
          .limit(1);
        if (sh) {
          expectedAmount = sh.expectedAmount;
          carrierId = sh.carrierId;
        }
      } else if (body.carrierDocument) {
        const [car] = await db
          .select()
          .from(schema.carrier)
          .where(
            and(
              eq(schema.carrier.organizationId, ctx.organizationId),
              eq(schema.carrier.document, String(body.carrierDocument)),
            ),
          )
          .limit(1);
        if (car) carrierId = car.id;
        // auto-match open shipment by carrier + amount proximity
        if (!shipmentId && carrierId) {
          const open = await db
            .select()
            .from(schema.freightShipment)
            .where(
              and(
                eq(schema.freightShipment.organizationId, ctx.organizationId),
                eq(schema.freightShipment.carrierId, carrierId),
              ),
            );
          const amt = Number(body.freightAmount || 0);
          const hit = open.find((s) => {
            const v = Math.abs(s.expectedAmount - amt);
            return v <= Math.max(s.expectedAmount * TOLERANCE, 1);
          });
          if (hit) {
            shipmentId = hit.id;
            expectedAmount = hit.expectedAmount;
          }
        }
      }

      const freightAmount = Number(body.freightAmount || 0);
      const variance =
        expectedAmount != null ? freightAmount - expectedAmount : null;
      let status = "imported";
      if (expectedAmount != null) {
        const ok =
          Math.abs(variance!) <= Math.max(expectedAmount * TOLERANCE, 1);
        status = ok ? "matched" : "mismatch";
      }

      const row = {
        id: id("cte"),
        organizationId: ctx.organizationId,
        shipmentId,
        carrierId,
        chave: body.chave || null,
        number: body.number || null,
        series: body.series || "1",
        issueDate: body.issueDate || new Date().toISOString().slice(0, 10),
        carrierDocument: body.carrierDocument || null,
        freightAmount,
        weightKg: body.weightKg != null ? Number(body.weightKg) : null,
        originCity: body.originCity || null,
        destCity: body.destCity || null,
        status,
        expectedAmount,
        variance,
        notes: body.notes || null,
        createdAt: new Date(),
      };
      await db.insert(schema.cteDocument).values(row);
      return json(row, 201);
    }

    if (action === "reconcile") {
      await db
        .update(schema.cteDocument)
        .set({ status: "reconciled" })
        .where(
          and(
            eq(schema.cteDocument.id, body.id),
            eq(schema.cteDocument.organizationId, ctx.organizationId),
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
