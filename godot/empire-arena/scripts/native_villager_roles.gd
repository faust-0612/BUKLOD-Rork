## BUKLOD Godot-native two-faction villagers: six distinct roles per team.
## Deterministic match-local work orders, finite resources, no account economy.
extends RefCounted

const ROLES := ["builder", "gatherer", "guardian", "healer", "researcher", "supplier"]
const JOBS := ["mine", "repair", "defend", "support", "research", "retreat", "escort", "patrol"]
const TEAMS := {
	"A": {"name": "The Lightbearers", "members": ["Aron", "Lira", "Daren", "Serah", "Kiel", "Miko"]},
	"B": {"name": "The Shadowborne", "members": ["Rogar", "Velin", "Kael", "Mora", "Zed", "Taro"]}
}
const LIMIT := 6
const TYPES := ["wood", "gold", "stone"]

static func next_slot(sim, team: String) -> int:
	if not TEAMS.has(team): return -1
	var taken: Array[int] = []
	for u in sim.state["units"]:
		if u["team"] == team and u["kind"] == "villager" and u.get("alive", false):
			taken.append(int(u.get("villager_slot", -1)))
	for q in sim.state["team"][team]["queue"]:
		if q["kind"] == "villager": taken.append(int(q.get("slot", -1)))
	for slot in range(LIMIT):
		if not taken.has(slot): return slot
	return -1

static func configure(unit: Dictionary, team: String, slot: int) -> void:
	if not TEAMS.has(team) or slot < 0 or slot >= LIMIT:
		return
	var role: String = ROLES[slot]
	unit["villager_slot"] = slot
	unit["villager_role"] = role
	unit["villager_name"] = TEAMS[team]["members"][slot]
	unit["facing"] = 1 if team == "A" else -1
	unit["last_moved"] = -10000.0
	unit["job_at"] = -10000.0
	unit["command"] = {
		"builder": "mine", "gatherer": "mine", "guardian": "defend",
		"healer": "support", "researcher": "research", "supplier": "mine"
	}[role]
	var hp: float = 92.0 if role == "guardian" else 74.0 if role == "healer" else 72.0
	unit["hp"] = hp
	unit["max_hp"] = hp

static func order(sim, team: String, unit_id: String, job: String) -> bool:
	if not JOBS.has(job) or not TEAMS.has(team):
		return false
	var modified := false
	for worker in sim.state["units"]:
		if worker["kind"] != "villager" or worker["team"] != team or not worker.get("alive", false):
			continue
		if unit_id != "" and worker["id"] != unit_id:
			continue
		worker["command"] = job
		worker["job_at"] = -10000.0
		modified = true
	return modified

static func _home(sim, team: String) -> Vector2:
	return Vector2(20.0 if team == "A" else float(sim.state["w"]) - 20.0, float(sim.state["h"]) * 0.5)

static func _distance(a: Dictionary, p: Vector2) -> float:
	return (a["pos"] as Vector2).distance_to(p)

static func _walk(sim, u: Dictionary, target: Vector2, speed: float) -> void:
	var old: Vector2 = u["pos"]
	if sim._move(u, target - old, speed * 5.0):
		var at: Vector2 = u["pos"]
		u["facing"] = -1 if at.x < old.x else 1
		u["last_moved"] = float(sim.state["time"])

static func _carry(unit: Dictionary) -> float:
	var amount := 0.0
	for kind in TYPES: amount += float(unit["carry"][kind])
	return amount

static func _mine(sim, u: Dictionary) -> void:
	var team: String = u["team"]
	var source: Dictionary = {}
	for node in sim.state["nodes"]:
		if node["side"] != team or float(node["stock"]) <= 0.0: continue
		if source.is_empty() or _distance(u, node["pos"]) < _distance(u, source["pos"]):
			source = node
	var cap: float = 58.0 if u["villager_role"] == "supplier" else 50.0
	if source.is_empty() or _carry(u) >= cap:
		var home: Vector2 = _home(sim, team)
		_walk(sim, u, home, 0.72 if u["villager_role"] == "supplier" else 0.50)
		if _distance(u, home) <= 3.0 and _carry(u) > 0.0:
			var credited: Dictionary = {}
			for kind in TYPES:
				var amount: float = float(u["carry"][kind])
				sim.state["team"][team][kind] = float(sim.state["team"][team][kind]) + amount
				credited[kind] = amount
				u["carry"][kind] = 0.0
			sim._log("villager_deposit", {"team": team, "actor": u["id"],
				"resources": credited, "pos": home})
		return
	_walk(sim, u, source["pos"], 0.72 if u["villager_role"] == "supplier" else 0.5)
	if _distance(u, source["pos"]) <= 4.0:
		var amount: float = minf(4.0 if u["villager_role"] == "gatherer" else 3.0,
			minf(cap - _carry(u), float(source["stock"])))
		if amount <= 0.0: return
		source["stock"] = float(source["stock"]) - amount
		u["carry"][source["type"]] = float(u["carry"][source["type"]]) + amount
		sim._log("villager_mine", {"actor": u["id"], "team": team,
			"resource": source["type"], "amount": amount, "pos": u["pos"]})

