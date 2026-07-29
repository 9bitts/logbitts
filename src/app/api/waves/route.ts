import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireWarehouse } from "@/server/session";
import { id, todayISO } from "@/server/lib/ids";
import { adjustStock, findBestPickLocation } from "@/server/stock";

async function loadWave(waveId: string, organizationId: string) {
  const db = await getDb();
  const [w] = await db
    .select()
    .from(schema.pickWave)
    .where(
      and(
        eq(schema.pickWave.id, waveId),
        eq(schema.pickWave.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!w) return null;
  const tasks = await db
    .select({
      task: schema.pickTask,
      product: schema.product,
      location: schema.location,
      delivery: schema.delivery,
    })
    .from(schema.pickTask)
    .innerJoin(schema.product, eq(schema.pickTask.productId, schema.product.id))
    .leftJoin(
      schema.location,
      eq(schema.pickTask.fromLocationId, schema.location.id),
    )
    .innerJoin(
      schema.delivery,
      eq(schema.pickTask.deliveryId, schema.delivery.id),
    )
    .where(eq(schema.pickTask.waveId, waveId));
  return {
    ...w,
    tasks: tasks.map((t) => ({
      ...t.task,
      product: t.product,
      fromLocation: t.location,
      delivery: t.delivery,
    })),
  };
}

export async function GET(req: Request) {
  try {
    const ctx = await requireWarehouse();
    const url = new URL(req.url);
    const waveId = url.searchParams.get("id");
    if (waveId) {
      const detail = await loadWave(waveId, ctx.organizationId);
      if (!detail) return json({ error: "Onda não encontrada" }, 404);
      return json(detail);
    }
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.pickWave)
      .where(eq(schema.pickWave.organizationId, ctx.organizationId))
      .orderBy(desc(schema.pickWave.createdAt));
    return json(rows);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireWarehouse();
    const body = await req.json();
    const db = await getDb();
    const action = body.action as string | undefined;

    if (!action || action === "create") {
      const [wh] = await db
        .select()
        .from(schema.warehouse)
        .where(eq(schema.warehouse.organizationId, ctx.organizationId))
        .limit(1);
      if (!wh) return json({ error: "Cadastre um warehouse" }, 400);

      const deliveryIds: string[] = body.deliveryIds || [];
      if (!deliveryIds.length) {
        return json({ error: "Selecione entregas pending" }, 400);
      }

      const deliveries = await db
        .select()
        .from(schema.delivery)
        .where(
          and(
            eq(schema.delivery.organizationId, ctx.organizationId),
            inArray(schema.delivery.id, deliveryIds),
          ),
        );
      const pending = deliveries.filter((d) => d.status === "pending");
      if (!pending.length) {
        return json({ error: "Nenhuma entrega pending válida" }, 400);
      }

      const wave = {
        id: id("wav"),
        organizationId: ctx.organizationId,
        warehouseId: wh.id,
        name: body.name || `Onda ${todayISO()}`,
        waveDate: body.waveDate || todayISO(),
        status: "draft",
        createdAt: new Date(),
        releasedAt: null,
        completedAt: null,
      };
      await db.insert(schema.pickWave).values(wave);

      for (const del of pending) {
        let lines = await db
          .select()
          .from(schema.deliveryLine)
          .where(eq(schema.deliveryLine.deliveryId, del.id));

        if (!lines.length) {
          const [fallback] = await db
            .select()
            .from(schema.product)
            .where(eq(schema.product.organizationId, ctx.organizationId))
            .limit(1);
          if (!fallback) {
            return json({ error: "Cadastre produtos antes de pickar" }, 400);
          }
          const line = {
            id: id("dln"),
            organizationId: ctx.organizationId,
            deliveryId: del.id,
            productId: fallback.id,
            qty: 1,
            qtyPicked: 0,
          };
          await db.insert(schema.deliveryLine).values(line);
          lines = [line];
        }

        for (const line of lines) {
          const best = await findBestPickLocation(
            ctx.organizationId,
            line.productId,
            line.qty,
          );
          await db.insert(schema.pickTask).values({
            id: id("ptk"),
            organizationId: ctx.organizationId,
            waveId: wave.id,
            deliveryId: del.id,
            deliveryLineId: line.id,
            productId: line.productId,
            fromLocationId: best?.location.id || null,
            qty: line.qty,
            qtyPicked: 0,
            status: "pending",
            assignedUserId: null,
            completedAt: null,
          });
        }

        await db
          .update(schema.delivery)
          .set({ status: "picking", updatedAt: new Date() })
          .where(eq(schema.delivery.id, del.id));
      }

      return json(await loadWave(wave.id, ctx.organizationId), 201);
    }

    if (action === "release") {
      await db
        .update(schema.pickWave)
        .set({ status: "released", releasedAt: new Date() })
        .where(
          and(
            eq(schema.pickWave.id, body.id),
            eq(schema.pickWave.organizationId, ctx.organizationId),
          ),
        );
      return json(await loadWave(body.id, ctx.organizationId));
    }

    if (action === "complete_task") {
      const taskId = body.taskId as string;
      const qtyPicked = Number(body.qtyPicked ?? body.qty);
      const [task] = await db
        .select()
        .from(schema.pickTask)
        .where(
          and(
            eq(schema.pickTask.id, taskId),
            eq(schema.pickTask.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!task) return json({ error: "Tarefa não encontrada" }, 404);
      if (!task.fromLocationId) {
        return json({ error: "Tarefa sem endereço de origem" }, 400);
      }

      await adjustStock({
        organizationId: ctx.organizationId,
        productId: task.productId,
        locationId: task.fromLocationId,
        qtyDelta: -qtyPicked,
        type: "pick",
        userId: ctx.user.id,
        refType: "pick_task",
        refId: task.id,
      });

      // move to shipping dock
      const [shipLoc] = await db
        .select()
        .from(schema.location)
        .where(
          and(
            eq(schema.location.organizationId, ctx.organizationId),
            eq(schema.location.type, "shipping"),
          ),
        )
        .limit(1);
      if (shipLoc) {
        await adjustStock({
          organizationId: ctx.organizationId,
          productId: task.productId,
          locationId: shipLoc.id,
          qtyDelta: qtyPicked,
          type: "pick",
          userId: ctx.user.id,
          refType: "pick_task",
          refId: task.id,
          notes: "staging shipping",
        });
      }

      await db
        .update(schema.pickTask)
        .set({
          qtyPicked,
          status: "done",
          assignedUserId: ctx.user.id,
          completedAt: new Date(),
        })
        .where(eq(schema.pickTask.id, task.id));

      if (task.deliveryLineId) {
        await db
          .update(schema.deliveryLine)
          .set({ qtyPicked })
          .where(eq(schema.deliveryLine.id, task.deliveryLineId));
      }

      const deliveryTasks = await db
        .select()
        .from(schema.pickTask)
        .where(eq(schema.pickTask.deliveryId, task.deliveryId));
      const allDone = deliveryTasks.every(
        (t) => t.status === "done" || t.id === task.id,
      );
      if (allDone) {
        await db
          .update(schema.delivery)
          .set({ status: "ready_to_ship", updatedAt: new Date() })
          .where(eq(schema.delivery.id, task.deliveryId));
      }

      const waveTasks = await db
        .select()
        .from(schema.pickTask)
        .where(eq(schema.pickTask.waveId, task.waveId));
      if (waveTasks.every((t) => t.status === "done" || t.id === task.id)) {
        await db
          .update(schema.pickWave)
          .set({ status: "done", completedAt: new Date() })
          .where(eq(schema.pickWave.id, task.waveId));
      }

      return json(await loadWave(task.waveId, ctx.organizationId));
    }

    return json({ error: "action inválida" }, 400);
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: (e as Error).message }, 400);
  }
}
