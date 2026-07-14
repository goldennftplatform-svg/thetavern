/**
 * Avatar markup + optional local upload compress (in-house glyph never requires a file).
 */

import {
  HOUSE_AVATARS,
  avatarSrcFor,
  houseAvatarById,
  type HouseAvatarId,
} from "../content/houseAvatars";

const MAX_CUSTOM_BYTES = 55_000;
const MAX_EDGE = 128;

export function avatarFaceHtml(
  avatarId: string | undefined | null,
  customDataUrl?: string | null,
  opts?: { size?: "sm" | "md" | "lg"; className?: string; interactive?: boolean },
): string {
  const size = opts?.size ?? "md";
  const cls = ["avatar-face", `avatar-face--${size}`, opts?.className ?? ""].filter(Boolean).join(" ");
  const resolved = avatarSrcFor(avatarId, customDataUrl);
  const face = resolved.face;
  const tag = opts?.interactive ? "button" : "span";
  const attrs = opts?.interactive
    ? ` type="button" data-hub-action="avatar_closet" aria-label="Change avatar"`
    : ` aria-hidden="true"`;
  if (resolved.kind === "custom" && resolved.src) {
    return `<${tag} class="${cls} avatar-face--custom"${attrs} style="--avatar-ink:${face.ink};--avatar-glow:${face.glow}">
      <img class="avatar-face__img" src="${escapeAttr(resolved.src)}" alt="" />
    </${tag}>`;
  }
  return `<${tag} class="${cls} avatar-face--house"${attrs} style="--avatar-ink:${face.ink};--avatar-glow:${face.glow}">
    <span class="avatar-face__glyph">${face.glyph}</span>
  </${tag}>`;
}

export function houseAvatarPickerHtml(selectedId: HouseAvatarId, selectedCustom?: string | null): string {
  const cards = HOUSE_AVATARS.map((a) => {
    const on = !selectedCustom && a.id === selectedId ? " avatar-pick--on" : "";
    return `<button type="button" class="avatar-pick${on}" data-avatar-id="${a.id}" title="${escapeAttr(a.label)}" aria-label="${escapeAttr(a.label)}">
      <span class="avatar-face avatar-face--sm avatar-face--house" style="--avatar-ink:${a.ink};--avatar-glow:${a.glow}">
        <span class="avatar-face__glyph">${a.glyph}</span>
      </span>
      <span class="avatar-pick__label">${escapeHtml(a.label)}</span>
    </button>`;
  }).join("");
  return `<div class="avatar-picker" role="listbox" aria-label="House faces">${cards}</div>`;
}

export function compressAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Pick an image file."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable");
        ctx.drawImage(img, 0, 0, w, h);
        let quality = 0.78;
        let data = canvas.toDataURL("image/jpeg", quality);
        while (data.length > MAX_CUSTOM_BYTES && quality > 0.4) {
          quality -= 0.08;
          data = canvas.toDataURL("image/jpeg", quality);
        }
        if (data.length > MAX_CUSTOM_BYTES) {
          reject(new Error("Image still too large — try a smaller photo."));
          return;
        }
        resolve(data);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Could not read image."));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not open that image."));
    };
    img.src = url;
  });
}

export function avatarLabel(avatarId: string | undefined | null, hasCustom?: boolean): string {
  if (hasCustom) return "Custom portrait";
  return houseAvatarById(avatarId).label;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text);
}
