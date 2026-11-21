## BUKLOD Empire Arena — native Godot match-only simulation.
## Matches the active JavaScript practice contract where possible; it NEVER
## makes Supabase/HTTP calls or creates BP, QMP, Diamonds or ranked receipts.
class_name BuklodArenaSimulation
extends RefCounted

const STEP := 0.1
const PICKUP_CAP := 24
const PICKUP_LIFETIME := 45.0
const HERO_CAP := 15
const MAX_EVENTS := 100
const MAX_RELICS := 36

var config: Dictionary = {}
var state: Dictionary = {}
var rng := RandomNumberGenerator.new()

func _init() -> void:
	var path := "res://data/catalog.json"
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("BUKLOD Arena catalog is missing; pack is not playable")
		return
	var value: Variant = JSON.parse_string(file.get_as_text())
	if typeof(value) != TYPE_DICTIONARY:
		push_error("BUKLOD Arena canonical catalog invalid")
		return
	config = value

func available() -> bool:
	return config.has("heroes") and config.has("maps") and config.has("pickups") \
		and config["heroes"].size() == 13 and config["pickups"].size() == 300

func begin(mode: String = "cluster", hero: String = "phan",
		map_id: String = "genesis_rift", solo: bool = false,
		foe: String = "ace", difficulty: String = "normal", seed: int = 20261122) -> bool:
	if not available() or not config["modes"].has(mode) or not config["maps"].has(map_id):
		return false
	if not config["heroes"].has(hero) or not config["heroes"].has(foe):
		return false
	if not ["easy", "normal", "hard"].has(difficulty):
		return false
	rng.seed = seed
	var size: Dictionary = config["modes"][mode]
	var w: float = float(size["width"])
	var h: float = float(size["height"])
	var count: int = int(size["n"])
	var map: Dictionary = config["maps"][map_id]
	var world_cover: Array = []
	for entry in map["cover"]:
		world_cover.append({"pos": Vector2(float(entry[0]) * w, float(entry[1]) * h),
			"radius": float(entry[2]) * minf(w, h)})
	state = {
		"mode": mode, "solo": solo, "difficulty": difficulty, "map": map_id,
		"w": w, "h": h, "time": 0.0, "tick": 0, "phase": "expansion",
		"status": "active", "winner": "", "events": [], "next_id": 1,
		"team": {
			"A": {"wood": 150.0, "gold": 100.0, "stone": 110.0, "queue": [], "kills": 0},
			"B": {"wood": 150.0, "gold": 100.0, "stone": 110.0, "queue": [], "kills": 0}
		}, "players": {}, "units": [], "towers": [], "nodes": [],
		"loot": [], "buildings": [], "cover": world_cover, "effects": [],
		"seals": {
			"A": {"hp": 1050.0, "breached": false, "rebuilds": 0},
			"B": {"hp": 1050.0, "breached": false, "rebuilds": 0}
		},
		"hunt_started": -1.0, "hard_lock": false,
		"hard_deadline": float(size["minutes"]) * 60.0,
		"solo_round": 1, "solo_wins": {"A": 0, "B": 0},
		"solo_draws": 0, "solo_round_start": 0.0, "solo_intermission": 0.0
	}
	var roster: Array = config["heroes"].keys()
	for team in ["A", "B"]:
		for i in range(count):
			var id: String = str(team) + str(i)
			var char: String = hero if team == "A" and i == 0 else foe if solo and team == "B" else str(roster[(i + (4 if team == "A" else 8)) % roster.size()])
			var spawn := Vector2(17.0 if team == "A" else w - 17.0,
				h * 0.5 + (float(i) - float(count - 1) * 0.5) * 5.0)
			if solo:
				spawn = Vector2(w * 0.5 + (-11.0 if team == "A" else 11.0), h * 0.5)
			state["players"][id] = {
				"id": id, "team": team, "kind": "hero", "hero": char,
				"pos": spawn, "spawn": spawn, "hp": 180.0 if solo else 135.0,
				"max_hp": 180.0 if solo else 135.0, "mana": 120.0 if solo else 100.0,
				"max_mana": 120.0 if solo else 100.0, "shield": 0.0,
				"alive": true, "level": 6 if solo else 1, "xp": 0.0,
				"kills": 0, "deaths": 0, "hits": 0, "bag": {"wood": 0.0, "gold": 0.0, "stone": 0.0},
				"cooldowns": {"attack": -100000.0, "primary": -100000.0,
					"secondary": -100000.0, "ultimate": -100000.0},
				"buffs": {}, "respawn_at": 0.0, "bot_at": 0.0, "last_move_tick": -1
			}
	if not solo:
		for team in ["A", "B"]:
			var base_x: float = 14.0 if team == "A" else w - 14.0
			for lane in range(3):
				var y: float = h * float(map["lanes"][lane])
				state["towers"].append({"id": team + "-tower-" + str(lane),
					"team": team, "kind": "tower", "pos": Vector2(35.0 if team == "A" else w - 35.0, y),
					"hp": 340.0, "max_hp": 340.0, "level": 1, "alive": true, "last_attack": -100000.0})
			for definition in ["barracks", "depot"]:
				state["buildings"].append({"id": team + "-" + definition,
					"team": team, "kind": definition,
					"pos": Vector2(base_x + (6.0 if team == "A" else -6.0),
						h * 0.5 + (-8.0 if definition == "barracks" else 8.0)),
					"hp": float(config["buildings"][definition]["hp"]),
					"alive": true, "progress": 1.0, "status": "operational"})
			for i in range(2):
				state["units"].append(_new_unit("v" + team + str(i), team, "villager",
					Vector2(21.0 if team == "A" else w - 21.0, h * 0.5 + (6.0 if i else -6.0))))
		for site in ["A", "B", "CENTER"]:
			for i in range(3):
				var type: String = ["wood", "gold", "stone"][i]
				state["nodes"].append({"id": "mine" + str(state["nodes"].size()),
					"type": type, "side": site,
					"pos": Vector2(w * (0.24 if site == "A" else 0.76 if site == "B" else 0.5),
						h * float(map["lanes"][i])),
					"stock": 600.0 * float(map["mineBias"][type]), "capacity": 600.0 * float(map["mineBias"][type])})
	_log("match_start", {"mode": mode, "map": map_id, "solo": solo})
	return true

