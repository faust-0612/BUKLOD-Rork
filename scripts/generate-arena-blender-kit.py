#!/usr/bin/env python3
"""Original BUKLOD Genesis Arena environment kit for Blender 4.x/5.x.
Run with: blender -b --python scripts/generate-arena-blender-kit.py
Creates editable .blend and exportable .glb. No downloads, paid tools, or
replacement of the 13 owner-approved character illustrations.
This is a modular 3D asset source, not yet the active 2D Godot renderer.
"""
import math
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "godot" / "empire-arena" / "art3d"
OUT.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def material(name, rgba, metallic=0.0, roughness=0.4, emission=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgba, 1.0)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*rgba, 1.0)
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Roughness"].default_value = roughness
    if "Emission Color" in p.inputs:
        p.inputs["Emission Color"].default_value = (*rgba, 1.0)
        p.inputs["Emission Strength"].default_value = emission
    return m

obsidian = material("Genesis / cosmic obsidian", (0.055, 0.085, 0.14), 0.5)
metal = material("Genesis / etched bronze", (0.48, 0.35, 0.18), 0.74)
jade = material("Buklod / teal faction", (0.13, 0.8, 0.65), 0.15, 0.25, 2.0)
coral = material("Rival / coral faction", (0.92, 0.3, 0.28), 0.14, 0.3, 2.0)
light = material("Genesis / first light", (0.95, 0.78, 0.37), 0.0, 0.24, 3.6)
crystal = material("Genesis / luminous amethyst", (0.59, 0.40, 0.95), 0.14, 0.12, 3.1)
stone = material("Genesis / stone", (0.30, 0.36, 0.43), 0.15, 0.78)
wood = material("Genesis / living wood", (0.24, 0.18, 0.11), 0.04, 0.72)
leaves = material("Genesis / canopy", (0.15, 0.39, 0.25), 0.0, 0.8)

def attach(obj, name, mat, root=None):
    obj.name = name
    obj.data.materials.append(mat)
    if root is not None:
        obj.parent = root
    return obj

