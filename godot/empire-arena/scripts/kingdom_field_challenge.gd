## Session-only interactive field challenge. No account/reward settlement.
extends RefCounted
const TYPES := ["budget","route","pair","select","sequence","memory","match3","merge","farm","rhythm","sudoku"]
var spec: Dictionary = {}
var picks: Array[int] = []
var matched: Dictionary = {}
var preview_left := 0.0
var solved := false
var feedback := ""
var reveal_left := 0.0
var wrong_pair: Array[int] = []
var board: Array = []
var score := 0
var selected_tile := -1
var crop_stage: Array[int] = []
var crop_remaining: Array[float] = []
var beat_clock := 0.0
var beat_index := 0
var rhythm_misses := 0
var timing_window := 0.24
var memory_seconds := 3.0
var sudoku_grid: Array = []
var sudoku_fixed: Dictionary = {}
var sudoku_selected := -1
var sudoku_size := 0
var sudoku_box_rows := 0
var sudoku_box_cols := 0
func begin(data: Dictionary, variant: int = 0) -> bool:
    clear()
    if not str(data.get("type","")) in TYPES or not data.get("items",[]) is Array:
        return false
    var items: Array = data.items
    if items.size() < 2 or items.size() > 9:
        return false
    var kind := str(data.get("type",""))
    if kind == "select" and (int(data.get("answer",-1)) < 0 or int(data.get("answer",-1)) >= items.size()):
        return false
    if kind in ["sequence","memory"]:
        var answer: Variant = data.get("answer",[])
        if not answer is Array or answer.is_empty() or answer.size() > 9:
            return false
        for item in answer:
            if int(item) < 0 or int(item) >= items.size():
                return false
    if kind == "budget":
        if int(data.get("limit",0)) < 1 or int(data.get("limit",0)) > items.size() or int(data.get("goal",0)) <= 0:
            return false
        for item in items:
            if int(item) <= 0:
                return false
    if kind == "route" and (items.size() != 9 or str(items[0]) != "Start" or str(items[8]) != "Goal"):
        return false
    if kind == "pair":
        for item in items:
            if items.count(item) != 2:
                return false
    if kind in ["match3","merge"] and items.size() != 9:
        return false
    if kind == "match3" and int(data.get("goal",0)) != 3:
        return false
    if kind == "merge":
        if int(data.get("goal",0)) < 4:
            return false
        var total := 0
        for item in items:
            if int(item) < 0 or int(item) == int(data.goal):
                return false
            total += int(item)
        if total != int(data.goal):
            return false
    if kind == "farm" and (int(data.get("goal",0)) != items.size() or float(data.get("growSeconds",0)) < 1.0):
        return false
    if kind == "sudoku" and not _begin_sudoku(data):
        return false
    if kind == "rhythm":
        var answer: Variant = data.get("answer",[])
        if not answer is Array or answer.is_empty() or answer.size() > 9 or float(data.get("beatSeconds",0)) < 0.6:
            return false
        for item in answer:
            if int(item) < 0 or int(item) >= items.size():
                return false
    spec = data.duplicate(true)
    timing_window = clampf(float(data.get("timingWindow",0.24)),0.16,0.4)
    memory_seconds = clampf(float(data.get("previewSeconds",3.0)),2.0,5.0)
    _vary(maxi(0,variant))
    if kind in ["match3","merge"]:
        board = spec.items.duplicate()
    if kind == "farm":
        crop_stage.resize(items.size())
        crop_stage.fill(0)
        crop_remaining.resize(items.size())
        crop_remaining.fill(0.0)
    if kind == "rhythm":
        beat_clock = -float(spec.beatSeconds)
    if spec.type == "memory":
        preview_left = memory_seconds
    if spec.type == "route":
        picks.append(0)
    return true
