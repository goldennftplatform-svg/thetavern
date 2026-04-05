/**
 * Scans MEdiaFiles/ → public/media/platforms/* + manifest.json
 * Run: npm run media:scan (also runs automatically before vite build)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import imageSize from "image-size";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MEDIA_IN = path.join(ROOT, "MEdiaFiles");
const MEDIA_OUT = path.join(ROOT, "public", "media");
const PLATFORMS_OUT = path.join(MEDIA_OUT, "platforms");

const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function safeId(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "platform";
}

function dimensionsOf(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    const d = imageSize(new Uint8Array(buf));
    if (d.width && d.height) return { width: d.width, height: d.height };
  } catch {
    /* corrupt or unknown */
  }
  return null;
}

function classifyFile(filePath, name) {
  const lower = name.toLowerCase();
  if (/banner|wide|header|sign/.test(lower)) return "banner";
  if (/crest|logo|icon|emblem|badge|avatar/.test(lower)) return "crest";
  if (/sky|stars|night|backdrop/.test(lower)) return "sky";
  if (/deck|dock|plank|pier|platform|boards/.test(lower)) return "deck";
  const dim = dimensionsOf(filePath);
  if (!dim) return null;
  const ratio = dim.width / dim.height;
  if (ratio >= 1.45) return "banner";
  if (ratio <= 1.12) return "crest";
  return "deck";
}

function copyPlatform(id, displayName, layerMap) {
  const dir = path.join(PLATFORMS_OUT, id);
  ensureDir(dir);
  const layers = {};
  for (const [role, srcPath] of Object.entries(layerMap)) {
    if (!srcPath || !fs.existsSync(srcPath)) continue;
    const ext = path.extname(srcPath) || ".png";
    const destName = `${role}${ext}`;
    const dest = path.join(dir, destName);
    fs.copyFileSync(srcPath, dest);
    layers[role] = destName;
  }
  return {
    id,
    name: displayName,
    path: `/media/platforms/${id}`,
    layers,
  };
}

function scanSubfolders() {
  const platforms = [];
  if (!fs.existsSync(MEDIA_IN)) return platforms;

  const entries = fs.readdirSync(MEDIA_IN, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name.startsWith(".") || ent.name.startsWith("_")) continue;

    const dir = path.join(MEDIA_IN, ent.name);
    const files = fs.readdirSync(dir).filter((f) => IMAGE_EXT.test(f));
    const layerMap = {};
    for (const f of files) {
      const fp = path.join(dir, f);
      const role =
        /banner/i.test(f)
          ? "banner"
          : /crest|logo|icon/i.test(f)
            ? "crest"
            : /sky/i.test(f)
              ? "sky"
              : /deck|dock|platform|pier/i.test(f)
                ? "deck"
                : classifyFile(fp, f);
      if (role && !layerMap[role]) layerMap[role] = fp;
    }
    if (Object.keys(layerMap).length === 0) continue;
    const id = safeId(ent.name);
    platforms.push(copyPlatform(id, ent.name.replace(/[-_]/g, " "), layerMap));
  }
  return platforms;
}

function scanLooseRoot() {
  if (!fs.existsSync(MEDIA_IN)) return null;
  const entries = fs.readdirSync(MEDIA_IN, { withFileTypes: true });
  const loose = [];
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (!IMAGE_EXT.test(ent.name)) continue;
    loose.push(path.join(MEDIA_IN, ent.name));
  }
  if (loose.length === 0) return null;

  const layerMap = {};
  const sized = [];
  for (const fp of loose) {
    const dim = dimensionsOf(fp);
    if (dim) sized.push({ fp, w: dim.width, h: dim.height });
  }
  sized.sort((a, b) => b.w / b.h - a.w / a.h);
  for (const { fp, w, h } of sized) {
    const role = classifyFile(fp, path.basename(fp));
    if (!role) continue;
    if (!layerMap[role]) layerMap[role] = fp;
  }
  if (Object.keys(layerMap).length === 0) return null;
  return copyPlatform("thetavern-stash", "Imported deck", layerMap);
}

function main() {
  if (fs.existsSync(PLATFORMS_OUT)) {
    fs.rmSync(PLATFORMS_OUT, { recursive: true });
  }
  ensureDir(PLATFORMS_OUT);

  const fromFolders = scanSubfolders();
  const fromLoose = scanLooseRoot();
  let platforms = [...fromFolders];
  if (fromLoose) platforms.push(fromLoose);

  if (platforms.length === 0) {
    platforms = [
      {
        id: "moonwell-core",
        name: "Moonwell core",
        path: "/media/platforms/moonwell-core",
        layers: {},
      },
    ];
    ensureDir(path.join(PLATFORMS_OUT, "moonwell-core"));
  }

  const manifest = {
    version: 2,
    generatedAt: new Date().toISOString(),
    hint: "Add MEdiaFiles/<name>/ with banner.jpg, crest.png, sky.webp, deck.jpg - or drop images in MEdiaFiles root. Run npm run media:scan.",
    platforms,
  };

  ensureDir(MEDIA_OUT);
  fs.writeFileSync(path.join(MEDIA_OUT, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(`[media:scan] ${platforms.length} platform(s) → public/media/manifest.json`);
  for (const p of platforms) {
    console.log(`  · ${p.name} (${p.id}) layers: ${Object.keys(p.layers).join(", ") || "procedural only"}`);
  }
}

main();