def cube(name, at, dims, mat, root=None, bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    obj = bpy.context.object
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    attach(obj, name, mat, root)
    if bevel:
        modifier = obj.modifiers.new("Soft bevel / mobile LOD", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
        obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj

def cylinder(name, at, radius, depth, mat, root=None, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=at)
    return attach(bpy.context.object, name, mat, root)

def cone(name, at, radius, depth, mat, root=None, vertices=8):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=0.0, depth=depth, location=at)
    return attach(bpy.context.object, name, mat, root)

def group(name, at=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = at
    return obj

def make_tower(team, x):
    root = group("tower_" + team)
    tint = jade if team == "A" else coral
    cylinder(team + "_tower_foundation", (x, 0, 0.45), 2.1, 0.9, stone, root)
    cylinder(team + "_tower_core", (x, 0, 3.3), 1.16, 5.1, obsidian, root)
    for z, radius in [(1.1, 1.65), (4.2, 1.45), (6.2, 1.95)]:
        cylinder(team + "_tower_gold_band", (x, 0, z), radius, 0.22, metal, root)
    cone(team + "_tower_beacon", (x, 0, 6.9), 0.86, 2.2, tint, root)
    for a in range(6):
        t = math.tau * a / 6
        cube(team + "_tower_crystal", (x + math.cos(t) * 1.55, math.sin(t) * 1.55, 5.7),
             (0.22, 0.22, 1.35), tint, root, 0.0)

def make_seal(team, x):
    root = group("seal_" + team)
    tint = jade if team == "A" else coral
    cylinder(team + "_seal_plinth", (x, -5.5, 0.42), 3.0, 0.8, stone, root, 16)
    cylinder(team + "_seal_ring", (x, -5.5, 1.0), 2.3, 0.18, metal, root, 20)
    cone(team + "_seal_heart", (x, -5.5, 2.5), 1.3, 3.3, tint, root, 8)
    cone(team + "_seal_shine", (x, -5.5, 3.75), 0.55, 1.4, light, root, 8)

def make_resource(kind, x, y):
    root = group("resource_" + kind)
    mat = wood if kind == "wood" else light if kind == "gold" else crystal
    cylinder(kind + "_deposit_base", (x, y, 0.17), 1.05, 0.34, stone, root)
    for k in range(3):
        cone(kind + "_ore_" + str(k), (x + (k-1)*0.42, y + (k%2)*0.26, 0.85),
             0.4, 1.5 + k*0.27, mat, root, 6)

def make_tree(x, y):
    root = group("verdant_tree")
    cylinder("trunk", (x, y, 1.3), 0.35, 2.6, wood, root, 8)
    for z, scale in [(2.5, 1.6), (3.5, 1.27), (4.5, 0.85)]:
        cone("canopy", (x, y, z), scale, 2.2, leaves, root, 8)

def make_villager(team, x):
    root = group("villager_" + team)
    tint = jade if team == "A" else coral
    torso = cube(team + "_torso", (x, 7.0, 1.8), (0.85, 0.44, 1.0), tint, root)
    head = cube(team + "_head", (x, 7.0, 2.57), (0.54, 0.51, 0.54), metal, root)
    left_arm = cube(team + "_left_arm", (x-0.61, 7.0, 1.8), (0.28, 0.32, 1.0), stone, root)
    right_arm = cube(team + "_right_arm", (x+0.61, 7.0, 1.8), (0.28, 0.32, 1.0), stone, root)
    left_leg = cube(team + "_left_leg", (x-0.24, 7.0, 0.7), (0.31, 0.37, 0.98), obsidian, root)
    right_leg = cube(team + "_right_leg", (x+0.24, 7.0, 0.7), (0.31, 0.37, 0.98), obsidian, root)
    for frame, offset, swing in [(1, 0.0, 0.0), (9, 0.1, 0.18),
                                  (17, 0.0, 0.0), (25, -0.08, -0.18),
                                  (33, 0.0, 0.0)]:
        torso.location.z = 1.8 + offset
        torso.keyframe_insert(data_path="location", frame=frame)
        head.location.z = 2.57 + offset
        head.keyframe_insert(data_path="location", frame=frame)
        for limb, sign in [(left_arm,1), (right_arm,-1),
                           (left_leg,-1), (right_leg,1)]:
            limb.rotation_euler.x = swing * sign
            limb.keyframe_insert(data_path="rotation_euler", frame=frame)
    # Blender 4.4+ layered Actions do not expose legacy Action.fcurves.
    # Keyframes use Blender's native Bezier defaults; no fragile API mutation.

# Three reusable season-two regions: same geometry can receive later
# cosmetic reskins without changing Arena's map routes or lane logic.
cylinder("genesis_rift / first_light_plaza", (0, 0, -0.4), 5.0, 0.6, obsidian, None, 24)
for i in range(8):
    theta = i * math.tau / 8
    cone("genesis_rift / radiant_pillar",
         (math.cos(theta)*4.1, math.sin(theta)*4.1, 1.2), 0.45, 2.4, crystal)
cylinder("aurora_foundry / forge", (0, -12, 0.75), 2.6, 1.5, metal, None, 16)
cone("aurora_foundry / radiant_furnace", (0, -12, 2.1), 1.2, 3.1, light)
for x, y in [(0, 13), (-4, 14), (4, 14)]:
    make_tree(x, y)
for team, x in [("A", -11), ("B", 11)]:
    make_tower(team, x)
    make_seal(team, x)
    make_villager(team, x)
for kind, x, y in [("wood", -7, 3), ("gold", 0, -7), ("stone", 7, 3)]:
    make_resource(kind, x, y)

bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = 33
# Material/glTF export needs no render engine override. Blender 4.x/5.x
# have changed their EEVEE enum names; retain the host's safe default.
if bpy.app.version < (4, 0, 0):
    raise RuntimeError("BUKLOD source requires Blender 4.0 or newer")
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "Buklod_Genesis_Arena_Kit.blend"))
bpy.ops.export_scene.gltf(
    filepath=str(OUT / "Buklod_Genesis_Arena_Kit.glb"),
    export_format="GLB", export_animations=True, export_apply=True)
print("BUKLOD_BLENDER_KIT_EXPORTED: modular towers, seals, resources, regions, two living villagers")