func _vary(variant: int) -> void:
    if variant == 0 or spec.type == "sudoku":
        return
    if spec.type in ["route","match3","merge"]:
        if variant % 2 == 1:
            var original: Array = spec.items.duplicate()
            for i in range(9):
                var transposed := (i%3)*3+floori(float(i)/3.0)
                spec.items[transposed] = original[i]
        elif variant % 3 == 2 and spec.type != "route":
            var original: Array = spec.items.duplicate()
            for i in range(9):
                var mirrored := floori(float(i)/3.0)*3+2-i%3
                spec.items[mirrored] = original[i]
        return
    var old: Array = spec.items.duplicate()
    var shift := variant % old.size()
    for i in range(old.size()):
        spec.items[(i+shift)%old.size()] = old[i]
    if spec.type == "select":
        spec.answer = (int(spec.answer)+shift)%old.size()
    elif spec.type in ["sequence","memory","rhythm"]:
        for i in range(spec.answer.size()):
            spec.answer[i] = (int(spec.answer[i])+shift)%old.size()

func clear() -> void:
    spec.clear()
    picks.clear()
    matched.clear()
    preview_left = 0.0
    solved = false
    feedback = ""
    wrong_pair.clear()
    reveal_left = 0.0
    board.clear()
    score = 0
    selected_tile = -1
    crop_stage.clear()
    crop_remaining.clear()
    beat_clock = 0.0
    beat_index = 0
    rhythm_misses = 0
    timing_window = 0.24
    memory_seconds = 3.0
    sudoku_grid.clear()
    sudoku_fixed.clear()
    sudoku_selected = -1
    sudoku_size = 0
    sudoku_box_rows = 0
    sudoku_box_cols = 0
func tick(delta: float) -> bool:
    var changed := false
    if preview_left > 0.0:
        preview_left = maxf(0.0,preview_left-maxf(0.0,delta))
        changed = preview_left == 0.0
    if reveal_left > 0.0:
        reveal_left = maxf(0.0,reveal_left-maxf(0.0,delta))
        if reveal_left == 0.0:
            wrong_pair.clear()
            changed = true
    if not spec.is_empty() and not solved and spec.type == "farm":
        for i in range(crop_stage.size()):
            if crop_stage[i] == 2:
                crop_remaining[i] = maxf(0.0,crop_remaining[i]-maxf(0.0,delta))
                if crop_remaining[i] <= 0.0:
                    crop_stage[i] = 3
                    changed = true
    if not spec.is_empty() and not solved and spec.type == "rhythm":
        beat_clock += maxf(0.0,delta)
        if beat_clock > timing_window:
            rhythm_misses += 1
            beat_index = 0
            beat_clock = -float(spec.beatSeconds)
            feedback = "Missed beat. Start the pattern again."
        changed = true
    return changed
func choose(index: int) -> bool:
    if spec.is_empty() or solved or preview_left > 0.0 or reveal_left > 0.0 or index < 0 or index >= spec.items.size():
        return false
    feedback = ""
    match str(spec.type):
        "sudoku":
            _choose_sudoku_digit(int(spec.items[index]))
        "match3":
            _choose_match(index)
        "merge":
            _choose_merge(index)
        "farm":
            _choose_crop(index)
        "rhythm":
            _choose_beat(index)
        "select":
            solved = index == int(spec.answer)
            feedback = "Correct." if solved else "Try another choice."
        "sequence","memory":
            if index != int(spec.answer[picks.size()]):
                picks.clear()
                feedback = "Not quite. Try the pattern again."
                if spec.type == "memory":
                    preview_left = memory_seconds
                return false
            picks.append(index)
            solved = picks.size() == spec.answer.size()
        "budget":
            if picks.has(index):
                picks.erase(index)
                return false
            picks.append(index)
            var sum := 0
            for i in picks:
                sum += int(spec.items[i])
            if picks.size() == int(spec.limit) and sum == int(spec.goal):
                solved = true
            elif picks.size() >= int(spec.limit) or sum > int(spec.goal):
                feedback = "Adjust your allocation to meet the target."
                picks.clear()
        "pair":
            if matched.has(index) or picks.has(index):
                return false
            picks.append(index)
            if picks.size() == 2:
                if spec.items[picks[0]] == spec.items[picks[1]]:
                    matched[picks[0]] = true
                    matched[picks[1]] = true
                else:
                    wrong_pair.assign(picks)
                    reveal_left = 0.75
                    feedback = "Those do not match. Try again."
                picks.clear()
            solved = matched.size() == spec.items.size()
        "route":
            if str(spec.items[index]) == "Blocked" or picks.has(index):
                return false
            var prev: int = picks.back()
            if absi(prev%3-index%3)+absi(floori(float(prev)/3.0)-floori(float(index)/3.0)) != 1:
                feedback = "Choose an adjacent tile."
                return false
            picks.append(index)
            solved = index == 8
    return solved
