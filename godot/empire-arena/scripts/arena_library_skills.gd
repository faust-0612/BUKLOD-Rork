## Owner Library hero abilities, normalized for the embedded OFFLINE Arena.
## Called ONLY by BuklodArenaSimulation after its authoritative match-only
## cooldown, mana, unlock and alive checks. No network or reward access.
extends RefCounted

const MAX_TEMP_TOWERS := 3

static func _now(sim) -> float:
	return float(sim.state["time"])

static func _buff(p: Dictionary, key: String, value: float, until: float) -> void:
	var previous: Dictionary = p["buffs"].get(key, {})
	p["buffs"][key] = {
		"strength": maxf(value, float(previous.get("strength", 0.0))) if float(previous.get("until", 0)) > until - 1.0 else value,
		"until": maxf(until, float(previous.get("until", 0.0)))
	}

static func _control_resist(sim, target: Dictionary) -> float:
	# Niel's Shared Resolve aura lowers control duration for nearby allies.
	for ally in sim.state["players"].values():
		if ally.get("hero", "") == "niel" and ally["team"] == target["team"] \
				and sim._alive(ally) and sim._dist(ally, target) <= 8.75:
			return 0.20
	return 0.0

static func _hit_nearest(sim, p: Dictionary, distance: float, damage: float,
		slow: float = 0.0) -> bool:
	var enemies: Array = sim._enemies(p, distance)
	if enemies.is_empty():
		return false
	var target: Dictionary = enemies.front()
	if not sim._hit(p, target, damage):
		return false
	if slow > 0:
		_buff(target, "slow", clampf(slow, 0.0, 0.45), _now(sim) + 3.0)
	return true

static func _area_hit(sim, p: Dictionary, distance: float, damage: float,
		slow: float = 0.0) -> bool:
	var hit_any := false
	for target in sim._enemies(p, distance):
		if sim._hit(p, target, damage):
			hit_any = true
			if slow > 0:
				_buff(target, "slow", clampf(slow, 0.0, 0.45), _now(sim) + 3.0)
	return hit_any

static func _ally_buff(sim, p: Dictionary, distance: float,
		key: String, value: float, seconds: float) -> void:
	for ally in sim._allies(p, distance):
		_buff(ally, key, value, _now(sim) + seconds)

static func _heal_allies(sim, p: Dictionary, distance: float,
		amount: float, shield: float = 0.0) -> void:
	for ally in sim._allies(p, distance):
		ally["hp"] = minf(float(ally["max_hp"]), float(ally["hp"]) + amount)
		if shield > 0:
			ally["shield"] = minf(105.0, float(ally["shield"]) + shield)

static func _wall(sim, p: Dictionary, direction: Vector2) -> bool:
	if sim.state["cover"].size() >= 20:
		return false
	var at: Vector2 = p["pos"] + direction * 4.0
	if sim._blocked(at, 2.4):
		return false
	sim.state["cover"].append({"pos": at, "radius": 2.2,
		"expires": _now(sim) + 5.0})
	sim._log("library_wall", {"actor": p["id"], "pos": at})
	return true

static func _turret(sim, p: Dictionary,
		direction: Vector2, hp: float, seconds: float, power: float) -> bool:
	var count := 0
	for tower in sim.state["towers"]:
		if tower.get("temporary", false) and tower["team"] == p["team"] and sim._alive(tower):
			count += 1
	if count >= MAX_TEMP_TOWERS:
		return false
	var at: Vector2 = p["pos"] + direction * 3.0
	if sim._blocked(at, 1.6):
		return false
	var id := "lib_tower_" + str(sim.state["next_id"])
	sim.state["next_id"] = int(sim.state["next_id"]) + 1
	var durability := hp * (1.35 if p["hero"] == "vhen" else 1.0)
	sim.state["towers"].append({"id": id, "team": p["team"], "kind": "tower",
		"pos": at, "hp": durability, "max_hp": durability, "level": 1,
		"temporary": true, "expires": _now(sim) + seconds,
		"damage": power, "alive": true, "last_attack": -10000.0})
	sim._log("library_turret", {"actor": p["id"], "pos": at})
	return true

