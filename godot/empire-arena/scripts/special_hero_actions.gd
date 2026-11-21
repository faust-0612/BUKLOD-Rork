## Seven additional BUKLOD hero kits executed DIRECTLY by Godot native Arena.
## Skill identities derive from the owner's 13-hero design document.
## Offline practice-only: no Supabase, no BP, no Diamonds, no permanent rewards.
extends RefCounted

const MAX_SHIELD_RATIO := 0.30
const MAX_COVER := 20
const MAX_DEPLOYED := 80

static func _friends(sim: RefCounted, hero: Dictionary, radius: float) -> Array:
	return sim._allies(hero, radius)

static func _target(sim: RefCounted, hero: Dictionary, radius: float) -> Dictionary:
	for e in sim._enemies(hero, radius):
		if str(e.get("kind", "")) == "hero" and not sim._line_blocked(hero["pos"], e["pos"]):
			return e
	return {}

static func _guard(target: Dictionary, strength: float, until: float) -> void:
	var cap: float = float(target["max_hp"]) * MAX_SHIELD_RATIO
	target["shield"] = minf(cap, float(target.get("shield", 0.0)) + strength)
	target["buffs"]["guard"] = {"until": until, "strength": 0.20}

static func _heal(target: Dictionary, amount: float) -> void:
	target["hp"] = minf(float(target["max_hp"]), float(target["hp"]) + amount)

static func _haste(target: Dictionary, until: float) -> void:
	target["buffs"]["haste"] = {"until": until, "strength": 0.20}

static func _mark(target: Dictionary, until: float) -> void:
	target["buffs"]["marked"] = {"until": until, "strength": 0.15}

static func _slow(target: Dictionary, until: float) -> void:
	target["buffs"]["slow"] = {"until": until, "strength": 0.30}

static func _wall(sim: RefCounted, hero: Dictionary, direction: Vector2,
		radius: float, duration: float) -> bool:
	if sim.state["cover"].size() >= MAX_COVER:
		return false
	var at: Vector2 = hero["pos"] + direction.normalized() * 4.0
	if sim._blocked(at, radius):
		return false
	sim.state["cover"].append({"pos": at, "radius": radius,
		"expires": float(sim.state["time"]) + duration})
	sim._log("hero_terrain_created", {"actor": hero["id"], "pos": at,
		"expires": float(sim.state["time"]) + duration})
	return true

