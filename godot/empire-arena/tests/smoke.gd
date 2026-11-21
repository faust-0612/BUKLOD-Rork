## Standalone Godot 4.7.2 headless integration checks. No internet/auth or rewards.
extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _check(condition: bool, reason: String) -> bool:
	if not condition:
		push_error("BUKLOD_GODOT_SMOKE_FAIL: " + reason)
	return condition

func _run() -> void:
	var sim = load("res://scripts/arena_simulation.gd").new()
	if not _check(sim.available(), "13 heroes and 300 canonical pickups required"):
		quit(1)
		return
	if not _check(sim.begin("duel", "phan", "genesis_rift", true, "ace", "normal", 100), "solo starts"):
		quit(2)
		return
	if not _check(sim.state["solo"] and sim.state["units"].is_empty() and
			sim.state["towers"].is_empty(), "CPU duel has no hidden army damage"):
		quit(3)
		return
	var player: Dictionary = sim.actor("A0")
	var enemy: Dictionary = sim.actor("B0")
	enemy["pos"] = (player["pos"] as Vector2) + Vector2(2.0, 0)
	var old_hp: float = enemy["hp"]
	sim.advance()
	if not _check(sim.action("A0", "attack", Vector2.RIGHT, "B0") and float(enemy["hp"]) < old_hp,
			"native hero attack deals real damage"):
		quit(4)
		return
	if not _check(not sim.action("A0", "attack", Vector2.RIGHT, "B0"), "attack cooldown enforced"):
		quit(5)
		return
	if not _check(sim.action("A0", "primary", Vector2.RIGHT, "B0"), "Phan primary skill works"):
		quit(6)
		return
	var g := sim.begin("cluster", "quin", "verdant_fracture", false, "ace", "easy", 11)
	if not _check(g and sim.state["players"].size() == 6, "3v3 roster"):
		quit(7)
		return
	if not _check(sim.state["towers"].size() == 6 and sim.state["units"].size() == 4 and
			sim.state["nodes"].size() == 9, "RTS structures/resources/villagers initialized"):
		quit(8)
		return
	var mine_target: Dictionary = sim.state["nodes"].front()
	sim.actor("A0")["pos"] = mine_target["pos"]
	if not _check(sim.action("A0", "mine"), "resource mining succeeds near node"):
		quit(9)
		return
	sim.actor("A0")["pos"] = Vector2(14, float(sim.state["h"]) * 0.5)
	if not _check(sim.action("A0", "deposit"), "resource deposits are team-local"):
		quit(10)
		return
	if not _check(not sim.action("A0", "ultimate"), "ultimate locked before in-match level 6"):
		quit(11)
		return
	var prior_count: int = sim.state["units"].size()
	if not _check(sim.action("A0", "train", Vector2.ZERO, "villager"), "training debits supplies"):
		quit(12)
		return
	for i in range(65):
		sim.advance()
	if not _check(sim.state["units"].size() >= prior_count + 1, "trained unit spawns after queue time"):
		quit(13)
		return
	for p in sim.state["players"].values():
		if p["team"] == "B":
			p["alive"] = false
	sim.state["seals"]["B"]["breached"] = true
	sim.state["hunt_started"] = float(sim.state["time"])
	sim.advance()
	if not _check(sim.state["status"] == "finished" and sim.state["winner"] == "A",
			"real win requires seal breach and final elimination"):
		quit(14)
		return
	print("BUKLOD_GODOT_SMOKE_PASS: 13 heroes / 300 pickups / solo skills / 3v3 RTS / sealed victory")
	quit(0)