func _new_unit(id: String, team: String, kind: String, pos: Vector2) -> Dictionary:
	var cost: Dictionary = config["costs"].get(kind, {})
	var hp: float = float(cost.get("hp", 72))
	return {"id": id, "team": team, "kind": kind, "pos": pos, "hp": hp,
		"max_hp": hp, "alive": true, "last_attack": -10000.0,
		"carry": {"wood": 0.0, "gold": 0.0, "stone": 0.0},
		"command": "mine" if kind == "villager" else "push", "target": -1}

func _log(kind: String, extra: Dictionary = {}) -> void:
	var events: Array = state["events"]
	var event: Dictionary = {"id": int(state["next_id"]), "time": float(state["time"]), "type": kind}
	state["next_id"] = int(state["next_id"]) + 1
	event.merge(extra, true)
	events.append(event)
	if events.size() > MAX_EVENTS:
		events.pop_front()

func _dist(a: Dictionary, b: Dictionary) -> float:
	return (a["pos"] as Vector2).distance_to(b["pos"] as Vector2)

func _other(team: String) -> String:
	return "B" if team == "A" else "A"

func actor(id: String) -> Dictionary:
	if state.is_empty():
		return {}
	if state["players"].has(id):
		return state["players"][id]
	for category in ["units", "towers", "buildings"]:
		for thing in state[category]:
			if thing["id"] == id:
				return thing
	return {}

func _alive(a: Dictionary) -> bool:
	return not a.is_empty() and a.get("alive", false) and float(a.get("hp", 0.0)) > 0.0

func _allies(p: Dictionary, r: float) -> Array:
	var output: Array = []
	for a in state["players"].values():
		if _alive(a) and a["team"] == p["team"] and _dist(a, p) <= r:
			output.append(a)
	return output

func _enemies(p: Dictionary, r: float) -> Array:
	var output: Array = []
	for a in state["players"].values():
		if _alive(a) and a["team"] != p["team"] and _dist(a, p) <= r:
			output.append(a)
	for category in ["units", "towers"]:
		for a in state[category]:
			if _alive(a) and a["team"] != p["team"] and _dist(a, p) <= r:
				output.append(a)
	output.sort_custom(func(a, b): return _dist(a, p) < _dist(b, p))
	return output

func _blocked(pos: Vector2, radius: float = 1.0) -> bool:
	if pos.x < 2 or pos.y < 2 or pos.x > state["w"] - 2 or pos.y > state["h"] - 2:
		return true
	for c in state["cover"]:
		if (c["pos"] as Vector2).distance_to(pos) < float(c["radius"]) + radius:
			return true
	return false

func _move(a: Dictionary, delta: Vector2, speed: float) -> bool:
	if not _alive(a) or delta.length_squared() < 0.0025:
		return false
	var direction := delta.normalized()
	var distance := speed * STEP
	# Sweep through the terrain; blink and dash cannot bypass world collision.
	var slices: int = maxi(1, ceili(distance / 0.35))
	var pos: Vector2 = a["pos"]
	for i in range(slices):
		var proposed: Vector2 = pos + direction * (distance / float(slices))
		if _blocked(proposed):
			break
		pos = proposed
	if pos == a["pos"]:
		return false
	a["pos"] = pos
	return true