func _begin_sudoku(data: Dictionary) -> bool:
    sudoku_size = int(data.get("size",0))
    sudoku_box_rows = int(data.get("boxRows",0))
    sudoku_box_cols = int(data.get("boxCols",0))
    if not sudoku_size in [4,6] or sudoku_box_rows != 2 or sudoku_box_cols*sudoku_box_rows != sudoku_size:
        return false
    var clues: Variant = data.get("clues",[])
    if not clues is Array or clues.size() != sudoku_size*sudoku_size:
        return false
    sudoku_grid.resize(clues.size())
    sudoku_grid.fill(0)
    for i in range(clues.size()):
        var value := int(clues[i])
        if value < 0 or value > sudoku_size:
            return false
        if value > 0:
            if not _sudoku_can_place(i,value):
                return false
            sudoku_grid[i] = value
            sudoku_fixed[i] = true
    return sudoku_fixed.size() > 0 and sudoku_fixed.size() < sudoku_grid.size()

func _sudoku_can_place(cell: int, value: int) -> bool:
    var row := floori(float(cell)/sudoku_size)
    var col := cell%sudoku_size
    for i in range(sudoku_grid.size()):
        if i == cell or int(sudoku_grid[i]) != value:
            continue
        var r := floori(float(i)/sudoku_size)
        var c := i%sudoku_size
        if r == row or c == col or (floori(float(r)/sudoku_box_rows) == floori(float(row)/sudoku_box_rows) and floori(float(c)/sudoku_box_cols) == floori(float(col)/sudoku_box_cols)):
            return false
    return true

func select_sudoku_cell(cell: int) -> bool:
    if spec.get("type") != "sudoku" or solved or cell < 0 or cell >= sudoku_grid.size() or sudoku_fixed.has(cell):
        return false
    sudoku_selected = cell
    feedback = ""
    return true

func _choose_sudoku_digit(value: int) -> void:
    if sudoku_selected < 0 or sudoku_fixed.has(sudoku_selected):
        feedback = "Select an empty or editable square first."
        return
    if value == 0:
        sudoku_grid[sudoku_selected] = 0
        return
    if value < 1 or value > sudoku_size or not _sudoku_can_place(sudoku_selected,value):
        feedback = "That number already appears in this row, column or region."
        return
    sudoku_grid[sudoku_selected] = value
    solved = not sudoku_grid.has(0)

func _adjacent(a: int, b: int) -> bool:
    return absi(a%3-b%3)+absi(floori(float(a)/3.0)-floori(float(b)/3.0)) == 1

func _matches() -> Dictionary:
    var found := {}
    for i in range(3):
        for line in [[i*3,i*3+1,i*3+2],[i,i+3,i+6]]:
            if str(board[line[0]]) != "" and board[line[0]] == board[line[1]] and board[line[1]] == board[line[2]]:
                for tile in line:
                    found[tile] = true
    return found

func _choose_match(index: int) -> void:
    if str(board[index]).is_empty():
        return
    if selected_tile == -1 or not _adjacent(selected_tile,index):
        selected_tile = index if selected_tile != index else -1
        return
    var previous := selected_tile
    selected_tile = -1
    var old: Variant = board[previous]
    board[previous] = board[index]
    board[index] = old
    var matches := _matches()
    if matches.is_empty():
        board[index] = board[previous]
        board[previous] = old
        feedback = "No line of three. Swap undone."
        return
    score += matches.size()
    for tile in matches:
        board[tile] = ""
    solved = score >= int(spec.goal)

