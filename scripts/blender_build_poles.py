"""
Build Moonwell pole sprites in Blender 5.x (background or GUI).

Usage:
  "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" --background --python scripts/blender_build_poles.py
"""

from __future__ import annotations

import math
import os
import sys

import bpy
from mathutils import Euler, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "media", "poles")

POLES = [
    # id, shaft RGB, tip RGB, grip RGB, glow RGB or None, height beads
    ("whistler_stick", (0.55, 0.42, 0.25), (0.78, 0.62, 0.35), (0.32, 0.22, 0.14), None, 6),
    ("dockhand_reed", (0.38, 0.52, 0.30), (0.75, 0.80, 0.40), (0.20, 0.26, 0.14), None, 7),
    ("coppercoil_switch", (0.50, 0.42, 0.35), (0.90, 0.75, 0.30), (0.22, 0.16, 0.12), (0.35, 0.70, 1.0), 7),
    ("mourningglass", (0.35, 0.42, 0.48), (0.80, 0.90, 0.95), (0.14, 0.18, 0.22), (0.55, 0.75, 0.90), 8),
    ("boneflute", (0.82, 0.76, 0.66), (0.95, 0.90, 0.84), (0.40, 0.35, 0.28), (0.85, 0.75, 0.55), 8),
    ("astral_wormwood", (0.22, 0.28, 0.42), (0.72, 0.58, 0.90), (0.10, 0.08, 0.14), (0.55, 0.40, 1.0), 9),
    ("demon_spinner", (0.48, 0.12, 0.14), (0.90, 0.28, 0.20), (0.16, 0.05, 0.07), (1.0, 0.25, 0.18), 9),
    ("chronicle_lance", (0.78, 0.62, 0.28), (0.98, 0.90, 0.55), (0.28, 0.22, 0.12), (0.95, 0.78, 0.30), 10),
    ("moonshatter", (0.82, 0.86, 0.95), (1.0, 1.0, 1.0), (0.38, 0.44, 0.55), (0.70, 0.82, 1.0), 11),
]


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.meshes):
        bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials):
        bpy.data.materials.remove(block)
    for block in list(bpy.data.lights):
        bpy.data.lights.remove(block)
    for block in list(bpy.data.cameras):
        bpy.data.cameras.remove(block)


def mat(name: str, color, emission=None, emission_strength: float = 0.0):
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True
    nodes = m.node_tree.nodes
    links = m.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.45
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.15
    if emission is not None and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m


def add_cylinder(name: str, loc, scale, material):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=1, depth=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def build_pole(shaft, tip, grip, glow, beads: int):
    clear_scene()
    shaft_m = mat("shaft", shaft, glow, 1.2 if glow else 0.0)
    tip_m = mat("tip", tip, glow or tip, 2.4 if glow else 0.4)
    grip_m = mat("grip", grip)

    # Stick stands vertical; camera shoots side/front 3/4.
    total_h = 2.6
    segment = total_h / beads
    for i in range(beads):
        y = -total_h / 2 + segment * (i + 0.5)
        r = 0.055 - i * 0.0035
        add_cylinder(f"bead_{i}", (0, 0, y), (r, r, segment * 0.92), shaft_m if i > 1 else grip_m)

    # Tip orb
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, location=(0, 0, total_h / 2 + 0.05))
    tip_obj = bpy.context.active_object
    tip_obj.name = "tip"
    tip_obj.data.materials.append(tip_m)

    # Reel knob
    add_cylinder("reel", (0.12, 0, -total_h / 2 + 0.35), (0.09, 0.04, 0.06), tip_m)
    bpy.context.active_object.rotation_euler = Euler((0, math.radians(90), 0), "XYZ")

    # Light + camera
    bpy.ops.object.light_add(type="AREA", location=(2.2, -2.0, 1.5))
    light = bpy.context.active_object
    light.data.energy = 180
    light.data.size = 3.5

    bpy.ops.object.light_add(type="AREA", location=(-1.8, 1.5, 0.8))
    fill = bpy.context.active_object
    fill.data.energy = 60
    fill.data.size = 2.5

    bpy.ops.object.camera_add(location=(2.4, -2.6, 0.35))
    cam = bpy.context.active_object
    cam.rotation_euler = Euler((math.radians(78), 0, math.radians(40)), "XYZ")
    bpy.context.scene.camera = cam

    # World
    world = bpy.data.worlds.new("PoleWorld")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.02, 0.025, 0.04, 1.0)
    bg.inputs[1].default_value = 0.35


def configure_render(out_path: str) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items} else "BLENDER_EEVEE"
    # Fallback if enum probe fails
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        try:
            scene.render.engine = "BLENDER_EEVEE"
        except Exception:
            scene.render.engine = "CYCLES"

    scene.render.resolution_x = 256
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = out_path


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"[poles] out → {OUT_DIR}")
    for pole_id, shaft, tip, grip, glow, beads in POLES:
        out = os.path.join(OUT_DIR, f"{pole_id}.png")
        print(f"[poles] render {pole_id}")
        build_pole(shaft, tip, grip, glow, beads)
        configure_render(out)
        bpy.ops.render.render(write_still=True)
        print(f"[poles] wrote {out}")
    print("[poles] done")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print("[poles] FAILED:", exc)
        raise
