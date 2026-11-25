extends SceneTree
const State = preload("res://scripts/kingdom_mission_state.gd")
func _initialize() -> void:
    call_deferred("_run")
func _run() -> void:
    var state = State.new()
    var raw: Variant = JSON.parse_string(FileAccess.get_file_as_bytes("res://data/kingdom_realms.json").get_string_from_utf8())
    if not raw is Dictionary or raw.get("serverSettlement") != false or raw.get("realms", []).size() != 13:
        quit(1)
        return
    var total := 0
    for realm in raw.realms:
        for mission in realm.missions:
            state.cancel()
            if not state.begin(mission) or state.visit(0, 20.0) or state.finish(0.0):
                quit(2)
                return
            if mission.kind != "collect" and state.visit(1, 0.0):
                quit(3)
                return
            for i in range(int(mission.count)):
                if not state.visit(i, 0.0) or state.visit(i, 0.0):
                    quit(4)
                    return
            if state.finish(20.0) or not state.finish(0.0) or state.finish(0.0):
                quit(5)
                return
            total += 1
    if total != 39 or state.completed.size() != 39:
        quit(6)
        return
    var world = load("res://scenes/LivingKingdom.tscn").instantiate()
    root.add_child(world)
    await process_frame
    if world.get_dev_snapshot().get("realms") != 13 or world.get_dev_snapshot().get("server_settlement") != false:
        quit(7)
        return
    var biomes := {}
    for i in range(13):
        world._select_realm(i)
        var snap: Dictionary = world.get_dev_snapshot()
        if snap.get("realm_props", 0) < 8 or not snap.get("guide_ready", false) or not snap.get("original_avatar", false):
            quit(10)
            return
        biomes[snap.get("biome")] = true
    if biomes.size() != 13 or world.move_to(Vector3(0, 0, 23)):
        quit(11)
        return
    world._select_realm(0)
    world._process(0.04)
    world._talk_to_guide()
    if not world.guide_talking or world.guide_notice.text.is_empty():
        quit(12)
        return
    world._start_or_cancel()
    if not world.move_to(Vector3(-5, 0, -5)) or world.quest.visited.size() != 0:
        quit(8)
        return
    for i in range(60):
        world._process(0.04)
    if world.quest.visited.size() != 1:
        quit(9)
        return
    # The next-adventure action must keep all earlier session clears.
    var spec: Dictionary = world.quest.mission
    for i in range(int(spec.count)):
        if not world.quest.visited.has(i):
            world.quest.visit(i, 0.0)
    if not world.quest.finish(0.0):
        quit(13)
        return
    world._update_quest_status()
    world._next_adventure()
    if world.mission_index != 1 or world.quest.completed.size() != 1 or world.quest.phase != "idle":
        quit(14)
        return
    print("BUKLOD_LIVING_KINGDOM_39_MISSIONS_AND_ARRIVAL_PASS")
    quit(0)