func _choose_merge(index: int) -> void:
    if selected_tile == -1:
        if int(board[index]) > 0:
            selected_tile = index
        return
    var previous := selected_tile
    selected_tile = -1
    if previous == index:
        return
    if not _adjacent(previous,index) or int(board[previous]) != int(board[index]) or int(board[index]) <= 0:
        feedback = "Merge equal adjacent tiers only."
        return
    board[index] = int(board[index])*2
    board[previous] = 0
    score = maxi(score,int(board[index]))
    solved = score >= int(spec.goal)

func _choose_crop(index: int) -> void:
    match crop_stage[index]:
        0:
            crop_stage[index] = 1
        1:
            crop_stage[index] = 2
            crop_remaining[index] = float(spec.growSeconds)
        2:
            feedback = "Growing. Wait until the crop is ready."
        3:
            crop_stage[index] = 4
            score += 1
            solved = score >= int(spec.goal)
        4:
            feedback = "Already harvested."

func _choose_beat(index: int) -> void:
    if absf(beat_clock) > timing_window:
        feedback = "Wait for NOW."
        return
    if index != int(spec.answer[beat_index]):
        rhythm_misses += 1
        beat_index = 0
        beat_clock = -float(spec.beatSeconds)
        feedback = "Wrong note. Start again."
        return
    beat_index += 1
    solved = beat_index == spec.answer.size()
    beat_clock = -float(spec.beatSeconds)

func tile_label(index: int) -> String:
    if spec.type == "sudoku":
        return "Erase" if int(spec.items[index]) == 0 else str(spec.items[index])
    if spec.type == "match3":
        return ("▶ " if selected_tile == index else "") + (str(board[index]) if str(board[index]) != "" else "Cleared")
    if spec.type == "merge":
        return ("▶ " if selected_tile == index else "") + (str(spec.get("unit","Tier"))+" "+str(board[index]) if int(board[index]) > 0 else "Empty")
    if spec.type == "farm":
        var stages := ["Plant","Water","Growing","Harvest","Done"]
        return str(spec.items[index]) + ": " + stages[crop_stage[index]]

    if spec.type == "pair" and not picks.has(index) and not matched.has(index) and not wrong_pair.has(index):
        return "Tile " + str(index+1)
    return str(spec.items[index])

func status() -> String:
    if spec.is_empty():
        return ""
    if spec.type == "memory" and preview_left > 0.0:
        var pattern := PackedStringArray()
        for i in spec.answer:
            pattern.append(str(spec.items[int(i)]))
        return "Remember: " + " · ".join(pattern)
    if spec.type == "sudoku":
        return "Filled: %d / %d • Tap an editable square, then a number." % [sudoku_grid.size()-sudoku_grid.count(0),sudoku_grid.size()]
    if spec.type == "match3":
        return "Matched: %d / %d" % [score,int(spec.goal)]
    if spec.type == "merge":
        return "Highest merged tier: %d / %d" % [score,int(spec.goal)]
    if spec.type == "farm":
        return "Harvested: %d / %d" % [score,int(spec.goal)]
    if spec.type == "rhythm":
        if solved:
            return "Rhythm complete"
        var note := str(spec.items[int(spec.answer[beat_index])])
        return "%d/%d • %s • %s" % [beat_index+1,spec.answer.size(),note,"NOW" if absf(beat_clock)<=timing_window else "Wait %.1fs" % maxf(0.0,-beat_clock)]
    if spec.type == "budget":
        var total := 0
        for i in picks:
            total += int(spec.items[i])
        return "Allocation: %d / %d (%d / %d items)" % [total,int(spec.goal),picks.size(),int(spec.limit)]
    if spec.type == "pair":
        return "Matched: %d / %d" % [matched.size(),spec.items.size()]
    if spec.type in ["memory","sequence"]:
        return "Pattern: %d / %d" % [picks.size(),spec.answer.size()]
    return feedback
