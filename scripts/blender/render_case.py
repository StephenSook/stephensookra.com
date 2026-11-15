"""Render a still poster of the lit letter case in Blender, from the same layout the
3D scene draws (scripts/blender/out/case-layout.json, written by npm run case:layout).

Usage (headless):
  Blender -b --factory-startup -P scripts/blender/render_case.py -- --scheme light --out out.png

Coordinates: the layout uses metres with y up and z towards the viewer. Blender uses
z up, so (x, y, z) maps to (x, -z, y).
"""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy

# Design-brief tokens (section 4). The slot light is the only accent and stays off here,
# matching the scene's resting state so the live case fades in without a jump.
TOKENS = {
    "light": {"bg": "#F1F2F4", "wood": "#8A6A4A", "back": "#D6D9DF"},
    "dark": {"bg": "#0F1115", "wood": "#6E5238", "back": "#262A33"},
}
POSTER_DIM = 0.35  # how much of a project poster shows in a dark slot (scene uDim)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgba(hex_color):
    h = hex_color.lstrip("#")
    rgb = [srgb_to_linear(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4)]
    return (*rgb, 1.0)


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--scheme", choices=["light", "dark"], required=True)
    p.add_argument("--layout", default="scripts/blender/out/case-layout.json")
    p.add_argument("--out", required=True)
    p.add_argument("--width", type=int, default=1600)
    p.add_argument("--height", type=int, default=900)
    p.add_argument("--samples", type=int, default=64)
    return p.parse_args(argv)


UNLIT = 0.7  # a dark slot back is drawn at 70% of its colour (scene shader: base * (0.7 + 0.3 * lit))


def scaled(rgba, k):
    return (rgba[0] * k, rgba[1] * k, rgba[2] * k, 1.0)


def principled(name, color, roughness, specular=0.2):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Specular IOR Level"].default_value = specular
    return mat


def emissive(name, color=None):
    """Shadeless, like the scene's slot shader: the colour shows as-is, whatever the lights."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.remove(nodes["Principled BSDF"])
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Strength"].default_value = 1.0
    if color is not None:
        emission.inputs["Color"].default_value = color
    links.new(emission.outputs["Emission"], nodes["Material Output"].inputs["Surface"])
    return mat, emission


def poster_material(name, image_path, back_color, rect_aspect):
    """The slot back with the project poster dimmed into it (cover crop to the slot aspect)."""
    mat, emission = emissive(name)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(image_path))
    tex.extension = "CLIP"
    # Cover crop: scale UVs about the centre so the poster fills the slot without stretching.
    img_aspect = tex.image.size[0] / tex.image.size[1]
    mapping = nodes.new("ShaderNodeMapping")
    coord = nodes.new("ShaderNodeTexCoord")
    sx = rect_aspect / img_aspect if rect_aspect < img_aspect else 1.0
    sy = img_aspect / rect_aspect if rect_aspect > img_aspect else 1.0
    mapping.inputs["Scale"].default_value = (sx, sy, 1.0)
    mapping.inputs["Location"].default_value = ((1 - sx) / 2, (1 - sy) / 2, 0.0)
    links.new(coord.outputs["UV"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["Factor"].default_value = POSTER_DIM
    mix.inputs["A"].default_value = back_color
    links.new(tex.outputs["Color"], mix.inputs["B"])
    dim = nodes.new("ShaderNodeMix")
    dim.data_type = "RGBA"
    dim.blend_type = "MULTIPLY"
    dim.inputs["Factor"].default_value = 1.0
    dim.inputs["B"].default_value = (UNLIT, UNLIT, UNLIT, 1.0)
    links.new(mix.outputs["Result"], dim.inputs["A"])
    links.new(dim.outputs["Result"], emission.inputs["Color"])
    return mat


def add_box(box, material, name):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(box["x"], -box["z"], box["y"]))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (box["w"], box["d"], box["h"])
    obj.data.materials.append(material)
    return obj


def add_back_plane(box, material, name):
    """A plane on the front face of the slot back, with 0..1 UVs for the poster."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=(box["x"], -(box["z"] + box["d"] / 2) - 1e-4, box["y"]))
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_euler = (math.radians(90), 0, 0)
    obj.scale = (box["w"], box["h"], 1)
    obj.data.materials.append(material)
    return obj


def main():
    a = args()
    data = json.loads(Path(a.layout).read_text())
    layout, tokens = data["layout"], TOKENS[a.scheme]

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"

    wood = principled("wood", hex_rgba(tokens["wood"]), 0.62, specular=0.25)
    back, _ = emissive("back", scaled(hex_rgba(tokens["back"]), UNLIT))

    for i, b in enumerate(layout["frame"] + layout["dividers"]):
        add_box(b, wood, f"wood.{i:03d}")
    for i, b in enumerate(layout["smallBacks"]):
        add_box(b, back, f"small-back.{i:03d}")
    for slot in layout["projectSlots"]:
        b = slot["back"]
        add_box(b, back, f"slot-back.{slot['slug']}")
        poster = data["posters"].get(slot["slug"])
        if poster:
            mat = poster_material(f"poster.{slot['slug']}", poster, hex_rgba(tokens["back"]), b["w"] / b["h"])
            add_back_plane(b, mat, f"poster.{slot['slug']}")

    # World: soft light from all around. The film is transparent, and the PNG is flattened
    # onto the exact page background afterwards, so the poster edge never shows.
    world = bpy.data.worlds.new("world")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = hex_rgba(tokens["bg"])
    bg.inputs["Strength"].default_value = 0.75 if a.scheme == "light" else 0.5

    # A soft key light from the upper right front, like the scene's directional light.
    bpy.ops.object.light_add(type="AREA", location=(0.9, -2.2, 1.4))
    key = bpy.context.active_object
    key.data.energy = 45 if a.scheme == "light" else 30
    key.data.size = 2.0
    key.rotation_euler = (math.radians(62), 0, math.radians(22))

    # Camera: the same framing as fitCamera (vertical field of view, on the centre line).
    cam_data = bpy.data.cameras.new("camera")
    cam_data.sensor_fit = "VERTICAL"
    cam_data.angle_y = math.radians(data["camera"]["fovDegrees"])
    cam = bpy.data.objects.new("camera", cam_data)
    scene.collection.objects.link(cam)
    x, y, z = data["camera"]["position"]
    cam.location = (x, -z, y)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam

    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = a.samples
    scene.render.resolution_x = a.width
    scene.render.resolution_y = a.height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(Path(a.out).resolve())
    bpy.ops.render.render(write_still=True)
    print(f"rendered {a.scheme} poster to {scene.render.filepath}")


main()
