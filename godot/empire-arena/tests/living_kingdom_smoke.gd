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
                var challenge: Dictionary = mission.challenge
                if challenge.type == "sudoku":
                    var progress = preload("res://scripts/kingdom_adventure_progression.gd").new()
                    challenge = progress.prepare(challenge,1,1,variant)
                if not field.begin(challenge,variant) or field.choose(-1):
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
    if total != 39 or state.completed.size() != 39 or field_total != 104 or not _negative_fields(field):
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
    world.progression.quick_play = false
    world.mode_picker.select(1)
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
    # Exercise actual direct Quick Game path, not a fabricated distance or direct state write.
    world.progression.quick_play = true
    world.mode_picker.select(0)
    world._select_realm(0)
    world._start_or_cancel()
    if world.field_index != 0 or world.quest.phase != "active":
        quit(23)
        return
    for choice in [0,1,2]:
        world._choose_field(choice)
    if world.quest.phase != "complete" or world.progression.practice_score != 1 or world.field_index != -1:
        quit(24)
        return
    world._next_adventure()
    if world.field_index != 0 or world.progression.active_level != 2:
        quit(25)
        return
    world._leave_field()
    if world.quest.phase != "idle" or world.progression.practice_score != 1:
        quit(26)
        return
    if not _progression_checks():
        quit(22)
        return
    print("BUKLOD_LIVING_KINGDOM_39_MISSIONS_AND_ARRIVAL_PASS")
    quit(0)

func _solve_field(field) -> bool:
    var data: Dictionary = field.spec
    match str(data.type):
        "sudoku":
            var original: Array = field.sudoku_grid.duplicate()
            if not _solve_sudoku(field,0):
                return false
            var solution: Array = field.sudoku_grid.duplicate()
            field.sudoku_grid = original.duplicate()
            for i in range(solution.size()):
                if field.sudoku_fixed.has(i):
                    if field.select_sudoku_cell(i):
                        return false
                    continue
                if not field.select_sudoku_cell(i):
                    return false
                field.choose(field.spec.items.find(solution[i]))
        "match3":
            var found := false
            for i in range(9):
                for j in range(i+1,9):
                    if field._adjacent(i,j):
                        field.choose(i)
                        if field.choose(j):
                            found = true
                            break
                if found:
                    break
        "merge":
            var initial: Array = field.board.duplicate()
            var sum := 0
            for item in initial:
                sum += int(item)
            # Find equal adjacent pairs and favor the merge that stays beside
            # the other tier; the authored three-tile boards always allow this.
            for turn in range(2):
                var found := false
                for i in range(9):
                    for j in range(9):
                        if i == j or not field._adjacent(i,j) or int(field.board[i]) <= 0 or field.board[i] != field.board[j]:
                            continue
                        var viable := turn == 1
                        if turn == 0:
                            for k in range(9):
                                if k != i and k != j and field._adjacent(j,k) and int(field.board[k]) == int(field.board[i])*2:
                                    viable = true
                        if viable:
                            field.choose(i)
                            field.choose(j)
                            found = true
                            break
                    if found:
                        break
                if not found:
                    return false
            var final_sum := 0
            for item in field.board:
                final_sum += int(item)
            if final_sum != sum:
                return false
        "farm":
            for i in range(data.items.size()):
                field.choose(i)
                field.choose(i)
                if field.choose(i):
                    return false
            field.tick(float(data.growSeconds)+0.1)
            for i in range(data.items.size()):
                field.choose(i)
        "rhythm":
            if field.choose(int(data.answer[0])):
                return false
            for note in data.answer:
                field.tick(float(data.beatSeconds))
                field.choose(int(note))
        "select":
            field.choose(int(data.answer))
        "sequence","memory":
            if data.type == "memory":
                if field.choose(0):
                    return false
                field.tick(field.memory_seconds+0.1)
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

func _negative_fields(field) -> bool:
    if not field.begin({"type":"match3","items":["A","B","A","C","A","B","B","C","C"],"goal":3}):
        return false
    var before: Array = field.board.duplicate()
    field.choose(0)
    field.choose(1)
    if field.solved or field.board != before:
        return false
    if not field.begin({"type":"merge","items":[1,1,2,0,0,0,0,0,0],"goal":4}):
        return false
    before = field.board.duplicate()
    field.choose(1)
    field.choose(2)
    if field.solved or field.board != before:
        return false
    if not field.begin({"type":"farm","items":["A","B"],"goal":2,"growSeconds":2.5}):
        return false
    field.choose(0)
    field.choose(0)
    field.choose(0)
    if field.score != 0 or field.crop_stage[0] != 2:
        return false
    if not field.begin({"type":"rhythm","items":["A","B"],"answer":[0,1],"beatSeconds":0.8}):
        return false
    field.choose(0)
    if field.beat_index != 0:
        return false
    field.tick(1.2)
    return field.rhythm_misses == 1 and not field.solved

func _progression_checks() -> bool:
    var progress = preload("res://scripts/kingdom_adventure_progression.gd").new()
    for i in range(150):
        progress.begin("game")
        if progress.active_level != i+1 or progress.complete_round() != 1 or progress.complete_round() != 0:
            return false
    progress.difficulty = 2
    progress.begin("game")
    if progress.active_level != 1 or progress.complete_round() != 2 or progress.total_rounds != 151:
        return false
    var base := {"type":"budget","items":[3,4,5,7],"goal":12,"limit":3}
    for tier in range(4):
        for level in [1,2,50,10000]:
            var data: Dictionary = progress.prepare(base,level,tier,0)
            var field = Field.new()
            if not field.begin(data,0) or not _solve_field(field):
                return false
    var quick = State.new()
    if not quick.begin({"id":"quick","kind":"collect","count":1,"quick":true}) or quick.visit(0,0.0) or quick.finish(0.0) or quick.finish_quick(false) or not quick.finish_quick(true) or quick.finish_quick(true):
        return false
    return progress.practice_score == 152

func _solve_sudoku(field, index: int) -> bool:
    if index >= field.sudoku_grid.size():
        return not field.sudoku_grid.has(0)
    if field.sudoku_fixed.has(index):
        return _solve_sudoku(field,index+1)
    for value in range(1,field.sudoku_size+1):
        if not field._sudoku_can_place(index,value):
            continue
        field.sudoku_grid[index] = value
        if _solve_sudoku(field,index+1):
            return true
        field.sudoku_grid[index] = 0
    return false
