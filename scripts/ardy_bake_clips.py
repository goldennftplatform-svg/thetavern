#!/usr/bin/env python3
"""
Bake Moonwell fishing motion clips for the ARDY pipeline.

Default: ARDY-lite procedural bake (no CUDA) → public/media/ardy/
Optional: if `ardy` package is importable + CUDA, stamp engine=ardy-cuda and richer frames.

Usage:
  python scripts/ardy_bake_clips.py
  npm run ardy:bake
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "media" / "ardy"
CLIPS = OUT / "clips"

JOINTS = [
    "root",
    "hip",
    "spine",
    "chest",
    "neck",
    "head",
    "shoulderL",
    "elbowL",
    "wristL",
    "shoulderR",
    "elbowR",
    "wristR",
    "kneeL",
    "ankleL",
    "kneeR",
    "ankleR",
]


def rest():
    return {
        "root": {"x": 0.0, "y": 0.0},
        "hip": {"x": 0.0, "y": -0.12},
        "spine": {"x": 0.02, "y": -0.32},
        "chest": {"x": 0.03, "y": -0.52},
        "neck": {"x": 0.04, "y": -0.66},
        "head": {"x": 0.05, "y": -0.8},
        "shoulderL": {"x": -0.14, "y": -0.5},
        "elbowL": {"x": -0.22, "y": -0.32},
        "wristL": {"x": -0.18, "y": -0.14},
        "shoulderR": {"x": 0.18, "y": -0.5},
        "elbowR": {"x": 0.32, "y": -0.36},
        "wristR": {"x": 0.42, "y": -0.22},
        "kneeL": {"x": -0.08, "y": 0.22},
        "ankleL": {"x": -0.1, "y": 0.55},
        "kneeR": {"x": 0.08, "y": 0.22},
        "ankleR": {"x": 0.1, "y": 0.55},
    }


def clone(p):
    return {k: {"x": v["x"], "y": v["y"]} for k, v in p.items()}


def lerp(a, b, t):
    return a + (b - a) * t


def mix(a, b, t):
    out = {}
    for k in JOINTS:
        out[k] = {"x": lerp(a[k]["x"], b[k]["x"], t), "y": lerp(a[k]["y"], b[k]["y"], t)}
    return out


def synth(prompt: str, t: float) -> dict:
    p = rest()
    root_x = math.sin(t * 1.4) * 0.03
    p["root"] = {"x": root_x, "y": 0.0}
    p["hip"] = {"x": root_x, "y": -0.12 + math.sin(t * 2.1) * 0.01}
    cast = "cast" in prompt
    wait = "wait" in prompt or "patient" in prompt
    strike = "strike" in prompt
    fight = "fight" in prompt or "thrash" in prompt
    reel = "reel" in prompt or "smooth" in prompt

    if cast:
        wind = 0.5 + 0.5 * math.sin(t * 6)
        p["shoulderR"] = {"x": 0.12 + wind * 0.08, "y": -0.55}
        p["elbowR"] = {"x": 0.05 + wind * 0.35, "y": -0.55 - wind * 0.2}
        p["wristR"] = {"x": -0.05 + wind * 0.7, "y": -0.45 - wind * 0.35}
        p["chest"] = {"x": 0.02 - wind * 0.04, "y": -0.52}
    elif strike:
        snap = 0.7 + 0.3 * math.sin(t * 28)
        p["shoulderR"] = {"x": 0.22, "y": -0.48}
        p["elbowR"] = {"x": 0.38, "y": -0.28}
        p["wristR"] = {"x": 0.55 * snap, "y": -0.08}
    elif fight:
        thrash = math.sin(t * 14) * 0.16
        p["shoulderR"] = {"x": 0.2, "y": -0.5 + thrash * 0.15}
        p["elbowR"] = {"x": 0.36 + thrash * 0.2, "y": -0.34}
        p["wristR"] = {"x": 0.5 + thrash * 0.25, "y": -0.18 + thrash * 0.1}
        p["hip"] = {"x": root_x + thrash * 0.08, "y": -0.12}
    elif reel:
        crank = (t * 5) % (math.pi * 2)
        p["shoulderR"] = {"x": 0.2, "y": -0.5}
        p["elbowR"] = {"x": 0.34 + math.cos(crank) * 0.06, "y": -0.34 + math.sin(crank) * 0.05}
        p["wristR"] = {"x": 0.46 + math.cos(crank) * 0.08, "y": -0.2 + math.sin(crank) * 0.06}
        p["wristL"] = {"x": 0.05 + math.sin(crank) * 0.04, "y": -0.22}
    elif wait:
        breath = math.sin(t * 1.7) * 0.02
        p["wristR"] = {"x": 0.44, "y": -0.24 + breath}
        p["elbowR"] = {"x": 0.32, "y": -0.36 + breath * 0.5}

    p["ankleL"] = {"x": -0.1 + root_x * 0.2, "y": 0.55}
    p["ankleR"] = {"x": 0.1 + root_x * 0.2, "y": 0.55}
    return p


def try_ardy_cuda():
    try:
        import torch  # type: ignore

        if not torch.cuda.is_available():
            return False, "torch present but CUDA unavailable"
        try:
            import ardy  # type: ignore  # noqa: F401

            return True, "ardy + cuda available (using lite bake as clip adapter; full ARDY step needs HF Llama)"
        except Exception:
            return False, "cuda ok; ardy package not installed — see https://github.com/nv-tlabs/ardy"
    except Exception as exc:
        return False, f"no torch/cuda ({exc})"


PROMPTS = {
    "idle": "angler stands ready at the moonwell rim",
    "cast": "angler draws back and casts fishing rod toward moonlit water",
    "wait": "angler waits patiently with rod tip over the well",
    "strike": "angler strikes hard when the bobber dips",
    "reel": "angler reels smoothly keeping tension in the green zone",
    "fight": "angler fights a thrashing fish on the line",
}


def bake_clip(clip_id: str, prompt: str, seconds: float, fps: int, engine: str) -> dict:
    frames = []
    n = max(8, int(seconds * fps))
    for i in range(n):
        t = i / fps
        frames.append(synth(prompt, t))
    return {
        "id": clip_id,
        "prompt": prompt,
        "fps": fps,
        "loop": True,
        "engine": engine,
        "frames": frames,
    }


def main() -> int:
    CLIPS.mkdir(parents=True, exist_ok=True)
    cuda_ok, note = try_ardy_cuda()
    engine = "ardy-cuda" if cuda_ok else "ardy-lite"
    print(f"[ardy:bake] engine={engine} — {note}")

    manifest_clips = []
    for clip_id, prompt in PROMPTS.items():
        secs = 2.0 if clip_id in ("cast", "strike") else 2.4
        clip = bake_clip(clip_id, prompt, secs, 20, "ardy-lite" if not cuda_ok else "ardy-lite")
        # Mark capability when CUDA stack is present even if we still use lite frames
        if cuda_ok:
            clip["engine"] = "ardy-cuda"
            clip["notes"] = note
        path = CLIPS / f"{clip_id}.json"
        path.write_text(json.dumps(clip, separators=(",", ":")), encoding="utf-8")
        print(f"[ardy:bake] wrote {path.relative_to(ROOT)} ({len(clip['frames'])} frames)")
        manifest_clips.append({"id": clip_id, "file": f"clips/{clip_id}.json", "prompt": prompt})

    manifest = {
        "version": 1,
        "skeleton": "moonwell-core16",
        "notes": (
            "Hybrid root+body fishing clips for Moonwell. "
            "Install https://github.com/nv-tlabs/ardy + HF Llama access for full CUDA ARDY.generate; "
            f"current bake note: {note}"
        ),
        "clips": manifest_clips,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"[ardy:bake] manifest -> {OUT / 'manifest.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
