import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const LOGO_EXPORT_WIDTH = 1440;

const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/generate-logo-assets.mjs <source.png>");
  process.exit(1);
}

const out = {
  logo: path.join(root, "public", "logo.png"),
  og: path.join(root, "public", "og-image.png"),
};

const meta = await sharp(source).metadata();
const { width = 0, height = 0 } = meta;
console.log("Source:", width, "x", height);

// Trim whitespace padding, then export wordmark at 2x retina width (preserve aspect)
const logoBuffer = await sharp(source)
  .flatten({ background: "#ffffff" })
  .trim({ threshold: 10 })
  .resize({ width: LOGO_EXPORT_WIDTH, withoutEnlargement: false, kernel: sharp.kernel.lanczos3 })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();

await sharp(logoBuffer).toFile(out.logo);

const logoMeta = await sharp(logoBuffer).metadata();
console.log("Logo export:", logoMeta.width, "x", logoMeta.height);

// OG image: trimmed wordmark centered on light gray background 1200x630
const ogLogoWidth = 640;
const ogLogo = await sharp(source)
  .flatten({ background: "#ffffff" })
  .trim({ threshold: 10 })
  .resize({ width: ogLogoWidth, kernel: sharp.kernel.lanczos3 })
  .png()
  .toBuffer();
const ogLogoMeta = await sharp(ogLogo).metadata();
const ogLogoH = ogLogoMeta.height ?? 200;

await sharp({
  create: {
    width: 1200,
    height: 630,
    channels: 3,
    background: { r: 249, g: 250, b: 251 },
  },
})
  .composite([
    {
      input: ogLogo,
      left: Math.round((1200 - ogLogoWidth) / 2),
      top: Math.round((630 - ogLogoH) / 2),
    },
  ])
  .png()
  .toFile(out.og);

console.log("Wrote:", Object.values(out).join("\n  "));
console.log(
  `Update BrandLogo LOGO_WIDTH=${logoMeta.width ?? LOGO_EXPORT_WIDTH} LOGO_HEIGHT=${logoMeta.height ?? "?"} in components/BrandLogo.tsx`
);
console.log("Note: favicon/icon/appicon are not overwritten — edit those files manually.");
