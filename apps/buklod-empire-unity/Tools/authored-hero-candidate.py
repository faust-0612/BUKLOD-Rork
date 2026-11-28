#!/usr/bin/env python3
"""Audit/prepare an authored, skinned hero candidate without substituting geometry.

Run audit with ordinary Python. The optional export requires Blender 4.5 LTS,
explicit local rights evidence and a separate art approval before catalog binding.
No source file is overwritten. This tool never generates a production receipt.
"""
import argparse, hashlib, json, math, pathlib, struct, sys

LOCK = {
    "azure-champion.glb": ("81f5094d017c2cf6b66d35521478e71d70305f520dbc7416f7f10e4c0ae5d194", 150000),
    "t1-sentinel.glb": ("238512321b5af88d9a682f3a669205082d7fa508fa839c0bbbe8870b49866eff", 149880),
    "hooded-blade.glb": ("8f5d0cd8e0dad017a233d5b2ef66bb7214ddff63232019e0f1762211bbd9eabb", 150000),
}
HEROES = ("phan","quin","van","christian","lhen","ace","ellusur","jawo","mitch","niel","angel","vhen","trudice")
SLOTS = ("Idle","Walk","Run","Attack","Primary","Secondary","Ultimate","Hit","Death","Victory")
LOD_TARGETS = (36000, 14000, 5000)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def inspect(path):
    with path.open("rb") as f:
        magic, version, size, length, chunk = struct.unpack("<4sIIII", f.read(20))
        if magic != b"glTF" or version != 2 or size != path.stat().st_size or chunk != 0x4E4F534A or length > size - 20:
            raise ValueError("Invalid GLB header")
        doc = json.loads(f.read(length))
    nodes, acc = doc["nodes"], doc["accessors"]
    skins = doc.get("skins", [])
    if not skins:
        raise ValueError("Unskinned model")
    joints = [[nodes[n].get("name","") for n in s["joints"]] for s in skins]
    if any(not all(row) or len(set(row)) != len(row) for row in joints):
        raise ValueError("Unnamed or duplicate skin joints")
    triangles = 0
    for node in nodes:
        if "mesh" not in node:
            continue
        if "skin" not in node:
            raise ValueError("Unbound mesh node")
        for primitive in doc["meshes"][node["mesh"]]["primitives"]:
            if primitive.get("mode",4) != 4 or "indices" not in primitive:
                raise ValueError("Indexed triangles required")
            if not {"POSITION","NORMAL","TEXCOORD_0","JOINTS_0","WEIGHTS_0"}.issubset(primitive["attributes"]):
                raise ValueError("Skin weights, normals and UVs required")
            count = acc[primitive["indices"]]["count"]
            if count % 3:
                raise ValueError("Invalid index count")
            triangles += count // 3
    if not triangles:
        raise ValueError("No skinned triangles")
    clips = {}
    for anim in doc.get("animations", []):
        name = anim.get("name")
        if not name or name in clips:
            raise ValueError("Duplicate or unnamed animation")
        channels = anim.get("channels", [])
        if not channels or any(c["target"].get("node",-1) not in range(len(nodes)) for c in channels):
            raise ValueError("Invalid animation targets")
        clips[name] = len(channels)
    if not clips:
        raise ValueError("Missing motion clips")
    return {"file":path.name,"sha256":sha(path),"triangles":triangles,"joints":joints,"clips":clips}

def validate_original(path):
    data = inspect(path)
    pin = LOCK.get(path.name)
    if not pin or (data["sha256"],data["triangles"]) != pin:
        raise ValueError("Unpinned or changed original: "+path.name)
    return data

def validate_mapping(data, mapping):
    if mapping.get("heroId") not in HEROES or mapping.get("sourceSha256") != data["sha256"]:
        raise ValueError("Canonical hero identity/source hash mismatch")
    slots = mapping.get("clips", {})
    if set(slots) != set(SLOTS) or len(set(slots.values())) != len(SLOTS) or not set(slots.values()).issubset(data["clips"]):
        raise ValueError("Ten distinct hero motions required; do not alias missing skills")
    # Rights and art approval are separate from technical compatibility.
    for field in ("author","sourceUrl","license","licenseEvidence"):
        if not isinstance(mapping.get(field),str) or not mapping[field].strip():
            raise ValueError("Missing documented "+field)
    if mapping["license"] not in ("CC0-1.0","CC-BY-4.0"):
        raise ValueError("Unapproved redistribution license")
    return slots

