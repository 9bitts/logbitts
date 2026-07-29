import fs from "fs/promises";
import path from "path";
import { requireSession } from "@/server/session";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    const session = await requireSession();
    const parts = (await ctx.params).path;
    if (!parts?.length || parts[0] !== session.organizationId) {
      return new Response("Forbidden", { status: 403 });
    }
    const filePath = path.join(process.cwd(), "uploads", ...parts);
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
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
