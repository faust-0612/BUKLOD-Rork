## Session-only interactive field challenge. No account/reward settlement.
extends RefCounted
const TYPES := ["budget","route","pair","select","sequence","memory"]
var spec: Dictionary = {}
var picks: Array[int] = []
var matched: Dictionary = {}
var preview_left := 0.0
var solved := false
var feedback := ""
func begin(data: Dictionary) -> bool:
    clear()
    if not str(data.get("type","")) in TYPES or not data.get("items",[]) is Array:
        return false
    var items: Array = data.items
    if items.size() < 2 or items.size() > 9:
        return false
    spec = data.duplicate(true)
    if spec.type == "memory":
        preview_left = 3.0
    if spec.type == "route":
        picks.append(0)
    return true
func clear() -> void:
    spec.clear()
    picks.clear()
    matched.clear()
    preview_left = 0.0
    solved = false
    feedback = ""
func tick(delta: float) -> bool:
    if preview_left <= 0.0:
        return false
    preview_left = maxf(0.0,preview_left-maxf(0.0,delta))
    return preview_left == 0.0
func choose(index: int) -> bool:
    if spec.is_empty() or solved or preview_left > 0.0 or index < 0 or index >= spec.items.size():
        return false
    feedback = ""
    match str(spec.type):
        "select":
            solved = index == int(spec.answer)
            feedback = "Correct." if solved else "Try another choice."
        "sequence","memory":
            if index != int(spec.answer[picks.size()]):
                picks.clear()
                feedback = "Not quite. Try the pattern again."
                if spec.type == "memory":
                    preview_left = 3.0
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
func status() -> String:
    if spec.is_empty():
        return ""
    if spec.type == "memory" and preview_left > 0.0:
        var pattern := PackedStringArray()
        for i in spec.answer:
            pattern.append(str(spec.items[int(i)]))
        return "Remember: " + " · ".join(pattern)
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