func _xp(a: Dictionary, amount: float) -> void:
	if a.get("kind") != "hero" or not _alive(a):
		return
	a["xp"] = float(a["xp"]) + amount
	while int(a["level"]) < HERO_CAP:
		var threshold: float = 65.0 * float(a["level"]) + 18.0 * pow(float(a["level"]), 2)
		if float(a["xp"]) < threshold:
			break
		a["xp"] = float(a["xp"]) - threshold
		a["level"] = int(a["level"]) + 1
		a["max_hp"] = float(a["max_hp"]) + 8.0
		a["hp"] = minf(float(a["max_hp"]), float(a["hp"]) + 22.0)
		a["max_mana"] = float(a["max_mana"]) + 3.0
		a["mana"] = minf(float(a["max_mana"]), float(a["mana"]) + 12.0)
		_log("level_up", {"actor": a["id"], "level": a["level"], "pos": a["pos"]})

func _hit(p: Dictionary, target: Dictionary, damage: float) -> bool:
	if not _alive(p) or not _alive(target) or p["team"] == target["team"]:
		return false
	var absorbed: float = minf(float(target.get("shield", 0.0)), damage)
	target["shield"] = maxf(0.0, float(target.get("shield", 0.0)) - absorbed)
	var actual: float = maxf(0.0, damage - absorbed)
	target["hp"] = maxf(0.0, float(target["hp"]) - actual)
	p["hits"] = int(p.get("hits", 0)) + 1
	_log("damage", {"from": p["id"], "to": target["id"], "amount": actual, "pos": target["pos"]})
	if float(target["hp"]) > 0.0:
		return true
	target["alive"] = false
	_log("defeat", {"from": p["id"], "to": target["id"], "pos": target["pos"]})
	if target["kind"] == "hero":
		target["deaths"] = int(target["deaths"]) + 1
		target["respawn_at"] = float(state["time"]) + 7.5
		if p.get("kind") == "hero":
			p["kills"] = int(p["kills"]) + 1
			_xp(p, 90)
			_try_drop(p, target, "hero")
	elif target["kind"] == "tower":
		_xp(p, 65)
		_try_drop(p, target, "tower")
	elif target["kind"] != "hero":
		_xp(p, 16)
		_try_drop(p, target, "unit")
	return true

func _try_drop(killer: Dictionary, loser: Dictionary, source: String) -> void:
	if killer.get("kind") != "hero" or state["loot"].size() >= MAX_RELICS:
		return
	if state["loot"].filter(func(x): return x.get("kind") == "field_pickup").size() >= PICKUP_CAP:
		return
	var chance: float = {"hero": 0.43, "tower": 0.65, "unit": 0.17, "boss": 0.92}.get(source, 0.2)
	if rng.randf() > chance:
		return
	var max_tier: int = 3 if int(killer["level"]) >= 9 else 2 if int(killer["level"]) >= 4 else 1
	var tier: int = 3 if max_tier == 3 and rng.randf() < 0.15 else 2 if max_tier >= 2 and rng.randf() < 0.47 else 1
	var exclusive: bool = rng.randf() < 0.44
	var eligible: Array = config["pickups"].filter(func(x):
		return int(x["tier"]) == tier and ((x["hero"] == killer["hero"]) if exclusive else x["hero"] == null))
	if eligible.is_empty():
		return
	var definition: Dictionary = eligible[rng.randi_range(0, eligible.size() - 1)]
	state["loot"].append({"id": "drop" + str(state["next_id"]), "kind": "field_pickup",
		"item_id": definition["id"], "hero": definition["hero"],
		"pos": loser["pos"], "expires": float(state["time"]) + PICKUP_LIFETIME})
	_log("field_pickup_drop", {"item_id": definition["id"], "pos": loser["pos"]})

func _get_pickup(id: String) -> Dictionary:
	for item in config["pickups"]:
		if item["id"] == id:
			return item
	return {}

