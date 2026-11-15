"""Export the room for Apple Vision Pro's immersive website environment (/vision): a plain,
warm room with the lit letter case on its wall, as a USDZ for Safari's <model>, plus a warm
Radiance HDR for the model's environmentmap (its image-based light).

Usage (headless):
  Blender -b --factory-startup -P scripts/blender/export_room.py -- \
    --layout L.json --posters DIR --usdz room.usdz --hdr room.hdr

When immersive, the model's origin is at the reader's feet and its scale is real (WWDC26
session 320), so the room is built around the origin in metres. The reader looks along -Z
in USD (+Y in Blender). Safari's window opens straight ahead, in front of the room, so the
case wall is turned 40 degrees to the left, where the window does not hide it.
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_case import build_case, use_usd_materials  # noqa: E402
from render_case import hex_rgba, principled  # noqa: E402

# The room's inside, in metres (Blender: x right, y ahead, z up).
ROOM = {"x0": -2.4, "x1": 2.4, "y0": -2.2, "y1": 2.6, "height": 2.8}
WALL = 0.1  # thickness, outside the room
CASE_BOTTOM = 0.95  # the case's centre at 1.45 m, a standing reader's eye height
TURN = 40  # degrees to the left of straight ahead
HDR_SIZE = (512, 256)


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--layout", required=True)
    p.add_argument("--posters", required=True)
    p.add_argument("--usdz", required=True)
    p.add_argument("--hdr", required=True)
    return p.parse_args(argv)


def box(name, centre, size, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.data.materials.append(material)
    return obj


def warm_light(name, rgba, strength):
    mat = principled(name, (0, 0, 0, 1), 1.0, specular=0.0)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Emission Color"].default_value = rgba
    bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def build_room():
    r = ROOM
    w, h = r["x1"] - r["x0"], r["height"]
    d = r["y1"] - r["y0"]
    cx, cy = (r["x0"] + r["x1"]) / 2, (r["y0"] + r["y1"]) / 2
    walls = principled("room-walls", hex_rgba("#e8e1d7"), 0.9, specular=0.1)
    floor = principled("room-floor", hex_rgba("#6e5238"), 0.7, specular=0.15)
    ceiling = principled("room-ceiling", hex_rgba("#f3efe8"), 0.95, specular=0.05)
    lamp = warm_light("room-lamp", hex_rgba("#ffe7c2"), 3.0)
    return [
        box("floor", (cx, cy, -WALL / 2), (w + 2 * WALL, d + 2 * WALL, WALL), floor),
        box("ceiling", (cx, cy, h + WALL / 2), (w + 2 * WALL, d + 2 * WALL, WALL), ceiling),
        box("wall-ahead", (cx, r["y1"] + WALL / 2, h / 2), (w, WALL, h), walls),
        box("wall-behind", (cx, r["y0"] - WALL / 2, h / 2), (w, WALL, h), walls),
        box("wall-left", (r["x0"] - WALL / 2, cy, h / 2), (WALL, d, h), walls),
        box("wall-right", (r["x1"] + WALL / 2, cy, h / 2), (WALL, d, h), walls),
        # A warm light panel in the ceiling, above the space between the reader and the case.
        box("lamp", (0, 1.2, h - 0.01), (1.2, 0.6, 0.02), lamp),
    ]


def hang(case):
    """Moves the case from the origin (bottom centre, front facing -Y) onto the wall ahead."""
    depth = case["layout"]["depth"]
    objects = [case["wood"], case["backs"]] + [p[0] for p in case["posters"]]
    for obj in objects:
        obj.location = (0, ROOM["y1"] - depth / 2, CASE_BOTTOM)
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    return objects


def turn(objects):
    """Turns the whole room about the reader (the origin), so the case wall is front left."""
    for obj in objects:
        obj.rotation_euler = (0, 0, math.radians(TURN))
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)


def write_hdr(path):
    """A warm sky for image-based light: bright warm white above, warm at the horizon, dark below."""
    width, height = HDR_SIZE
    image = bpy.data.images.new("room-light", width=width, height=height, float_buffer=True, alpha=False)
    zenith, horizon, nadir = (1.10, 0.98, 0.82), (0.95, 0.85, 0.70), (0.30, 0.24, 0.19)
    pixels = []
    for row in range(height):  # Blender stores the bottom row first
        v = (row + 0.5) / height  # 0 at the bottom (nadir), 1 at the top (zenith)
        if v >= 0.5:
            t = (v - 0.5) / 0.5
            c = [horizon[i] + (zenith[i] - horizon[i]) * t ** 0.6 for i in range(3)]
        else:
            t = (0.5 - v) / 0.5
            c = [horizon[i] + (nadir[i] - horizon[i]) * t ** 0.6 for i in range(3)]
        pixels.extend([c[0], c[1], c[2], 1.0] * width)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(Path(path).resolve())
    image.file_format = "HDR"
    image.save()


def main():
    a = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    case = build_case(a.layout, a.posters)
    use_usd_materials(case)
    turn(hang(case) + build_room())
    write_hdr(a.hdr)
    bpy.ops.wm.usd_export(
        filepath=str(Path(a.usdz).resolve()),
        export_materials=True,
        generate_preview_surface=True,
        export_textures_mode="NEW",
        convert_orientation=True,
        export_global_up_selection="Y",
        export_global_forward_selection="NEGATIVE_Z",
        triangulate_meshes=True,
        usdz_downscale_size="1024",
        meters_per_unit=1.0,
        accessibility_label="A room with Stephen Sookra's lit letter case on its wall",
        accessibility_description=(
            "A plain room with warm walls and a wooden floor. The letter case hangs on the wall to the front left,"
            " holding six featured projects."
        ),
    )
    print(f"exported {a.usdz} and {a.hdr}")


if __name__ == "__main__":
    main()
