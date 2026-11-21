## Godot-native deterministic, bilateral Genesis minion waves for offline Arena.
## 3 lanes, 4 distinct classes, healer + siege, max 42 living per team.
## Runs only inside practice; NEVER writes account BP, Diamond, QMP or inventory.
extends RefCounted

const FIRST_WAVE := 8.0
const WAVE_INTERVAL := 24.0
const TEAM_CAP := 42
const UNIT_DATA := {
	"vanguard": {"hp": 128.0, "damage": 12.0, "range": 2.8, "cooldown": 1.5, "speed": 3.0},
	"ranger": {"hp": 76.0, "damage": 11.0, "range": 10.0, "cooldown": 1.75, "speed": 3.4},
	"mender": {"hp": 86.0, "damage": 5.0, "range": 7.0, "cooldown": 1.9, "speed": 3.2},
	"siege_breaker": {"hp": 210.0, "damage": 8.0, "range": 3.4, "cooldown": 2.7, "speed": 2.2}
}

static func init(sim) -> void:
	sim.state["minions"] = []
	sim.state["minion_waves"] = {"wave": 0, "next_at": FIRST_WAVE, "interval": WAVE_INTERVAL}

static func _alive(a: Dictionary) -> bool:
	return a.get("alive", false) and float(a.get("hp", 0.0)) > 0.0

static func _enemy(team: String) -> String:
	return "B" if team == "A" else "A"

static func _lane_y(sim, lane: int) -> float:
	return float(sim.state["h"]) * float(sim.config["maps"][sim.state["map"]]["lanes"][lane])

static func _wave(sim) -> void:
	var mgr: Dictionary = sim.state["minion_waves"]
	mgr["wave"] = int(mgr["wave"]) + 1
	var number: int = int(mgr["wave"])
	var kinds: Array = ["vanguard", "ranger", "mender", "siege_breaker"] if number % 3 == 0 else ["vanguard", "ranger", "mender"]
	for team in ["A", "B"]:
		var living: int = 0
		for m in sim.state["minions"]:
			if m["team"] == team and _alive(m): living += 1
		var slots: int = TEAM_CAP - living
		for lane in range(3):
			for index in range(kinds.size()):
				if slots <= 0: break
				var kind: String = kinds[index]
				var cfg: Dictionary = UNIT_DATA[kind]
				var x: float = 20.0 if team == "A" else float(sim.state["w"]) - 20.0
				var pos: Vector2 = Vector2(x + (1.0 if team == "A" else -1.0) * float(index) * 0.9,
					_lane_y(sim, lane) + float(index - 1) * 0.65)
				var unit: Dictionary = sim._new_unit("minion-" + str(sim.state["next_id"]),
					team, kind, pos)
				sim.state["next_id"] = int(sim.state["next_id"]) + 1
				unit["hp"] = cfg["hp"]
				unit["max_hp"] = cfg["hp"]
				unit["shield"] = 0.0
				unit["lane"] = lane
				unit["last_heal"] = -10000.0
				unit["pose"] = "idle"
				unit["pose_at"] = float(sim.state["time"])
				unit["facing"] = 1 if team == "A" else -1
				unit["death_at"] = -1.0
				sim.state["minions"].append(unit)
				slots -= 1
	sim._log("minion_wave", {"wave": number, "pos": Vector2(float(sim.state["w"]) * 0.5, float(sim.state["h"]) * 0.5)})

static func _target(sim, unit: Dictionary) -> Dictionary:
	var candidates: Array = []
	var enemy: String = _enemy(str(unit["team"]))
	for category in [sim.state["minions"], sim.state["units"], sim.state["players"].values()]:
		for opponent in category:
			if opponent["team"] != enemy or not _alive(opponent):
				continue
			if absf(float(opponent["pos"].y) - _lane_y(sim, int(unit["lane"]))) > 11.0:
				continue
			if sim._dist(unit, opponent) <= 15.0:
				candidates.append(opponent)
	candidates.sort_custom(func(a, b):
		return sim._dist(unit, a) < sim._dist(unit, b))
	if not candidates.is_empty(): return candidates.front()
	return {}

static func _heal(sim, unit: Dictionary) -> bool:
	if unit["kind"] != "mender" or float(sim.state["time"]) - float(unit["last_heal"]) < 2.4:
		return false
	var candidates: Array = []
	for ally in sim.state["minions"]:
		if ally["team"] == unit["team"] and _alive(ally) and ally["id"] != unit["id"] and \
				float(ally["hp"]) < float(ally["max_hp"]) * 0.86 and sim._dist(unit, ally) < 8.0:
			candidates.append(ally)
	candidates.sort_custom(func(a, b):
		return float(a["hp"]) / float(a["max_hp"]) < float(b["hp"]) / float(b["max_hp"]))
	if candidates.is_empty(): return false
	var ally: Dictionary = candidates.front()
	var amount: float = minf(14.0, float(ally["max_hp"]) - float(ally["hp"]))
	ally["hp"] = float(ally["hp"]) + amount
	ally["shield"] = minf(18.0, float(ally.get("shield", 0.0)) + 4.0)
	unit["last_heal"] = float(sim.state["time"])
	unit["pose"] = "heal"
	unit["pose_at"] = float(sim.state["time"])
	sim._log("minion_heal", {"from": unit["id"], "to": ally["id"], "amount": amount, "pos": ally["pos"]})
	return true

