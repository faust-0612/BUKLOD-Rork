## BUKLOD owner Library Arena integration - native Godot headless smoke.
## Run against the exact deterministic Godot practice pack, never the ranked server.
extends SceneTree

const EXPECTED_HEROES := ["jawo","mitch","niel","trudice","vhen","angel","ellusur"]
const EXPECTED_MINIONS := ["infantry","mage","gunner","siege","healer"]

func _initialize() -> void:
	call_deferred("_verify")

func _fail(message: String, code: int) -> void:
	push_error(message)
	quit(code)

func _verify() -> void:
	var script = load("res://scripts/arena_simulation.gd")
	if script == null:
		_fail("Library integration: simulation missing", 10)
		return
	var sim = script.new()
	if not sim.available():
		_fail("Library integration: 13 heroes / 300 drops / Library intake unavailable", 11)
		return
	var intake: Dictionary = sim.config["library"]
	if not intake.get("practiceOnly", false) or intake["heroes"].size() != 7 or \
			intake["minions"].size() != 5 or intake["villagers"].size() != 2:
		_fail("Library integration: incorrect data authority or count", 12)
		return
	for role in EXPECTED_MINIONS:
		if not intake["minions"].has(role):
			_fail("Library minion missing: " + role, 13)
			return
	var library_actors = load("res://scripts/arena_library_actors.gd")
	if library_actors == null:
		_fail("Library actors missing", 14)
		return
	for hero_id in EXPECTED_HEROES:
		if not intake["heroes"].has(hero_id) or not sim.begin("cluster",hero_id,"genesis_rift",false,"ace"):
			_fail("Library hero cannot enter native practice: " + hero_id, 15)
			return
		var named := 0
		var each_team := {"A": 0, "B": 0}
		for unit in sim.state["units"]:
			if unit.has("library_name"):
				named += 1
				each_team[unit["team"]] = int(each_team[unit["team"]]) + 1
		if named != 12 or each_team["A"] != 6 or each_team["B"] != 6:
			_fail("Villager identities missing from Godot match", 16)
			return
		var me: Dictionary = sim.actor("A0")
		var foe: Dictionary = sim.actor("B0")
		me["level"] = 12
		me["mana"] = 1000.0
		me["max_mana"] = 1000.0
		for slot in ["primary", "secondary", "ultimate"]:
			foe["alive"] = true
			foe["hp"] = 1000.0
			foe["max_hp"] = 1000.0
			foe["pos"] = (me["pos"] as Vector2) + Vector2(4, 0)
			me["cooldowns"][slot] = -1000.0
			if not sim.action("A0", slot, Vector2.RIGHT, "B0"):
				_fail("Library skill rejected unexpectedly: " + hero_id + "/" + slot, 17)
				return
		library_actors.advance_villager(sim,
			sim.state["units"].filter(func(u): return u.has("library_job")).front())
		sim.state["time"] = 30.0
		library_actors.advance_waves(sim)
		var minions := 0
		for unit in sim.state["units"]:
			if unit.get("library_minion", false):
				minions += 1
		if minions < 6 or minions > library_actors.MAX_ACTIVE_MINIONS:
			_fail("Library minion spawning broken or unbounded", 18)
			return
		for i in range(30):
			sim.advance()
		if sim.state["status"] not in ["active", "finished", "void"]:
			_fail("Native match entered invalid state", 19)
			return
	print("BUKLOD_GODOT_LIBRARY_SMOKE_PASS: seven hero kits / five minion roles / two village factions / bounded match-only combat")
	quit(0)
