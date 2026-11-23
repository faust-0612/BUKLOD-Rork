## Real Godot 4.7.2 headless interaction contract for OTA-safe visuals.
## No rewards, ownership, network or client-authoritative progression.
extends SceneTree

func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var preview_script = load("res://scripts/world_preview.gd")
    var controller_script = load("res://scripts/world_explore_controller.gd")
    if preview_script == null or controller_script == null:
        push_error("Missing Godot native premium world scripts")
        quit(1)
        return
    var preview: Node2D = preview_script.new()
    root.add_child(preview)
    var explore: Node2D = controller_script.new()
    preview.add_child(explore)
    await process_frame
    if explore.get_dev_snapshot().get("server_settlement") != false:
        push_error("Preview settlement unexpectedly enabled")
        quit(2)
        return
    var destination: Vector2 = explore._station(0)
    if not explore.move_to(destination) or explore.local_visits != 0:
        push_error("Kingdom must not grant a station visit before arrival")
        quit(3)
        return
    for i in range(90):
        explore._process(0.05)
    if explore.local_visits != 1 or explore.active_station != 0:
        push_error("Kingdom station visit did not complete on arrival")
        quit(4)
        return
    for i in range(20):
        explore._process(0.05)
    if explore.local_visits != 1:
        push_error("Station repeated without a new player interaction")
        quit(5)
        return
    preview.world_id = "house"
    explore.displayed_world = "house"
    explore.avatar_position = Vector2(300, 400)
    explore.avatar_target = explore.avatar_position
    var stage: int = preview.preview_stage
    if not explore.move_to(Vector2(640, 505)) or preview.preview_stage != stage:
        push_error("House builds on touch, not after character movement")
        quit(6)
        return
    for i in range(90):
        explore._process(0.05)
    if preview.preview_stage != stage + 1:
        push_error("House preview stage did not complete after arrival")
        quit(7)
        return
    for i in range(15):
        explore._process(0.05)
    if preview.preview_stage != stage + 1:
        push_error("House stage repeated without a new touch")
        quit(8)
        return
    for item_class in ["badge", "bond", "book", "chest", "crystal", "light", "relic"]:
        for variant in range(1, 7):
            var path: String = "res://kingdom-items/" + item_class + "-" + str(variant) + ".webp"
            var raw: PackedByteArray = FileAccess.get_file_as_bytes(path)
            var img := Image.new()
            if raw.is_empty() or img.load_webp_from_buffer(raw) != OK or img.is_empty():
                push_error("Missing approved owner collectible art " + path)
                quit(9)
                return
    for name in ["kingdom_ambience", "house_ambience"]:
        var raw: PackedByteArray = FileAccess.get_file_as_bytes("res://world-audio/" + name + ".wav")
        if raw.is_empty() or AudioStreamWAV.load_from_buffer(raw) == null:
            push_error("Missing original BUKLOD ambient WAV: " + name)
            quit(10)
            return
    if preview.ambient_enabled:
        push_error("Native game ambience must start OFF to protect PTT/radio audio")
        quit(11)
        return
    print("BUKLOD_GODOT_PREMIUM_WORLD_INTERACTION_PASS: Kingdom, House, 42 Library icons, original ambient tracks OFF by default")
    quit(0)
