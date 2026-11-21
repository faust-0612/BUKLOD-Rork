## Godot-native named villagers; independent two-faction economy/role tests.
extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _check(success: bool, why: String) -> bool:
	if not success: push_error("BUKLOD_NATIVE_VILLAGER_FAIL: " + why)
	return success

func _run() -> void:
	var villagers = load("res://scripts/native_villager_roles.gd")
	var sim = load("res://scripts/arena_simulation.gd").new()
	if not _check(sim.begin("cluster", "phan", "genesis_rift", false, "ace"), "3v3 starts"):
		quit(1)
		return
	for team in ["A", "B"]:
		var people: Array = sim.state["units"].filter(func(u): return u["team"] == team and u["kind"] == "villager")
		if not _check(people.size() == 2, "first two villagers per team"):
			quit(2)
			return
		if not _check(people[0]["villager_role"] == "builder" and people[1]["villager_role"] == "gatherer",
				"role identities assigned"):
			quit(3)
			return
	if not _check(sim.actor("A0")["team"] == "A", "team identity"):
		quit(4)
		return
	if not _check(not sim.action("A0", "worker_defend", Vector2.ZERO, "vB0"),
			"cannot control enemy villager"):
		quit(5)
		return
	if not _check(sim.action("A0", "worker_repair", Vector2.ZERO, "vA0"),
			"can order friendly worker"):
		quit(6)
		return
	if not _check(sim.state["units"][0]["command"] == "repair",
			"native worker receives exact order"):
		quit(7)
		return
	var builder: Dictionary = sim.state["units"][0]
	var node: Dictionary = sim.state["nodes"].front()
	builder["command"] = "mine"
	builder["pos"] = node["pos"]
	builder["job_at"] = -10000.0
	var before_stock: float = float(node["stock"])
	villagers.step(sim, builder)
	if not _check(float(node["stock"]) < before_stock and float(builder["carry"][node["type"]]) > 0.0,
			"mining takes finite real node stock"):
		quit(8)
		return
	var resource: String = str(node["type"])
	var carried: float = float(builder["carry"][resource])
	for other in sim.state["nodes"]:
		if other["side"] == "A": other["stock"] = 0.0
	builder["pos"] = Vector2(20, float(sim.state["h"]) * 0.5)
	var team_a: Dictionary = sim.state["team"]["A"]
	var prior_amount: float = float(team_a[resource])
	villagers.step(sim, builder)
	if not _check(absf(float(team_a[resource]) - prior_amount - carried) < 0.01 and float(builder["carry"][resource]) == 0.0,
			"depot can credit only physically carried match resources"):
		quit(9)
		return
	team_a["wood"] = 2000.0
	team_a["gold"] = 2000.0
	team_a["stone"] = 2000.0
	var recruited: Array = []
	for slot in range(2, 6):
		var worker: Dictionary = sim._new_unit("new-worker-" + str(slot), "A", "villager",
			Vector2(20, float(sim.state["h"]) * 0.5))
		villagers.configure(worker, "A", slot)
		recruited.append(worker)
		sim.state["units"].append(worker)
	if not _check(villagers.next_slot(sim, "A") == -1,
			"six named workers cap enforced"):
		quit(10)
		return
	var guardian: Dictionary = recruited[0]
	var healer: Dictionary = recruited[1]
	var researcher: Dictionary = recruited[2]
	if not _check(guardian["villager_role"] == "guardian" and healer["villager_role"] == "healer" and researcher["villager_role"] == "researcher",
			"all specialist identities distinct"):
		quit(11)
		return
	var teammate: Dictionary = sim.actor("A0")
	teammate["pos"] = healer["pos"] + Vector2(1, 0)
	teammate["hp"] = 40.0
	var gold_before: float = float(team_a["gold"])
	villagers.step(sim, healer)
	if not _check(float(teammate["hp"]) > 40.0 and float(team_a["gold"]) == gold_before - 2.0,
			"healer uses finite team gold, never heals enemies"):
		quit(12)
		return
	researcher["pos"] = Vector2(20, float(sim.state["h"]) * 0.5)
	var gold_research: float = float(team_a["gold"])
	villagers.step(sim, researcher)
	if not _check(int(team_a["tech"]) == 1 and float(team_a["gold"]) == gold_research - 8.0,
			"researcher consumes finite stock and increases match-only tech"):
		quit(13)
		return
	var opponent: Dictionary = sim.actor("B0")
	opponent["pos"] = guardian["pos"] + Vector2(2, 0)
	sim.state["cover"].clear()
	var hp_before: float = float(opponent["hp"])
	villagers.step(sim, guardian)
	if not _check(float(opponent["hp"]) < hp_before,
			"guardian protects own base without friendly fire"):
		quit(14)
		return
	if not _check(not sim.state.has("wallet") and not sim.state.has("diamonds"),
			"no persistent ledger mutation"):
		quit(15)
		return
	print("BUKLOD_NATIVE_VILLAGER_PASS: 2 factions, 12 named roles, bounded recruitment and real tasks")
	quit(0)