func _loot(p: Dictionary) -> bool:
	for drop in state["loot"]:
		if (drop["pos"] as Vector2).distance_to(p["pos"] as Vector2) > 3.0:
			continue
		if float(drop["expires"]) <= float(state["time"]):
			continue
		var item := _get_pickup(str(drop["item_id"]))
		if item.is_empty() or (item["hero"] != null and item["hero"] != p["hero"]):
			continue
		var effect: String = item["effect"]
		var value: float = float(item["value"])
		var accepted := true
		match effect:
			"health":
				accepted = float(p["hp"]) < float(p["max_hp"])
				p["hp"] = minf(float(p["max_hp"]), float(p["hp"]) + value)
			"mana":
				accepted = float(p["mana"]) < float(p["max_mana"])
				p["mana"] = minf(float(p["max_mana"]), float(p["mana"]) + value)
			"shield":
				accepted = float(p["shield"]) < 105.0
				p["shield"] = minf(105.0, float(p["shield"]) + value)
			"xp":
				accepted = int(p["level"]) < HERO_CAP
				if accepted: _xp(p, roundf(value))
			"wood", "gold", "stone":
				var team: Dictionary = state["team"][p["team"]]
				accepted = float(team[effect]) < 10000.0
				team[effect] = minf(10000.0, float(team[effect]) + roundf(value))
			"haste", "fury", "guard", "regen":
				p["buffs"][effect] = {"until": minf(float(state["time"]) + 60.0,
					maxf(float(state["time"]), float(p["buffs"].get(effect, {}).get("until", 0.0))) +
					float(item["durationMs"]) / 1000.0), "strength": value}
			"cooldown":
				accepted = false
				for key in ["primary", "secondary", "ultimate"]:
					if float(state["time"]) - float(p["cooldowns"][key]) < 90.0:
						p["cooldowns"][key] = float(p["cooldowns"][key]) - value / 1000.0
						accepted = true
			_:
				accepted = false
		if not accepted:
			return false
		state["loot"].erase(drop)
		_log("field_pickup_claimed", {"actor": p["id"], "item_id": item["id"], "effect": effect,
			"amount": value, "pos": p["pos"]})
		return true
	return false

func _skill(p: Dictionary, slot: String, direction: Vector2) -> bool:
	if not ["primary", "secondary", "ultimate"].has(slot):
		return false
	if slot == "secondary" and int(p["level"]) < 3:
		return false
	if slot == "ultimate" and int(p["level"]) < 6:
		return false
	var skill: Dictionary = config["starter"].get(p["hero"], {}).get(slot, {})
	var cooldown: float = float(skill.get("cd", {"primary": 5800, "secondary": 11000, "ultimate": 38000}[slot])) / 1000.0
	var mana_cost: float = {"primary": 18.0, "secondary": 14.0, "ultimate": 55.0}[slot]
	if float(state["time"]) - float(p["cooldowns"][slot]) < cooldown or float(p["mana"]) < mana_cost:
		return false
	var style: String = str(config["heroes"][p["hero"]]["style"])
	var identity: String = str(skill.get("id", style + "_" + slot))
	var enemies := _enemies(p, 12.0)
	var target: Dictionary = enemies.front() if not enemies.is_empty() else {}
	var accepted := false
	match identity:
		"foundation_wall":
			if state["cover"].size() < 20:
				var center: Vector2 = p["pos"] + direction.normalized() * 4.0
				if not _blocked(center, 2.4):
					state["cover"].append({"pos": center, "radius": 2.2,
						"expires": float(state["time"]) + 5.0})
					_log("kit_wall_built", {"actor": p["id"], "pos": center})
					accepted = true
		"route_dash", "banner_rush", "intercept_rush", "knight_step":
			accepted = _move(p, direction, 50.0 if slot != "ultimate" else 80.0)
			if accepted and identity == "banner_rush":
				for enemy in _enemies(p, 3.3): _hit(p, enemy, 28.0)
		"groundbreaker", "resonance_wave":
			for enemy in _enemies(p, 6.0):
				if _hit(p, enemy, 31.0 if identity == "groundbreaker" else 20.0):
					accepted = true
			if identity == "resonance_wave":
				for ally in _allies(p, 7.0):
					ally["hp"] = minf(float(ally["max_hp"]), float(ally["hp"]) + 21.0)
				accepted = true
		"bayanihan_bastion", "stand_united", "command_network":
			for ally in _allies(p, 10.0):
				ally["shield"] = minf(90.0, float(ally["shield"]) + 36.0)
				ally["buffs"]["guard"] = {"until": float(state["time"]) + 8.0, "strength": 0.2}
			accepted = true
		"horizon_corridor", "rally_formation", "symphony_of_buklod":
			for ally in _allies(p, 12.0):
				ally["buffs"]["haste"] = {"until": float(state["time"]) + 8.0, "strength": 0.2}
				if identity == "symphony_of_buklod":
					ally["hp"] = minf(float(ally["max_hp"]), float(ally["hp"]) + 48.0)
			accepted = true
		"beacon_mark":
			if not target.is_empty():
				target["buffs"]["marked"] = {"until": float(state["time"]) + 5.0, "strength": 0.15}
				accepted = true
		"signal_shield", "restorative_beat", "field_patch":
			var allies := _allies(p, 9.0)
			allies.sort_custom(func(a, b): return float(a["hp"]) / float(a["max_hp"]) < float(b["hp"]) / float(b["max_hp"]))
			if not allies.is_empty():
				var ally: Dictionary = allies.front()
				if identity == "signal_shield":
					ally["shield"] = minf(105.0, float(ally["shield"]) + 35.0)
				else:
					ally["hp"] = minf(float(ally["max_hp"]), float(ally["hp"]) + 38.0)
				accepted = true
		"checkmate_rescue":
			p["buffs"]["triage"] = {"until": float(state["time"]) + 10.0, "strength": 1.0}
			accepted = true
		_:
			if slot == "secondary":
				accepted = _move(p, direction, 40.0)
			elif style in ["heal", "supply", "guard"]:
				for ally in _allies(p, 9.0):
					if style == "heal":
						ally["hp"] = minf(float(ally["max_hp"]), float(ally["hp"]) + (80.0 if slot == "ultimate" else 38.0))
					else:
						ally["shield"] = minf(105.0, float(ally["shield"]) + (60.0 if slot == "ultimate" else 25.0))
				accepted = true
			elif not target.is_empty() and _dist(p, target) <= (10.0 if slot == "ultimate" else 7.0):
				accepted = _hit(p, target, 69.0 if slot == "ultimate" else 35.0)
				if accepted and style == "disrupt":
					target["buffs"]["slow"] = {"until": float(state["time"]) + 2.8, "strength": 0.3}
	if not accepted:
		return false
	p["mana"] = float(p["mana"]) - mana_cost
	p["cooldowns"][slot] = float(state["time"])
	_log("skill", {"actor": p["id"], "slot": slot, "skill_id": identity, "pos": p["pos"]})
	return true

