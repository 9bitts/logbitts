import { z } from "zod";

export function parseBody<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    throw new Response(JSON.stringify({ error: msg || "Dados inválidos" }), {
      status: 400,
    });
  }
  return parsed.data;
}

export function paginationFromUrl(url: URL, defaults = { limit: 100, max: 500 }) {
  const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
  let limit = Number(url.searchParams.get("limit") || defaults.limit) || defaults.limit;
  limit = Math.min(Math.max(1, limit), defaults.max);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export const idSchema = z.string().min(1);