static func _protected_tower(sim, unit: Dictionary) -> Dictionary:
	var enemy: String = _enemy(str(unit["team"]))
	var candidates: Array = []
	for tower in sim.state["towers"]:
		if tower["team"] == enemy and _alive(tower) and absf(float(tower["pos"].y) - _lane_y(sim, int(unit["lane"]))) <= 10.0:
			candidates.append(tower)
	candidates.sort_custom(func(a, b):
		return sim._dist(unit, a) < sim._dist(unit, b))
	if not candidates.is_empty(): return candidates.front()
	return {}

static func _attack(sim, unit: Dictionary, target: Dictionary) -> bool:
	var cfg: Dictionary = UNIT_DATA[unit["kind"]]
	if float(sim.state["time"]) - float(unit["last_attack"]) < float(cfg["cooldown"]):
		return false
	if sim._dist(unit, target) > float(cfg["range"]) or sim._line_blocked(unit["pos"], target["pos"]):
		return false
	var damage: float = float(cfg["damage"])
	if unit["kind"] == "siege_breaker" and target["kind"] == "tower":
		damage = 29.0
	if sim._hit(unit, target, damage):
		unit["last_attack"] = float(sim.state["time"])
		unit["pose"] = "attack"
		unit["pose_at"] = float(sim.state["time"])
		sim._log("minion_hit", {"from": unit["id"], "to": target["id"], "amount": damage, "pos": target["pos"]})
		if not _alive(target) and target.get("kind") == "tower":
			sim._log("tower_destroyed", {"tower": target["id"], "team": target["team"], "pos": target["pos"]})
		return true
	return false

static func _seal(sim, unit: Dictionary) -> bool:
	if unit["kind"] != "siege_breaker":
		return false
	var enemy: String = _enemy(str(unit["team"]))
	var seal: Dictionary = sim.state["seals"][enemy]
	if seal["breached"] or not _protected_tower(sim, unit).is_empty():
		return false
	var pos: Vector2 = Vector2(14.0 if enemy == "A" else float(sim.state["w"]) - 14.0,
		float(sim.state["h"]) * 0.5)
	if sim._dist(unit, {"pos": pos}) > 6.0:
		sim._move(unit, pos - unit["pos"], float(UNIT_DATA[unit["kind"]]["speed"]) * 5.0)
		return true
	if float(sim.state["time"]) - float(unit["last_attack"]) < float(UNIT_DATA[unit["kind"]]["cooldown"]):
		return true
	unit["last_attack"] = float(sim.state["time"])
	seal["hp"] = maxf(0.0, float(seal["hp"]) - 29.0)
	sim._log("minion_siege_hit", {"from": unit["id"], "to": enemy + "-seal", "pos": pos, "amount": 29.0})
	if float(seal["hp"]) <= 0.0:
		seal["breached"] = true
		sim._start_hunt("minion_siege_breach")
	return true

static func step(sim) -> void:
	if sim.state.get("solo", true) or sim.state.get("status", "") != "active":
		return
	var waves: Dictionary = sim.state["minion_waves"]
	if float(sim.state["time"]) >= float(waves["next_at"]):
		_wave(sim)
		waves["next_at"] = float(sim.state["time"]) + float(waves["interval"])
	for unit in sim.state["minions"]:
		if not _alive(unit): continue
		if _heal(sim, unit): continue
		var target: Dictionary = _target(sim, unit)
		var cfg: Dictionary = UNIT_DATA[unit["kind"]]
		if not target.is_empty():
			if _attack(sim, unit, target):
				continue
			if sim._dist(unit, target) > float(cfg["range"]):
				sim._move(unit, target["pos"] - unit["pos"], float(cfg["speed"]) * 5.0)
			continue
		var tower: Dictionary = _protected_tower(sim, unit)
		if not tower.is_empty():
			if _attack(sim, unit, tower):
				continue
			if sim._dist(unit, tower) > float(cfg["range"]):
				sim._move(unit, tower["pos"] - unit["pos"], float(cfg["speed"]) * 5.0)
			continue
		if _seal(sim, unit):
			continue
		var enemy: String = _enemy(str(unit["team"]))
		var goal: Vector2 = Vector2(14.0 if enemy == "A" else float(sim.state["w"]) - 14.0,
			_lane_y(sim, int(unit["lane"])))
		if (unit["pos"] as Vector2).distance_to(goal) > 2.0:
			sim._move(unit, goal - unit["pos"], float(cfg["speed"]) * 5.0)
	for unit in sim.state["minions"].duplicate():
		if not _alive(unit):
			if float(unit["death_at"]) < 0.0: unit["death_at"] = float(sim.state["time"])
			if float(sim.state["time"]) - float(unit["death_at"]) > 0.9:
				sim.state["minions"].erase(unit)