func action(id: String, command: String, vector: Vector2 = Vector2.ZERO,
		target_id: String = "") -> bool:
	if state.is_empty() or state["status"] != "active":
		return false
	var p := actor(id)
	if not _alive(p) or p.get("kind") != "hero":
		return false
	match command:
		"move":
			if int(p["last_move_tick"]) == int(state["tick"]):
				return false
			var kit_speed: float = float(config["starter"].get(p["hero"], {}).get("speed", 210)) / 210.0
			var move_speed: float = 4.4 * kit_speed
			if float(p["buffs"].get("haste", {}).get("until", 0.0)) > float(state["time"]):
				move_speed *= 1.0 + minf(0.25, float(p["buffs"]["haste"]["strength"]))
			if float(p["buffs"].get("slow", {}).get("until", 0.0)) > float(state["time"]):
				move_speed *= 0.7
			var moved := _move(p, vector, move_speed)
			if moved: p["last_move_tick"] = int(state["tick"])
			return moved
		"attack":
			var basic: Dictionary = config["starter"].get(p["hero"], {}).get("basic", {})
			var cooldown: float = float(basic.get("cooldown", 800)) / 1000.0
			if float(state["time"]) - float(p["cooldowns"]["attack"]) < cooldown:
				return false
			var radius: float = float(basic.get("range", 5.5))
			var enemies := _enemies(p, radius)
			var target: Dictionary = actor(target_id) if target_id != "" else enemies.front() if not enemies.is_empty() else {}
			if target.is_empty() or _dist(p, target) > radius:
				return false
			p["cooldowns"]["attack"] = float(state["time"])
			var damage: float = float(basic.get("damage", 20)) + (float(p["level"]) - 1.0) * 0.6
			return _hit(p, target, damage)
		"primary", "secondary", "ultimate":
			return _skill(p, command, vector if vector.length() > 0.05 else Vector2(1, 0))
		"loot":
			return _loot(p)
		"mine":
			if state["solo"]: return false
			for node in state["nodes"]:
				if (node["pos"] as Vector2).distance_to(p["pos"] as Vector2) > 8.0:
					continue
				if float(node["stock"]) <= 0.0: continue
				var type: String = node["type"]
				var carried: float = float(p["bag"]["wood"]) + float(p["bag"]["gold"]) + float(p["bag"]["stone"])
				if carried >= 65.0: return false
				var amount: float = minf(6.0, minf(65.0 - carried, float(node["stock"])))
				p["bag"][type] = float(p["bag"][type]) + amount
				node["stock"] = float(node["stock"]) - amount
				_log("mine", {"actor": id, "resource": type, "amount": amount, "pos": p["pos"]})
				return true
			return false
		"deposit":
			if state["solo"]: return false
			var home := Vector2(14, state["h"] * 0.5) if p["team"] == "A" else Vector2(state["w"] - 14, state["h"] * 0.5)
			if (p["pos"] as Vector2).distance_to(home) > 10.0:
				return false
			for type in ["wood", "gold", "stone"]:
				state["team"][p["team"]][type] = float(state["team"][p["team"]][type]) + float(p["bag"][type])
				p["bag"][type] = 0.0
			_log("deposit", {"actor": id, "pos": p["pos"]})
			return true
		"train":
			if state["solo"]: return false
			var kind: String = target_id if config["costs"].has(target_id) else "warrior"
			var cost: Dictionary = config["costs"][kind]
			if state["team"][p["team"]]["queue"].size() >= 8: return false
			if not _spend(p["team"], cost): return false
			state["team"][p["team"]]["queue"].append({"kind": kind, "at": float(state["time"]) + float(cost["time"]) / 1000.0})
			_log("train", {"actor": id, "kind": kind})
			return true
		"build":
			if state["solo"]: return false
			var kind: String = target_id if config["buildings"].has(target_id) else "watchtower"
			if kind == "seal_restore": return false
			var cost: Dictionary = config["buildings"][kind]
			if not _spend(p["team"], cost): return false
			var at: Vector2 = p["pos"] + (vector.normalized() if vector.length() > 0.1 else Vector2(1, 0)) * 5.0
			if _blocked(at, 5.0): return false
			state["buildings"].append({"id": "site" + str(state["next_id"]), "team": p["team"],
				"kind": kind, "pos": at, "hp": float(cost["hp"]) * 0.25, "alive": true,
				"progress": 0.0, "status": "building", "duration": float(cost["time"]) / 1000.0})
			_log("construction_start", {"actor": id, "kind": kind, "pos": at})
			return true
		"seal_attack":
			if state["solo"]: return false
			var enemy: String = _other(p["team"])
			var home := Vector2(14, state["h"] * 0.5) if enemy == "A" else Vector2(state["w"] - 14, state["h"] * 0.5)
			if (p["pos"] as Vector2).distance_to(home) > 7.0: return false
			if state["towers"].filter(func(t): return t["team"] == enemy and _alive(t)).size() > 1:
				return false
			var seal: Dictionary = state["seals"][enemy]
			seal["hp"] = maxf(0.0, float(seal["hp"]) - 27.0 - 4.0 * float(p["level"]))
			_log("seal_damage", {"actor": id, "team": enemy, "hp": seal["hp"], "pos": home})
			if float(seal["hp"]) <= 0.0:
				seal["breached"] = true
				_start_hunt("seal_breach")
			return true
	return false

