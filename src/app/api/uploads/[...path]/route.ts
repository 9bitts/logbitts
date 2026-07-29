import fs from "fs/promises";
import path from "path";
import { requireSession } from "@/server/session";
import { safeUploadParts } from "@/server/storage";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    const session = await requireSession();
    const parts = (await ctx.params).path;
    const safe = safeUploadParts(parts, session.organizationId);
    if (!safe) {
      return new Response("Forbidden", { status: 403 });
    }
    const filePath = path.join(process.cwd(), "uploads", ...safe);
    const resolved = path.resolve(filePath);
    const root = path.resolve(path.join(process.cwd(), "uploads", session.organizationId));
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      return new Response("Forbidden", { status: 403 });
    }
    const data = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const type =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";
    return new Response(data, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response("Not found", { status: 404 });
  }
}
