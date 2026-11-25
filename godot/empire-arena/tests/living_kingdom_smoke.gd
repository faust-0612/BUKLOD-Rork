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
    world._start_or_cancel()
    if not world.move_to(Vector3(-5, 0, -5)) or world.quest.visited.size() != 0:
        quit(8)
        return
    for i in range(60):
        world._process(0.04)
    if world.quest.visited.size() != 1:
        quit(9)
        return
    print("BUKLOD_LIVING_KINGDOM_39_MISSIONS_AND_ARRIVAL_PASS")
    quit(0)