static func cast(sim: RefCounted, hero: Dictionary, identity: String,
		direction: Vector2) -> bool:
	var now: float = float(sim.state["time"])
	var friends: Array = _friends(sim, hero, 13.0)
	var enemy: Dictionary = _target(sim, hero, 11.0)
	var accepted := false
	match identity:
		# ELESUR — Beacon Shepherd: ally navigation, sustain and protective beacon
		"guiding_path":
			for ally in friends:
				if sim._dist(hero, ally) <= 9.0:
					_haste(ally, now + 5.0)
					accepted = true
		"seed_sanctuary":
			for ally in friends:
				if sim._dist(hero, ally) <= 7.0:
					_heal(ally, 22.0)
					ally["buffs"].erase("slow")
					accepted = true
		"beacon_of_service":
			for ally in friends:
				_guard(ally, 34.0, now + 8.0)
				accepted = true
		# JAWO — Verdant Bard: directional nature strike, flank and wave
		"vine_riff":
			if not enemy.is_empty() and sim._dist(hero, enemy) <= 5.0:
				accepted = sim._hit(hero, enemy, 25.0)
				if accepted: _slow(enemy, now + 1.8)
		"echo_skip":
			accepted = sim._move(hero, direction, 48.0)
			if accepted:
				for e in sim._enemies(hero, 3.0):
					if str(e.get("kind", "")) == "hero": _slow(e, now + 1.4)
		"canopy_crescendo":
			for e in sim._enemies(hero, 8.0):
				if sim._line_blocked(hero["pos"], e["pos"]):
					continue
				if sim._hit(hero, e, 41.0):
					accepted = true
					if str(e.get("kind", "")) == "hero":
						_slow(e, now + 2.0)
						sim._move(e, e["pos"] - hero["pos"], 12.0)
		# MITCH — Mural Weaver: marks, destructible route obstruction, zone control
		"pigment_bolt":
			if not enemy.is_empty():
				accepted = sim._hit(hero, enemy, 22.0)
				if accepted: _mark(enemy, now + 5.0)
		"mosaic_wall":
			accepted = _wall(sim, hero, direction, 1.9, 5.0)
		"living_canvas":
			for e in sim._enemies(hero, 8.0):
				if str(e.get("kind", "")) == "hero" and not sim._line_blocked(hero["pos"], e["pos"]):
					_slow(e, now + 4.0)
					accepted = true
			if _wall(sim, hero, direction, 1.7, 5.0):
				accepted = true
		# NIEL — Dawn Herald: directional thrust, tactical dash and cleansing push
		"echo_lance":
			if not enemy.is_empty():
				accepted = sim._hit(hero, enemy, 32.0)
				if accepted: _mark(enemy, now + 4.0)
		"conviction_dash":
			accepted = sim._move(hero, direction, 50.0)
			if accepted:
				for ally in _friends(sim, hero, 5.0): _guard(ally, 9.0, now + 3.0)
		"call_of_the_dawn":
			for ally in friends:
				ally["buffs"].erase("slow")
				_guard(ally, 20.0, now + 6.0)
				accepted = true
			for e in sim._enemies(hero, 7.0):
				if str(e.get("kind", "")) != "hero" or sim._line_blocked(hero["pos"], e["pos"]):
					continue
				_slow(e, now + 2.0)
				sim._move(e, e["pos"] - hero["pos"], 8.0)
		# ANGEL — Ledger Sentinel: shield redistribution, NEVER mints BP/currency
		"ledger_shield":
			var receiver: Dictionary = {}
			for ally in friends:
				if ally["id"] == hero["id"]: continue
				if receiver.is_empty() or float(ally["shield"]) < float(receiver["shield"]):
					receiver = ally
			var grant: float = minf(24.0, float(hero.get("shield", 0.0)))
			if not receiver.is_empty() and grant > 0.0:
				var free: float = maxf(0.0, float(receiver["max_hp"]) * MAX_SHIELD_RATIO - float(receiver["shield"]))
				grant = minf(grant, free)
				if grant > 0.0:
					hero["shield"] = float(hero["shield"]) - grant
					receiver["shield"] = float(receiver["shield"]) + grant
					accepted = true
		"balance_field":
			for ally in friends:
				_guard(ally, 14.0, now + 4.0)
				accepted = true
		"equal_measure":
			var total: float = 0.0
			for ally in friends: total += float(ally["shield"])
			if friends.size() > 1 and total > 0.0:
				# Conservation of existing shields; no generated protection.
				var remaining: float = total
				for index in range(friends.size()):
					var ally: Dictionary = friends[index]
					var cap: float = float(ally["max_hp"]) * MAX_SHIELD_RATIO
					var share: float = minf(cap, remaining / float(friends.size() - index))
					ally["shield"] = share
					remaining -= share
				# Any amount that cannot fit into capped shields is dissipated.
				accepted = true
		# VHEN — Grove Mechanist: durable device, irrigation and harvested cover
		"seed_turret":
			var active: int = 0
			for unit in sim.state["units"]:
				if unit.get("owner") == hero["id"] and unit.get("kind") == "seed_turret" and unit.get("alive", false):
					active += 1
			if active == 0 and sim.state["units"].size() < MAX_DEPLOYED:
				var at: Vector2 = hero["pos"] + direction.normalized() * 3.0
				if not sim._blocked(at, 1.0):
					var summoned: Dictionary = sim._new_unit("seed" + str(sim.state["next_id"]),
						str(hero["team"]), "seed_turret", at)
					summoned["owner"] = hero["id"]
					summoned["expires"] = now + 10.0
					summoned["hp"] = 55.0
					summoned["max_hp"] = 55.0
					sim.state["units"].append(summoned)
					sim._log("hero_deployable", {"actor": hero["id"], "pos": at})
					accepted = true
		"irrigation_snare":
			for e in sim._enemies(hero, 7.0):
				if str(e.get("kind", "")) == "hero" and not sim._line_blocked(hero["pos"], e["pos"]):
					_slow(e, now + 4.0)
					accepted = true
		"harvest_engine":
			accepted = _wall(sim, hero, direction, 2.2, 7.0)
			if accepted:
				for ally in _friends(sim, hero, 8.0):
					_heal(ally, 21.0)
					_guard(ally, 14.0, now + 5.0)
		# TRUDICE — Story Strategist: counterplay and tactical protection
		"question_sigil":
			if not enemy.is_empty():
				accepted = sim._hit(hero, enemy, 17.0)
				if accepted: _slow(enemy, now + 1.5)
		"turning_page":
			var wounded: Dictionary = {}
			for ally in friends:
				if wounded.is_empty() or float(ally["hp"]) / float(ally["max_hp"]) < float(wounded["hp"]) / float(wounded["max_hp"]):
					wounded = ally
			if not wounded.is_empty():
				_guard(wounded, 38.0, now + 4.0)
				accepted = true
		"grand_lesson":
			for ally in friends:
				_guard(ally, 18.0, now + 7.0)
				accepted = true
			for e in sim._enemies(hero, 10.0):
				if str(e.get("kind", "")) == "hero" and not sim._line_blocked(hero["pos"], e["pos"]):
					_mark(e, now + 5.0)
		_:
			return false
	if accepted:
		sim._log("unique_hero_action", {"actor": hero["id"], "hero": hero["hero"],
			"skill_id": identity, "pos": hero["pos"]})
	return accepted