func _spend(team: String, cost: Dictionary) -> bool:
	var purse: Dictionary = state["team"][team]
	for type in ["wood", "gold", "stone"]:
		if float(purse[type]) < float(cost.get(type, 0)):
			return false
	for type in ["wood", "gold", "stone"]:
		purse[type] = float(purse[type]) - float(cost.get(type, 0))
	return true

func _start_hunt(reason: String) -> void:
	if float(state["hunt_started"]) >= 0.0: return
	state["hunt_started"] = float(state["time"])
	state["phase"] = "hunt"
	_log("final_hunt", {"reason": reason})

func _automation() -> void:
	for team in ["A", "B"]:
		var queue: Array = state["team"][team]["queue"]
		while not queue.is_empty() and float(queue.front()["at"]) <= float(state["time"]):
			var item: Dictionary = queue.pop_front()
			var id := "u" + str(state["next_id"])
			var pos := Vector2(23 if team == "A" else state["w"] - 23, state["h"] * 0.5)
			state["units"].append(_new_unit(id, team, item["kind"], pos))
			_log("unit_spawn", {"team": team, "kind": item["kind"], "pos": pos})
	for node in state["nodes"]:
		node["stock"] = minf(float(node["capacity"]), float(node["stock"]) + 0.065)
	for unit in state["units"]:
		if not _alive(unit): continue
		var enemy: Dictionary = {}
		for target in state["players"].values():
			if _alive(target) and target["team"] != unit["team"] and _dist(unit, target) < 5.0:
				enemy = target
				break
		if not enemy.is_empty() and float(state["time"]) - float(unit["last_attack"]) >= 1.4:
			unit["last_attack"] = float(state["time"])
			_hit(unit, enemy, 4.0 if unit["kind"] == "villager" else 12.0)
			continue
		if unit["kind"] == "villager" and unit["command"] == "mine":
			var resource: Dictionary = {}
			for node in state["nodes"]:
				if node["side"] == unit["team"]:
					resource = node
					break
			if not resource.is_empty():
				var carry: Dictionary = unit["carry"]
				var total: float = float(carry["wood"]) + float(carry["gold"]) + float(carry["stone"])
				var depot := Vector2(20 if unit["team"] == "A" else state["w"] - 20, state["h"] * 0.5)
				if total >= 50.0:
					_move(unit, depot - unit["pos"], 5.0)
					if (unit["pos"] as Vector2).distance_to(depot) < 3.0:
						for type in ["wood", "gold", "stone"]:
							state["team"][unit["team"]][type] = float(state["team"][unit["team"]][type]) + float(carry[type])
							carry[type] = 0.0
							_log("villager_deposit", {"team": unit["team"], "pos": depot})
				else:
					_move(unit, resource["pos"] - unit["pos"], 5.0)
					if _dist(unit, resource) < 4.0 and float(resource["stock"]) >= 2.0:
						resource["stock"] = float(resource["stock"]) - 2.0
						carry[resource["type"]] = float(carry[resource["type"]]) + 2.0
			continue
		var goal := Vector2(state["w"] - 14 if unit["team"] == "A" else 14, state["h"] * 0.5)
		_move(unit, goal - unit["pos"], 4.3 if unit["kind"] != "siege" else 2.6)
	for tower in state["towers"]:
		if not _alive(tower) or float(state["time"]) - float(tower["last_attack"]) < 1.4:
			continue
		var candidates: Array = []
		for category in [state["players"].values(), state["units"]]:
			for enemy in category:
				if _alive(enemy) and enemy["team"] != tower["team"] and _dist(tower, enemy) < 9.0 + float(tower["level"]) * 1.5:
					candidates.append(enemy)
		candidates.sort_custom(func(a, b): return _dist(tower, a) < _dist(tower, b))
		if not candidates.is_empty():
			tower["last_attack"] = float(state["time"])
			_hit(tower, candidates.front(), 11.0 + float(tower["level"]) * 4.0)
			_log("tower_hit", {"tower": tower["id"], "pos": candidates.front()["pos"]})
	for building in state["buildings"]:
		if not _alive(building) or building["status"] != "building":
			continue
		var builders: Array = _allies_at(building["team"], building["pos"], 9.0)
		if builders.is_empty(): continue
		building["progress"] = minf(1.0, float(building["progress"]) + 0.5 / maxf(1.0, float(building["duration"])))
		if float(building["progress"]) >= 1.0:
			building["status"] = "operational"
			building["hp"] = float(config["buildings"][building["kind"]]["hp"])
			_log("construction_complete", {"kind": building["kind"], "team": building["team"], "pos": building["pos"]})
			if building["kind"] == "watchtower":
				state["towers"].append({"id": "watch" + str(state["next_id"]), "team": building["team"],
					"kind": "tower", "pos": building["pos"], "hp": 340.0, "max_hp": 340.0,
					"level": 1, "alive": true, "last_attack": -10000.0})

