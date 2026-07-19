import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const LOGO_EXPORT_WIDTH = 1440;
const FAVICON_SIZE = 96;

const faviconOut = {
  favicon: path.join(root, "app", "favicon.png"),
  icon: path.join(root, "app", "icon.png"),
  appicon: path.join(root, "public", "appicon.png"),
  publicFavicon: path.join(root, "public", "favicon.png"),
};

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveFaviconSource(explicitSource) {
  if (explicitSource) return explicitSource;

  const brandSource = path.join(root, "assets", "brand", "favicon-source.png");
  if (await fileExists(brandSource)) return brandSource;

  return path.join(root, "app", "favicon.png");
}

async function generateFavicons(explicitSource) {
  const source = await resolveFaviconSource(explicitSource);
  if (!(await fileExists(source))) {
    console.error("Favicon source not found:", source);
    process.exit(1);
  }

  const meta = await sharp(source).metadata();
  console.log("Favicon source:", source, `${meta.width}x${meta.height}`);

  const faviconBuffer = await sharp(source)
    .resize(FAVICON_SIZE, FAVICON_SIZE, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  for (const outPath of Object.values(faviconOut)) {
    await sharp(faviconBuffer).toFile(outPath);
  }

  console.log("Wrote favicons (96x96):");
  console.log(" ", Object.values(faviconOut).join("\n  "));
}

async function generateWordmark(source) {
  const out = {
    logo: path.join(root, "public", "logo.png"),
    og: path.join(root, "public", "og-image.png"),
  };

  const meta = await sharp(source).metadata();
  const { width = 0, height = 0 } = meta;
  console.log("Wordmark source:", width, "x", height);

  const logoBuffer = await sharp(source)
    .flatten({ background: "#ffffff" })
    .trim({ threshold: 10 })
    .resize({ width: LOGO_EXPORT_WIDTH, withoutEnlargement: false, kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  await sharp(logoBuffer).toFile(out.logo);

  const logoMeta = await sharp(logoBuffer).metadata();
  console.log("Logo export:", logoMeta.width, "x", logoMeta.height);

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

  console.log("Wrote wordmark assets:");
  console.log(" ", Object.values(out).join("\n  "));
  console.log(
    `Update BrandLogo LOGO_WIDTH=${logoMeta.width ?? LOGO_EXPORT_WIDTH} LOGO_HEIGHT=${logoMeta.height ?? "?"} in components/BrandLogo.tsx`
  );
}

const args = process.argv.slice(2);

if (args[0] === "--favicons") {
  await generateFavicons(args[1]);
} else if (args[0]) {
  await generateWordmark(args[0]);
  await generateFavicons();
} else {
  console.error("Usage:");
  console.error("  node scripts/generate-logo-assets.mjs <wordmark-source.png>");
  console.error("  node scripts/generate-logo-assets.mjs --favicons [favicon-source.png]");
  process.exit(1);
}
