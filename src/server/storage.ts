import fs from "fs/promises";
import path from "path";
import { createHash, createHmac } from "crypto";
import { nanoid } from "nanoid";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function parseDataUrl(dataUrl: string) {
  const match = /^data:(.+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Arquivo inválido");
  const mime = match[1].toLowerCase();
  if (!ALLOWED.has(mime) && !mime.startsWith("image/")) {
    throw new Error("Tipo de arquivo não permitido");
  }
  const buf = Buffer.from(match[2], "base64");
  if (buf.length > MAX_BYTES) throw new Error("Arquivo muito grande (máx 5MB)");
  const ext = mime.includes("png")
    ? "png"
    : mime.includes("webp")
      ? "webp"
      : "jpg";
  return { mime: mime.includes("png") ? "image/png" : mime.includes("webp") ? "image/webp" : "image/jpeg", buf, ext };
}

function driver() {
  return (process.env.STORAGE_DRIVER || "local").toLowerCase();
}

async function saveLocal(
  organizationId: string,
  filename: string,
  buf: Buffer,
): Promise<string> {
  const dir = path.join(process.cwd(), "uploads", organizationId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buf);
  return `/api/uploads/${organizationId}/${filename}`;
}

/** Minimal S3/R2 PutObject (SigV4) — no AWS SDK. */
async function saveS3(
  organizationId: string,
  filename: string,
  buf: Buffer,
  mime: string,
): Promise<string> {
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY_ID;
  const secretKey = process.env.S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.S3_ENDPOINT; // e.g. https://xxx.r2.cloudflarestorage.com
  const region = process.env.S3_REGION || "auto";
  if (!bucket || !accessKey || !secretKey || !endpoint) {
    throw new Error("S3 storage requires S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT");
  }

  const key = `${organizationId}/${filename}`;
  const url = new URL(`${endpoint.replace(/\/$/, "")}/${bucket}/${key}`);
  const host = url.host;
  const amzDate = new Date()
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "")
    .replace("Z", "Z");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = createHash("sha256").update(buf).digest("hex");
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  const kDate = createHmac("sha256", `AWS4${secretKey}`).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update("s3").digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const auth = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      Host: host,
      "Content-Type": mime,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: auth,
    },
    body: new Uint8Array(buf),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`S3 upload failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const publicBase = process.env.S3_PUBLIC_BASE_URL;
  if (publicBase) {
    return `${publicBase.replace(/\/$/, "")}/${key}`;
  }
  // Fall back to proxied API path (caller must sync/serve separately)
  return `/api/uploads/${organizationId}/${filename}`;
}

export async function saveProofFile(
  organizationId: string,
  dataUrl: string,
  kind: "photo" | "signature",
): Promise<string> {
  const { mime, buf, ext } = parseDataUrl(dataUrl);
  const filename = `${kind}_${nanoid(10)}.${ext}`;
  if (driver() === "s3") {
    return saveS3(organizationId, filename, buf, mime);
  }
  return saveLocal(organizationId, filename, buf);
}

/** Reject path traversal; return safe relative segments under org. */
export function safeUploadParts(parts: string[], organizationId: string): string[] | null {
  if (!parts?.length || parts[0] !== organizationId) return null;
  const rest = parts.slice(1);
  if (!rest.length) return null;
  for (const p of rest) {
    if (!p || p === "." || p === ".." || p.includes("\0") || p.includes("/") || p.includes("\\")) {
      return null;
    }
  }
  return [organizationId, ...rest];
}