func _allies_at(team: String, pos: Vector2, radius: float) -> Array:
	var result: Array = []
	for p in state["players"].values():
		if _alive(p) and p["team"] == team and (p["pos"] as Vector2).distance_to(pos) <= radius:
			result.append(p)
	for unit in state["units"]:
		if _alive(unit) and unit["kind"] == "villager" and unit["team"] == team \
				and (unit["pos"] as Vector2).distance_to(pos) <= radius:
			result.append(unit)
	return result

func _bots() -> void:
	var delay: float = {"easy": 0.7, "normal": 0.42, "hard": 0.25}[state["difficulty"]]
	for p in state["players"].values():
		if p["id"] == "A0" or not _alive(p):
			continue
		var target: Dictionary = actor("A0") if p["team"] == "B" else actor("B0")
		if not _alive(target): continue
		var offset: Vector2 = (target["pos"] as Vector2) - (p["pos"] as Vector2)
		if offset.length() > 3.5:
			_move(p, offset, 4.4)
		if float(state["time"]) - float(p["bot_at"]) < delay:
			continue
		p["bot_at"] = float(state["time"])
		if offset.length() < 6.0: action(p["id"], "attack", offset, target["id"])
		if rng.randf() < (0.2 if state["difficulty"] == "easy" else 0.55):
			action(p["id"], "primary", offset, target["id"])