static func cast(sim, p: Dictionary,
		identity: String, aim: Vector2) -> bool:
	var direction := aim.normalized() if aim.length_squared() > 0.0025 else Vector2.RIGHT
	match identity:
		"vine_riff":
			return _area_hit(sim, p, 7.5, 42.0, 0.30)
		"echo_skip":
			var moved := sim._move(p, direction, 55.0)
			if moved:
				_area_hit(sim, p, 3.5, 22.0, 0.35)
			return moved
		"canopy_crescendo":
			_area_hit(sim, p, 9.5, 48.0, 0.35)
			_ally_buff(sim, p, 9.5, "haste", 0.12, 5.0)
			_ally_buff(sim, p, 9.5, "fury", 0.15, 5.0)
			return true
		"pigment_bolt":
			var done := _hit_nearest(sim, p, 13.0, 49.0)
			if done:
				var target: Dictionary = sim._enemies(p, 13.0).front() if not sim._enemies(p, 13.0).is_empty() else {}
				if not target.is_empty():
					_buff(target, "weaken", 0.15, _now(sim) + 3.0)
			return done
		"mosaic_wall":
			return _wall(sim, p, direction)
		"living_canvas":
			_heal_allies(sim, p, 9.5, 42.0)
			_ally_buff(sim, p, 9.5, "guard", 0.10, 8.0)
			_ally_buff(sim, p, 9.5, "regen", 4.0, 8.0)
			for target in sim._enemies(p, 9.5):
				_buff(target, "slow", 0.30, _now(sim) + 6.0)
			return true
		"echo_lance":
			return _hit_nearest(sim, p, 12.0, 50.0)
		"conviction_dash":
			var dashed := sim._move(p, direction, 55.0)
			if dashed:
				_area_hit(sim, p, 3.25, 46.0)
				_buff(p, "guard", 0.25, _now(sim) + 3.0)
			return dashed
		"call_of_the_dawn":
			_area_hit(sim, p, 14.0, 49.0)
			for ally in sim._allies(p, 10.0):
				ally["buffs"].erase("slow")
				ally["buffs"].erase("stun")
			return true
		"question_sigil":
			var struck := _hit_nearest(sim, p, 11.0, 18.0)
			if struck:
				var targets: Array = sim._enemies(p, 11.0)
				if not targets.is_empty():
					_buff(targets.front(), "stun", 1.0,
						_now(sim) + 1.0 * (1.0 - _control_resist(sim, targets.front())))
			return struck
		"turning_page":
			_buff(p, "guard", 0.40, _now(sim) + 3.0)
			_buff(p, "reflect", 0.30, _now(sim) + 3.0)
			return true
		"grand_lesson":
			for ally in sim._allies(p, 11.0):
				_buff(ally, "guard", 0.10, _now(sim) + 8.0)
				_buff(ally, "cooldown", 0.20, _now(sim) + 8.0)
			for target in sim._enemies(p, 11.0):
				_buff(target, "weaken", 0.15, _now(sim) + 8.0)
			return true
		"seed_turret":
			return _turret(sim, p, direction, 55.0, 8.0, 11.0)
		"irrigation_snare":
			for target in sim._enemies(p, 6.0):
				_buff(target, "slow", 0.40, _now(sim) + 6.0)
			return true
		"harvest_engine":
			if not _turret(sim, p, direction, 150.0, 10.0, 16.0):
				return false
			_ally_buff(sim, p, 9.0, "guard", 0.20, 8.0)
			for target in sim._enemies(p, 9.0):
				_buff(target, "slow", 0.35, _now(sim) + 8.0)
			return true
		"ledger_shield":
			for ally in sim._allies(p, 10.5):
				ally["shield"] = minf(105.0, float(ally["shield"]) +
					float(ally["max_hp"]) * 0.25 * 1.25)
			return true
		"balance_field":
			_ally_buff(sim, p, 6.5, "guard", 0.15, 5.0)
			return true
		"equal_measure":
			for ally in sim._allies(p, 15.0):
				var missing := 1.0 - float(ally["hp"]) / maxf(1.0, float(ally["max_hp"]))
				ally["shield"] = minf(105.0, float(ally["shield"]) +
					float(ally["max_hp"]) * (0.10 + missing * 0.16))
				_buff(ally, "guard", 0.20, _now(sim) + 8.0)
			return true
		"guiding_path":
			_ally_buff(sim, p, 9.5, "haste", 0.30, 4.0)
			return true
		"seed_sanctuary":
			_heal_allies(sim, p, 5.5, 34.0)
			_ally_buff(sim, p, 5.5, "regen", 3.0, 6.0)
			for ally in sim._allies(p, 5.5):
				ally["buffs"].erase("slow")
			return true
		"beacon_of_service":
			_heal_allies(sim, p, 10.5, 54.0, 25.0)
			_ally_buff(sim, p, 10.5, "haste", 0.25, 8.0)
			_ally_buff(sim, p, 10.5, "guard", 0.15, 8.0)
			_ally_buff(sim, p, 10.5, "regen", 3.5, 8.0)
			return true
	return false
