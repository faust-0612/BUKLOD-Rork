## Godot 4.7.2 private model smoke: only active if rights-approved pack exists.
## Never connects to the network or grants wallet/property/inventory rewards.
extends SceneTree
func _initialize() -> void:
    call_deferred("_run")
func _run() -> void:
    var filename := "res://data/private_3d_manifest.json"
    if not FileAccess.file_exists(filename):
        print("BUKLOD_PRIVATE_LIBRARY_3D_SMOKE_NOT_PUBLISHED: no rights-approved private pack")
        quit(0)
        return
    var raw := FileAccess.get_file_as_bytes(filename)
    var manifest = JSON.parse_string(raw.get_string_from_utf8())
    if not (manifest is Dictionary):
        push_error("Invalid licensed private GLB manifest")
        quit(1)
        return
    if manifest.get("schema") != 1 or manifest.get("rightsStatus") != "verified":
        push_error("Private rights gate not passed")
        quit(2)
        return
    var imported: Array = manifest.get("models", [])
    if imported.is_empty() or imported.size() > 16:
        push_error("Private GLB count outside approved bounds")
        quit(3)
        return
    var total := 0
    for model in imported:
        var id: String = str(model.get("id", ""))
        if not id.begins_with("private_"):
            push_error("Unapproved private model ID")
            quit(4)
            return
        if model.get("rightsStatus") != "verified" or str(model.get("license", "")) == "":
            push_error("Private model missing commercial-use rights evidence")
            quit(5)
            return
        var data := FileAccess.get_file_as_bytes("res://3d/private/" + id + ".glb")
        total += data.size()
        if data.size() != int(model.get("bytes", -1)) or data.sha256_text() != str(model.get("sha256", "")):
            push_error("Private GLB hash mismatch: " + id)
            quit(6)
            return
        if total > 130 * 1024 * 1024:
            push_error("Private pack too large")
            quit(7)
            return
        var doc := GLTFDocument.new()
        var state := GLTFState.new()
        if doc.append_from_buffer(data, "res://3d/private/", state) != OK:
            push_error("Private 3D GLB failed real Godot import: " + id)
            quit(8)
            return
        var scene = doc.generate_scene(state)
        if not (scene is Node3D):
            push_error("Private GLB has no real 3D scene: " + id)
            quit(9)
            return
    print("BUKLOD_PRIVATE_LIBRARY_APPROVED_GLB_GODOT_IMPORT_PASS: ",imported.size())
    quit(0)
