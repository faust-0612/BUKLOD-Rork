## Godot 4.7.2 real imported GLB runtime and mobile scene smoke (no network/XP).
extends SceneTree
func _initialize() -> void:
    call_deferred("_run")
func _run() -> void:
    var manifest_raw: PackedByteArray = FileAccess.get_file_as_bytes("res://data/3d_manifest.json")
    var manifest = JSON.parse_string(manifest_raw.get_string_from_utf8())
    if not (manifest is Dictionary) or manifest.get("license") != "CC0-1.0":
        push_error("No approved GLB provenance/rights manifest")
        quit(1)
        return
    var models: Array = manifest.get("models", [])
    if models.size() != 20:
        push_error("Required 20 real GLBs missing")
        quit(2)
        return
    for record in models:
        var id: String = str(record.get("id", ""))
        var raw: PackedByteArray = FileAccess.get_file_as_bytes("res://3d/kenney/" + id + ".glb")
        if raw.size() != int(record.get("bytes", -1)):
            push_error("Model missing or size mismatch: " + id)
            quit(3)
            return
        var doc := GLTFDocument.new()
        var state := GLTFState.new()
        if doc.append_from_buffer(raw, "res://3d/kenney/", state) != OK:
            push_error("Unparseable actual 3D GLB mesh: " + id)
            quit(4)
            return
        var scene: Node = doc.generate_scene(state)
        if not (scene is Node3D):
            push_error("No usable 3D scene graph for " + id)
            quit(5)
            return
    var scene_file = load("res://scenes/PremiumWorld3D.tscn")
    if scene_file == null:
        push_error("Godot premium 3D scene unavailable")
        quit(6)
        return
    var world: Node3D = scene_file.instantiate()
    root.add_child(world)
    await process_frame
    var snap: Dictionary = world.get_dev_snapshot()
    if not snap.get("offline", false) or snap.get("server_settlement", true):
        push_error("Unsafe 3D economy state")
        quit(7)
        return
    if int(snap.get("models", 0)) < 8:
        push_error("3D props not integrated into live scene")
        quit(8)
        return
    if not world.move_to(Vector3(4, 0, 3)):
        push_error("3D touch locomotion not wired")
        quit(9)
        return
    for i in range(50):
        world._process(0.04)
    if world.player.position.distance_to(Vector3(4, 0, 3)) > 1.0:
        push_error("3D avatar did not approach target")
        quit(10)
        return
    print("BUKLOD_206_IMPORTED_REAL_GLB_20_GODOT_3D_INTERACTION_PASS")
    quit(0)
