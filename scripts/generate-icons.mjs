import sharp from "sharp";
import path from "path";
import fs from "fs";

const dir = path.join(process.cwd(), "public");
fs.mkdirSync(dir, { recursive: true });

async function icon(size, file) {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f1c2e"/>
  <text x="50%" y="54%" text-anchor="middle" font-family="Arial,sans-serif" font-size="280" font-weight="700" fill="#14b8a6">L</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(dir, file));
}

await icon(192, "icon-192.png");
await icon(512, "icon-512.png");
console.log("icons ok");