static func _defend(sim, u: Dictionary) -> void:
	var home: Vector2 = _home(sim, u["team"])
	var targets: Array = []
	for category in [sim.state["players"].values(), sim.state["units"], sim.state["minions"]]:
		for candidate in category:
			if candidate["team"] != u["team"] and sim._alive(candidate) and \
					_distance(candidate, home) <= 27.0:
				targets.append(candidate)
	targets.sort_custom(func(a, b): return sim._dist(u, a) < sim._dist(u, b))
	if targets.is_empty():
		_walk(sim, u, home + Vector2(7.0 if u["team"] == "A" else -7.0, 0), 0.48)
		return
	var target: Dictionary = targets.front()
	if sim._dist(u, target) > 4.5:
		_walk(sim, u, target["pos"], 0.57)
		return
	if float(sim.state["time"]) - float(u["last_attack"]) < 1.6 or sim._line_blocked(u["pos"], target["pos"]):
		return
	u["last_attack"] = float(sim.state["time"])
	sim._hit(u, target, 6.0 + float(sim.state["team"][u["team"]].get("tech", 0)))
	sim._log("villager_guard", {"actor": u["id"], "to": target["id"], "pos": target["pos"]})

static func _support(sim, u: Dictionary) -> void:
	var friends: Array = []
	for category in [sim.state["players"].values(), sim.state["units"]]:
		for friend in category:
			if friend["team"] == u["team"] and sim._alive(friend) and \
					float(friend["hp"]) < float(friend["max_hp"]):
				friends.append(friend)
	friends.sort_custom(func(a, b): return sim._dist(u, a) < sim._dist(u, b))
	if friends.is_empty():
		_walk(sim, u, _home(sim, u["team"]), 0.5)
		return
	var friend: Dictionary = friends.front()
	_walk(sim, u, friend["pos"], 0.5)
	if sim._dist(u, friend) > 5.0 or float(sim.state["time"]) - float(u["job_at"]) < 2.5:
		return
	var team: Dictionary = sim.state["team"][u["team"]]
	if float(team["gold"]) < 2.0:
		return
	team["gold"] = float(team["gold"]) - 2.0
	var healed: float = minf(12.0, float(friend["max_hp"]) - float(friend["hp"]))
	friend["hp"] = float(friend["hp"]) + healed
	u["job_at"] = float(sim.state["time"])
	sim._log("villager_heal", {"actor": u["id"], "to": friend["id"],
		"amount": healed, "pos": friend["pos"]})

static func _research(sim, u: Dictionary) -> void:
	var home: Vector2 = _home(sim, u["team"])
	_walk(sim, u, home, 0.5)
	if _distance(u, home) > 5.0 or float(sim.state["time"]) - float(u["job_at"]) < 15.0:
		return
	var team: Dictionary = sim.state["team"][u["team"]]
	var tech: int = int(team.get("tech", 0))
	if tech >= 3:
		return
	var next: int = tech + 1
	var costs := {"wood": 8.0 * next, "gold": 8.0 * next, "stone": 3.0 * next}
	if not sim._spend(u["team"], costs):
		return
	team["tech"] = next
	u["job_at"] = float(sim.state["time"])
	sim._log("villager_research", {"actor": u["id"], "team": u["team"],
		"level": next, "pos": u["pos"]})

static func _repair(sim, u: Dictionary) -> void:
	var chosen: Dictionary = {}
	for category in [sim.state["towers"], sim.state["buildings"]]:
		for structure in category:
			if structure["team"] != u["team"] or not sim._alive(structure):
				continue
			var cap: float = float(structure.get("max_hp", 340.0))
			if float(structure["hp"]) >= cap:
				continue
			if chosen.is_empty() or sim._dist(u, structure) < sim._dist(u, chosen):
				chosen = structure
	if chosen.is_empty():
		_walk(sim, u, _home(sim, u["team"]), 0.5)
		return
	_walk(sim, u, chosen["pos"], 0.5)
	if sim._dist(u, chosen) > 4.0 or float(sim.state["time"]) - float(u["job_at"]) < 2.5:
		return
	if not sim._spend(u["team"], {"wood": 5.0, "stone": 8.0}):
		return
	var cap: float = float(chosen.get("max_hp", 340.0))
	var healed: float = minf(19.0, cap - float(chosen["hp"]))
	chosen["hp"] = float(chosen["hp"]) + healed
	u["job_at"] = float(sim.state["time"])
	sim._log("villager_repair", {"actor": u["id"], "to": chosen["id"], "amount": healed, "pos": chosen["pos"]})

static func step(sim, unit: Dictionary) -> void:
	if unit.get("kind", "") != "villager" or not unit.get("alive", false):
		return
	if not unit.has("villager_role"):
		return
	var role: String = str(unit["villager_role"])
	var job: String = str(unit["command"])
	match job:
		"retreat":
			_walk(sim, unit, _home(sim, unit["team"]), 0.70)
		"mine":
			_mine(sim, unit)
		"repair":
			_repair(sim, unit)
		"research":
			if role == "researcher": _research(sim, unit)
		"support":
			if role == "healer": _support(sim, unit)
		"defend", "patrol", "escort":
			if role == "guardian": _defend(sim, unit)
		_:
			_walk(sim, unit, _home(sim, unit["team"]), 0.5)
