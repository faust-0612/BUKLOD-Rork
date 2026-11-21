## Engine-executed seven-special hero smoke, owner 13-hero identity and anti-tunneling.
## This is offline practice; does not simulate real ranked networking or user data.
extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _check(good: bool, message: String) -> bool:
	if not good:
		push_error("BUKLOD_NATIVE_HERO_SMOKE_FAIL: " + message)
	return good

func _run() -> void:
	var catalog = load("res://scripts/hero_identity.gd").new()
	if not _check(catalog.available(), "original six plus owner-approved seven required"):
		quit(1)
		return
	var design_ids: Array = catalog.approved.keys()
	if not _check(design_ids.size() == 13, "all 13 approved identities present"):
		quit(2)
		return
	for hero in ["phan", "quin", "van", "christian", "lhen", "ace"]:
		for slot in ["primary", "secondary", "ultimate"]:
			var entry: Dictionary = catalog.skill(hero, slot)
			if not _check(entry.has("id") and int(entry.get("cd", 0)) >= 7000,
					"original .gd script active: " + hero + "/" + slot):
				quit(3)
				return
	for hero in catalog.EXTRA_HEROES:
		for slot in ["primary", "secondary", "ultimate"]:
			var entry: Dictionary = catalog.skill(hero, slot)
			if not _check(not entry.is_empty() and int(entry["cd"]) > 0,
					"missing distinct special hero identity: " + hero + "/" + slot):
				quit(4)
				return
			var sim = load("res://scripts/arena_simulation.gd").new()
			if not _check(sim.begin("cluster", hero, "genesis_rift", false,
					"ace", "normal", 1108), "native 3v3 with " + hero):
				quit(5)
				return
			var owner: Dictionary = sim.actor("A0")
			var opponent: Dictionary = sim.actor("B0")
			var anchor: Vector2 = Vector2(float(sim.state["w"]) * 0.5,
				float(sim.state["h"]) * 0.5)
			sim.state["cover"].clear()
			owner["pos"] = anchor
			opponent["pos"] = anchor + Vector2(3.0, 0.0)
			owner["shield"] = 85.0
			owner["mana"] = 200.0
			owner["max_mana"] = 200.0
			# Team support cases use a live ally within range.
			var ally: Dictionary = sim.actor("A1")
			ally["pos"] = anchor + Vector2(2.0, 2.0)
			ally["hp"] = 60.0
			ally["shield"] = 0.0
			sim.advance()
			if not _check(sim.action("A0", slot, Vector2.RIGHT, "B0"),
					"native special action must execute: " + hero + "/" + slot):
				quit(6)
				return
			if not _check(not sim.action("A0", slot, Vector2.RIGHT, "B0"),
					"same-tick replay must be denied by cooldown: " + hero + "/" + slot):
				quit(7)
				return
			if hero == "angel" and slot == "ultimate":
				var total: float = 0.0
				for id in ["A0", "A1", "A2"]:
					total += float(sim.actor(id)["shield"])
				if not _check(total <= 85.01, "Equal Measure must redistribute not mint shields"):
					quit(8)
					return
	var wall_sim = load("res://scripts/arena_simulation.gd").new()
	if not _check(wall_sim.begin("duel", "quin", "genesis_rift", true, "ace"),
			"native duel start"):
		quit(9)
		return
	var attacker: Dictionary = wall_sim.actor("A0")
	var target: Dictionary = wall_sim.actor("B0")
	var safe: Vector2 = Vector2(45, float(wall_sim.state["h"]) * 0.5)
	attacker["pos"] = safe
	target["pos"] = safe + Vector2(4, 0)
	wall_sim.state["cover"].clear()
	wall_sim.state["cover"].append({"pos": safe + Vector2(2, 0), "radius": 1.4})
	if not _check(not wall_sim.action("A0", "attack", Vector2.RIGHT, "B0"),
			"no basic attack through solid map cover"):
		quit(10)
		return
	if not _check(not wall_sim.action("A0", "secondary", Vector2.RIGHT, "B0"),
			"no mark through solid cover"):
		quit(11)
		return
	print("BUKLOD_NATIVE_13_HERO_PASS: original .gd 6 + distinct special 7 + cooldown/LOS/shield conservation")
	quit(0)
