extends SceneTree
const State = preload("res://scripts/kingdom_mission_state.gd")
const Field = preload("res://scripts/kingdom_field_challenge.gd")
func _initialize() -> void:
    call_deferred("_run")
func _run() -> void:
    var state = State.new()
    var raw: Variant = JSON.parse_string(FileAccess.get_file_as_bytes("res://data/kingdom_realms.json").get_string_from_utf8())
    if not raw is Dictionary or raw.get("serverSettlement") != false or raw.get("realms", []).size() != 13:
        quit(1)
        return
    var total := 0
    var field_total := 0
    var field = Field.new()
    for realm in raw.realms:
        for mission in realm.missions:
            for variant in range(int(mission.count)):
                if not field.begin(mission.challenge,variant) or field.choose(-1):
                    quit(20)
                    return
                if not _solve_field(field):
                    push_error("Unsolved field challenge: " + str(mission.id))
                    quit(21)
                    return
                field_total += 1
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
    if total != 39 or state.completed.size() != 39 or field_total != 104:
        quit(6)
        return
    var world = load("res://scenes/LivingKingdom.tscn").instantiate()
    root.add_child(world)
    await process_frame
    if world.get_dev_snapshot().get("realms") != 13 or world.get_dev_snapshot().get("server_settlement") != false or not world.get_dev_snapshot().get("adventure_ready",false):
        quit(7)
        return
    if world._valid_realm_catalog({"schema":1,"serverSettlement":false,"mode":"SESSION_LOCAL_ADVENTURE","realms":[]}):
        quit(17)
        return
    var tampered: Dictionary = raw.duplicate(true)
    tampered.realms[1].id = tampered.realms[0].id
    if world._valid_realm_catalog(tampered):
        quit(18)
        return
    var biomes := {}
    var landmarks := {}
    for i in range(13):
        world._select_realm(i)
        var snap: Dictionary = world.get_dev_snapshot()
        if snap.get("realm_props", 0) < 8 or not snap.get("guide_ready", false) or not snap.get("original_avatar", false) or not snap.get("skinned_avatar", false):
            quit(10)
            return
        biomes[snap.get("biome")] = true
        landmarks[snap.get("landmark_id")] = true
    if biomes.size() != 13 or landmarks.size() != 13 or landmarks.has("") or world.move_to(Vector3(0, 0, 23)):
        quit(11)
        return
    world._choose_practice_avatar(1)
    if world.get_dev_snapshot().get("practice_avatar_id") != str(raw.realms[1].id) or not world.get_dev_snapshot().get("skinned_avatar", false):
        quit(15)
        return
    world._choose_practice_avatar(0)
    world._select_realm(0)
    world._process(0.04)
    world._talk_to_guide()
    if not world.guide_talking or world.guide_notice.text.is_empty() or world.get_dev_snapshot().get("guide_clip") != "Interact":
        quit(12)
        return
    world._start_or_cancel()
    if world.get_dev_snapshot().get("fx_count",0) <= 0:
        quit(16)
        return
    if not world.move_to(Vector3(-5, 0, -5)) or world.quest.visited.size() != 0:
        quit(8)
        return
    for i in range(160):
        world._process(0.04)
    if world.quest.visited.size() != 0 or world.get_dev_snapshot().get("field_index") != 0:
        quit(9)
        return
    # Solve the actual Phan budget challenge, not just a marker arrival.
    for choice in [0,1,2]:
        world._choose_field(choice)
    if world.quest.visited.size() != 1 or world.get_dev_snapshot().get("field_index") != -1:
        quit(19)
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

func _solve_field(field) -> bool:
    var data: Dictionary = field.spec
    match str(data.type):
        "select":
            field.choose(int(data.answer))
        "sequence","memory":
            if data.type == "memory":
                if field.choose(0):
                    return false
                field.tick(3.1)
            for x in data.answer:
                field.choose(int(x))
        "budget":
            for mask_value in range(1,1 << data.items.size()):
                var ids: Array[int] = []
                var total := 0
                for i in range(data.items.size()):
                    if mask_value & (1 << i):
                        ids.append(i)
                        total += int(data.items[i])
                if ids.size() == int(data.limit) and total == int(data.goal):
                    for i in ids:
                        field.choose(i)
                    break
        "pair":
            for i in range(data.items.size()):
                if field.matched.has(i):
                    continue
                for j in range(i+1,data.items.size()):
                    if data.items[i] == data.items[j]:
                        field.choose(i)
                        field.choose(j)
                        break
        "route":
            var queue: Array = [[0]]
            var seen := {0:true}
            while not queue.is_empty():
                var path: Array = queue.pop_front()
                var current: int = path.back()
                if current == 8:
                    for i in range(1,path.size()):
                        field.choose(int(path[i]))
                    break
                for i in range(9):
                    if seen.has(i) or data.items[i] == "Blocked":
                        continue
                    if absi(current%3-i%3)+absi(floori(float(current)/3.0)-floori(float(i)/3.0)) == 1:
                        seen[i] = true
                        var next := path.duplicate()
                        next.append(i)
                        queue.append(next)
    return field.solved and not field.choose(0)