def verify_lod(original, output, target):
    if not 0 < output["triangles"] <= target:
        raise ValueError("LOD triangle budget failed")
    if original["joints"] != output["joints"]:
        raise ValueError("LOD skin joint order drift")
    if set(original["clips"]) != set(output["clips"]):
        raise ValueError("LOD animation set drift")

def export_lods(source, destination, original, mapping):
    # Import only on explicit execution inside Blender, not while auditing.
    import bpy
    if tuple(bpy.app.version[:2]) != (4,5):
        raise RuntimeError("Use Blender 4.5 LTS for reproducible candidate export")
    validate_mapping(original,mapping)
    destination.mkdir(parents=True,exist_ok=False)
    try:
        outputs = []
        for index,target in enumerate(LOD_TARGETS):
            bpy.ops.wm.read_factory_settings(use_empty=True)
            bpy.ops.import_scene.gltf(filepath=str(source.resolve()))
            meshes = [o for o in bpy.context.scene.objects if o.type=="MESH"]
            armatures = [o for o in bpy.context.scene.objects if o.type=="ARMATURE"]
            if len(meshes)!=1 or len(armatures)!=1 or not any(m.type=="ARMATURE" for m in meshes[0].modifiers):
                raise RuntimeError("Expected one weighted mesh and armature")
            obj = meshes[0]
            # Reduce the actual authored surface; retain UVs and vertex groups.
            # No destructive remesh, generic base mesh, or synthetic hero geometry.
            bpy.context.view_layer.objects.active=obj
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            obj.data.calc_loop_triangles()
            ratio=min(.98,target/len(obj.data.loop_triangles)*.97)
            mod=obj.modifiers.new("Candidate mobile topology","DECIMATE")
            mod.decimate_type="COLLAPSE";mod.ratio=ratio;mod.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=mod.name)
            obj.data.calc_loop_triangles()
            if len(obj.data.loop_triangles)>target:
                raise RuntimeError("Decimation exceeded target")
            groups=len(obj.vertex_groups)
            if any(not any(g.group<groups and g.weight>0 for g in v.groups) for v in obj.data.vertices):
                raise RuntimeError("Unweighted vertices after reduction")
            output=destination/("lod"+str(index)+".glb")
            bpy.ops.export_scene.gltf(filepath=str(output),export_format="GLB",
                export_animations=True,export_animation_mode="ACTIONS",export_skins=True,
                export_all_influences=False,export_def_bones=False)
            row=inspect(output);verify_lod(original,row,target);outputs.append(row)
        (destination/"candidate-receipt.json").write_text(json.dumps({
            "status":"TECHNICAL_CANDIDATE_ONLY","heroId":mapping["heroId"],"original":original,
            "mapping":mapping,"lods":outputs,"unityImported":False,"visualApproved":False,
            "productionApproved":False},indent=2)+"\n",encoding="utf-8")
    except Exception:
        # Leave the incomplete directory for diagnosis, without an acceptance receipt.
        raise

def main(argv):
    p=argparse.ArgumentParser()
    p.add_argument("source",type=pathlib.Path)
    p.add_argument("--mapping",type=pathlib.Path)
    p.add_argument("--output",type=pathlib.Path)
    args=p.parse_args(argv)
    original=validate_original(args.source)
    if bool(args.mapping)!=bool(args.output):
        p.error("Both --mapping and --output are required for export")
    if args.mapping:
        export_lods(args.source,args.output,original,json.loads(args.mapping.read_text(encoding="utf-8")))
    print(json.dumps(original,indent=2))

if __name__=="__main__":
    # Blender passes its own CLI arguments before '--'.
    main(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:])
