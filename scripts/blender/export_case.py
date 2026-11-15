"""Export the lit letter case for phone AR: a GLB (Scene Viewer, model-viewer) and a USDZ
(AR Quick Look, Safari's <model>), from the same layout the 3D scene draws
(scripts/blender/out/case-layout.json, written by npm run case:layout).

Usage (headless):
  Blender -b --factory-startup -P scripts/blender/export_case.py -- \
    --layout L.json --posters DIR --glb out.glb --usdz out.usdz

The case is real size (1.6 x 1.0 x 0.14 m), its front faces the viewer (+Z in glTF), and its
origin is the bottom centre, so it stands on a floor or table where AR puts it. Layout
coordinates are metres, y up, z towards the viewer; Blender is z up, so (x, y, z) becomes
(x, -z, y + height / 2).
"""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_case import UNLIT, hex_rgba, principled, scaled  # noqa: E402


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--layout", required=True)
    p.add_argument("--posters", required=True, help="folder of <slug>.jpg, cropped to each slot")
    p.add_argument("--glb", required=True)
    p.add_argument("--usdz", required=True)
    return p.parse_args(argv)


def place_box(box, lift, name):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(box["x"], -box["z"], box["y"] + lift))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (box["w"], box["d"], box["h"])
    return obj


def join(objects, name, material):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    # Bake every transform into the mesh: world coordinates, identity nodes in the files.
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.data.materials.clear()
    obj.data.materials.append(material)
    return obj


def image_node(mat, path):
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(path))
    tex.extension = "CLIP"
    return tex


def unlit_color(name, rgba):
    """A colour wired straight to the output: glTF export writes KHR_materials_unlit."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.remove(nodes["Principled BSDF"])
    rgb = nodes.new("ShaderNodeRGB")
    rgb.outputs[0].default_value = rgba
    links.new(rgb.outputs[0], nodes["Material Output"].inputs["Surface"])
    return mat


def unlit_image(name, path):
    """The poster at full strength whatever the lighting, as in the scene (glTF unlit)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.remove(nodes["Principled BSDF"])
    links.new(image_node(mat, path).outputs["Color"], nodes["Material Output"].inputs["Surface"])
    return mat


def emissive_image(name, path):
    """For USD (UsdPreviewSurface has no unlit): black base, the poster as emission."""
    mat = principled(name, (0, 0, 0, 1), 1.0, specular=0.0)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    mat.node_tree.links.new(image_node(mat, path).outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.0
    return mat


def build_case(layout_path, posters_dir):
    """Builds the case in the open scene: bottom centre at the origin, front facing -Y (the
    viewer; glTF and USD +Z). Returns the objects and both material sets."""
    data = json.loads(Path(layout_path).read_text())
    layout, colors = data["layout"], data["colors"]
    lift = layout["height"] / 2  # origin at the bottom centre

    wood = principled("case-wood", hex_rgba(colors["wood"]), 0.55, specular=0.06)
    backs_glb = unlit_color("case-backs", scaled(hex_rgba(colors["back"]), UNLIT))
    backs_usd = principled("case-backs-lit", scaled(hex_rgba(colors["back"]), UNLIT), 1.0, specular=0.0)

    wood_obj = join([place_box(b, lift, f"w{i}") for i, b in enumerate(layout["frame"] + layout["dividers"])], "case-wood", wood)
    backs = [place_box(b, lift, f"b{i}") for i, b in enumerate(layout["smallBacks"])]
    backs += [place_box(s["back"], lift, f"s{i}") for i, s in enumerate(layout["projectSlots"])]
    backs_obj = join(backs, "case-backs", backs_glb)

    posters = []  # (object, glb material, usd material)
    for slot in layout["projectSlots"]:
        path = Path(posters_dir) / f"{slot['slug']}.jpg"
        if not path.exists():
            continue  # a slot without a poster keeps the plain back
        b = slot["back"]
        y_front = -(b["z"] + b["d"] / 2) - 1e-4
        bpy.ops.mesh.primitive_plane_add(size=1, location=(b["x"], y_front, b["y"] + lift))
        obj = bpy.context.active_object
        obj.name = f"poster-{slot['slug']}"
        obj.rotation_euler = (math.radians(90), 0, 0)  # faces -Y, the viewer (glTF +Z)
        obj.scale = (b["w"], b["h"], 1)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        glb_mat = unlit_image(f"poster-{slot['slug']}", path)
        usd_mat = emissive_image(f"poster-{slot['slug']}-emissive", path)
        obj.data.materials.append(glb_mat)
        posters.append((obj, glb_mat, usd_mat))
    return {"layout": layout, "wood": wood_obj, "backs": backs_obj, "backs_usd": backs_usd, "posters": posters}


def use_usd_materials(case):
    """USD has no unlit material: swap in the emissive posters and the lit backs."""
    case["backs"].data.materials[0] = case["backs_usd"]
    for obj, _glb, usd in case["posters"]:
        obj.data.materials[0] = usd


def main():
    a = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    case = build_case(a.layout, a.posters)

    bpy.ops.export_scene.gltf(
        filepath=str(Path(a.glb).resolve()),
        export_format="GLB",
        export_yup=True,
        export_image_format="JPEG",
        export_image_quality=85,
    )

    use_usd_materials(case)
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
        accessibility_label="Stephen Sookra's lit letter case",
        accessibility_description="A wooden letter case holding six featured projects, one in each large slot.",
    )
    print(f"exported {a.glb} and {a.usdz}")


if __name__ == "__main__":
    main()