func _finish_solo(winner: String) -> void:
	if winner != "":
		state["solo_wins"][winner] = int(state["solo_wins"][winner]) + 1
	else:
		state["solo_draws"] = int(state["solo_draws"]) + 1
	_log("solo_round_end", {"winner": winner, "round": state["solo_round"]})
	if int(state["solo_wins"]["A"]) >= 2 or int(state["solo_wins"]["B"]) >= 2:
		state["status"] = "finished"
		state["winner"] = "A" if int(state["solo_wins"]["A"]) >= 2 else "B"
		_log("result", {"winner": state["winner"], "reason": "offline_cpu_best_of_three"})
	elif int(state["solo_draws"]) >= 3:
		state["status"] = "void"
		_log("result", {"reason": "offline_cpu_three_draws"})
	else:
		state["solo_intermission"] = float(state["time"]) + 1.4

func _reset_solo() -> void:
	state["solo_round"] = int(state["solo_round"]) + 1
	state["solo_round_start"] = float(state["time"])
	state["solo_intermission"] = 0.0
	for p in state["players"].values():
		p["pos"] = p["spawn"]
		p["hp"] = p["max_hp"]
		p["mana"] = p["max_mana"]
		p["shield"] = 0.0
		p["alive"] = true
		p["buffs"].clear()
		p["cooldowns"] = {"attack": -10000.0, "primary": -10000.0,
			"secondary": -10000.0, "ultimate": -10000.0}
	_log("solo_round_start", {"round": state["solo_round"]})

func advance() -> void:
	if state.is_empty() or state["status"] != "active":
		return
	state["tick"] = int(state["tick"]) + 1
	state["time"] = float(state["time"]) + STEP
	if state["solo"] and float(state["solo_intermission"]) > 0:
		if float(state["time"]) >= float(state["solo_intermission"]):
			_reset_solo()
		return
	for drop in state["loot"].duplicate():
		if float(drop["expires"]) <= float(state["time"]):
			state["loot"].erase(drop)
	for cover in state["cover"].duplicate():
		if cover.has("expires") and float(cover["expires"]) <= float(state["time"]):
			state["cover"].erase(cover)
	for p in state["players"].values():
		if _alive(p):
			p["mana"] = minf(float(p["max_mana"]), float(p["mana"]) + 0.33)
			var regen: Dictionary = p["buffs"].get("regen", {})
			if float(regen.get("until", 0)) > float(state["time"]):
				p["hp"] = minf(float(p["max_hp"]), float(p["hp"]) + 0.1 * float(regen.get("strength", 0)))
		elif not state["solo"] and float(state["hunt_started"]) < 0.0 \
				and float(p["respawn_at"]) <= float(state["time"]):
			p["alive"] = true
			p["pos"] = p["spawn"]
			p["hp"] = p["max_hp"]
			p["mana"] = p["max_mana"]
			p["shield"] = 0.0
			_log("respawn", {"actor": p["id"], "pos": p["pos"]})
	if state["solo"]:
		_bots()
		var a: Dictionary = actor("A0")
		var b: Dictionary = actor("B0")
		if not _alive(a) or not _alive(b) or float(state["time"]) - float(state["solo_round_start"]) >= 90.0:
			var winner := ""
			if _alive(a) and not _alive(b): winner = "A"
			elif _alive(b) and not _alive(a): winner = "B"
			elif _alive(a) and _alive(b):
				if float(a["hp"]) / float(a["max_hp"]) > float(b["hp"]) / float(b["max_hp"]): winner = "A"
				elif float(b["hp"]) / float(b["max_hp"]) > float(a["hp"]) / float(a["max_hp"]): winner = "B"
			_finish_solo(winner)
		return
	state["phase"] = "hunt" if float(state["hunt_started"]) >= 0 else "expansion" if float(state["time"]) < 120 else "territory" if float(state["time"]) < 540 else "siege"
	if int(state["tick"]) % 4 == 0: _bots()
	if int(state["tick"]) % 5 == 0: _automation()
	if float(state["time"]) >= float(state["hard_deadline"]) and not state["hard_lock"]:
		state["hard_lock"] = true
		state["seals"]["A"]["breached"] = true
		state["seals"]["B"]["breached"] = true
		_start_hunt("hard_deadline")
	if float(state["hunt_started"]) >= 0:
		var alive_a: int = state["players"].values().filter(func(p): return p["team"] == "A" and _alive(p)).size()
		var alive_b: int = state["players"].values().filter(func(p): return p["team"] == "B" and _alive(p)).size()
		if alive_a == 0 and alive_b == 0:
			state["status"] = "void"
		elif alive_b == 0 and state["seals"]["B"]["breached"]:
			state["status"] = "finished"
			state["winner"] = "A"
		elif alive_a == 0 and state["seals"]["A"]["breached"]:
			state["status"] = "finished"
			state["winner"] = "B"
		if state["status"] != "active":
			_log("result", {"winner": state["winner"], "reason": "seal_and_final_elimination"})
