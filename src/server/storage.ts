import fs from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

export async function saveProofFile(
  organizationId: string,
  dataUrl: string,
  kind: "photo" | "signature",
): Promise<string> {
  const match = /^data:(.+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Arquivo inválido");
  const mime = match[1];
  const ext = mime.includes("png")
    ? "png"
    : mime.includes("webp")
      ? "webp"
      : "jpg";
  const buf = Buffer.from(match[2], "base64");
  const dir = path.join(process.cwd(), "uploads", organizationId);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${kind}_${nanoid(10)}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buf);
  return `/api/uploads/${organizationId}/${filename}`;
}
