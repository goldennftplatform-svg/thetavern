/**
 * Resolve a Suno share link → song UUID → download MP3 into public/audio/.
 * Run: node scripts/fetch-suno-track.mjs [shareUrl]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const shareUrl = process.argv[2] ?? "https://suno.com/s/tZDcD7SyppeQ7VFd";
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "audio");
const outFile = join(outDir, "hall-ambience.mp3");

const html = await fetch(shareUrl, {
  headers: { "User-Agent": "Mozilla/5.0 (compatible; MoonwellBot/1.0)" },
  redirect: "follow",
}).then((r) => r.text());

const idMatch = html.match(/song\/([0-9a-f-]{36})/i);
if (!idMatch) throw new Error("Could not resolve Suno song UUID from share page");
const songId = idMatch[1];
const cdnUrl = `https://cdn1.suno.ai/${songId}.mp3`;

console.log(`Song id: ${songId}`);
console.log(`Trying: ${cdnUrl}`);

const res = await fetch(cdnUrl, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Referer: "https://suno.com/",
    Origin: "https://suno.com",
  },
});

if (!res.ok) {
  console.warn(`CDN returned ${res.status} — saving manifest only; add hall-ambience.mp3 manually.`);
  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, "manifest.json"),
    JSON.stringify(
      {
        title: "Bang x Oxtail Rumble (Mashup)",
        artist: "Preset Records",
        sunoShare: shareUrl,
        sunoSongId: songId,
        cdnUrl,
        note: "Run from Suno app Download, or place hall-ambience.mp3 here.",
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const buf = Buffer.from(await res.arrayBuffer());
await mkdir(outDir, { recursive: true });
await writeFile(outFile, buf);
console.log(`Saved ${(buf.length / 1024 / 1024).toFixed(2)} MB → ${outFile}`);
