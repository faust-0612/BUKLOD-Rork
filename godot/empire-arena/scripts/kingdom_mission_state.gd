## Session-only adventure state. Never an account, inventory, currency or reward authority.
extends RefCounted

var mission: Dictionary = {}
var visited: Dictionary = {}
var phase := "idle"
var completed: Dictionary = {}

func begin(spec: Dictionary) -> bool:
    if phase == "active" or phase == "return":
        return false
    if str(spec.get("id", "")).is_empty() or not str(spec.get("kind", "")) in ["collect", "sequence", "delivery"]:
        return false
    var count := int(spec.get("count", 0))
    if count < 1 or count > 3:
        return false
    mission = spec.duplicate(true)
    visited.clear()
    phase = "active"
    return true

func visit(index: int, distance: float) -> bool:
    if phase != "active" or not is_finite(distance) or distance < 0.0 or distance > 1.6:
        return false
    var count := int(mission.get("count", 0))
    if index < 0 or index >= count or visited.has(index):
        return false
    if mission.get("kind") in ["sequence", "delivery"] and index != visited.size():
        return false
    visited[index] = true
    if visited.size() == count:
        phase = "return"
    return true

func finish(distance: float) -> bool:
    if phase != "return" or not is_finite(distance) or distance < 0.0 or distance > 1.6:
        return false
    var id := str(mission.get("id"))
    completed[id] = int(completed.get(id, 0)) + 1
    phase = "complete"
    return true

func cancel() -> void:
    mission.clear()
    visited.clear()
    phase = "idle"
