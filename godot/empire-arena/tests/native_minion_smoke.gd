## Real Godot 4.7.2 headless minion-wave gameplay checks.
extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _check(condition: bool, reason: String) -> bool:
	if not condition:
		push_error("BUKLOD_NATIVE_MINION_FAIL: " + reason)
	return condition

func _run() -> void:
	var source = load("res://scripts/native_minion_waves.gd")
	var sim = load("res://scripts/arena_simulation.gd").new()
	if not _check(sim.begin("duel", "phan", "genesis_rift", true, "ace"),
			"offline solo starts"):
		quit(1)
		return
	for i in range(140): sim.advance()
	if not _check(sim.state["minions"].is_empty(), "solo must never spawn hidden minions"):
		quit(2)
		return
	if not _check(sim.begin("cluster", "phan", "genesis_rift", false, "ace"),
			"3v3 starts"):
		quit(3)
		return
	for i in range(92): sim.advance()
	if not _check(int(sim.state["minion_waves"]["wave"]) == 1,
			"first fair minion wave after 8 seconds"):
		quit(4)
		return
	for team in ["A", "B"]:
		for lane in range(3):
			var types: Array = []
			for u in sim.state["minions"]:
				if u["team"] == team and int(u["lane"]) == lane:
					types.append(u["kind"])
			for kind in ["vanguard", "ranger", "mender"]:
				if not _check(types.has(kind), "missing role: " + team + "/" + kind):
					quit(5)
					return
	var mender: Dictionary = {}
	var wounded: Dictionary = {}
	for minion in sim.state["minions"]:
		if minion["team"] != "A" or int(minion["lane"]) != 0:
			continue
		if minion["kind"] == "mender": mender = minion
		if minion["kind"] == "vanguard": wounded = minion
	if not _check(not mender.is_empty() and not wounded.is_empty(), "allied support roles"):
		quit(6)
		return
	mender["pos"] = wounded["pos"] + Vector2(2, 0)
	wounded["hp"] = 20.0
	mender["last_heal"] = -10000.0
	if not _check(source._heal(sim, mender) and float(wounded["hp"]) > 20.0,
			"native healing targets allied injured minion"):
		quit(7)
		return
	if not _check(float(wounded["shield"]) <= 18.0,
			"healer shield cap"):
		quit(8)
		return
	var siege: Dictionary = sim._new_unit("test-siege", "A", "siege_breaker",
		Vector2(float(sim.state["w"]) - 14.0, float(sim.state["h"]) * 0.5))
	siege["lane"] = 1
	siege["last_attack"] = -10000.0
	var prior: float = float(sim.state["seals"]["B"]["hp"])
	if not _check(not source._seal(sim, siege) and float(sim.state["seals"]["B"]["hp"]) == prior,
			"lane tower protects B seal"):
		quit(9)
		return
	for tower in sim.state["towers"]:
		if tower["team"] == "B" and absf(float(tower["pos"].y) - float(sim.state["h"]) * 0.5) < 10.0:
			tower["alive"] = false
	if not _check(source._seal(sim, siege) and float(sim.state["seals"]["B"]["hp"]) < prior,
			"siege breaker attacks seal only after lane tower destroyed"):
		quit(10)
		return
	# Verify wave scaling even if earlier minions were defeated by opponents.
	for i in range(520): sim.advance()
	if not _check(int(sim.state["minion_waves"]["wave"]) >= 3,
			"third wave includes siege class"):
		quit(11)
		return
	var count := {"A": 0, "B": 0}
	for minion in sim.state["minions"]:
		if minion["alive"]:
			count[minion["team"]] += 1
	if not _check(count["A"] <= 42 and count["B"] <= 42,
			"bounded team sizes prevent low-end Android overload"):
		quit(12)
		return
	if not _check(not sim.state.has("wallet") and not sim.state.has("diamonds"),
			"match minions never access persistent member economy"):
		quit(13)
		return
	print("BUKLOD_NATIVE_MINION_PASS: bilateral 3-lane waves/healer/tower siege/42-cap/no reward authority")
	quit(0)
