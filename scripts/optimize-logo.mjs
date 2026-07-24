/**
 * Recompress public/logo.png for faster header loads (display max ~272px wide).
 * Run: node scripts/optimize-logo.mjs
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logoPath = path.join(__dirname, "..", "public", "logo.png");

const before = await fs.stat(logoPath);
const meta = await sharp(logoPath).metadata();

const optimized = await sharp(logoPath)
  .resize({ width: 800, withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
  .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 90 })
  .toBuffer();

await fs.writeFile(logoPath, optimized);

const after = await fs.stat(logoPath);
const outMeta = await sharp(logoPath).metadata();
console.log(
  `logo.png: ${meta.width}x${meta.height} (${before.size} bytes) -> ${outMeta.width}x${outMeta.height} (${after.size} bytes)`
);
