## Library minions and named village jobs, adapted into the ONE Godot
## practice simulation. This script owns no independent physics, match results,
## account state or ranked ledger. The server is separate and authoritative.
extends RefCounted

const MAX_ACTIVE_MINIONS := 60
const MAX_ALL_UNITS := 90
const WAVE_SECONDS := 30.0
const VILLAGER_RESPAWN := 60.0

static func seed_villagers(sim, team: String) -> void:
	var faction := "lux" if team == "A" else "tenebra"
	var source: Dictionary = sim.config["library"]["villagers"][faction]
	var jobs: Array = source["villagers"]
	for i in range(jobs.size()):
		var job: Dictionary = jobs[i]
		var spawn := Vector2(20.0 if team == "A" else float(sim.state["w"]) - 20.0,
			float(sim.state["h"]) * 0.5 + (float(i) - 2.5) * 3.0)
		var actor: Dictionary = sim._new_unit("libv_" + team + "_" + str(job["id"]),
			team, "villager", spawn)
		actor["library_name"] = str(job["name"])
		actor["library_job"] = str(job["effect"])
		actor["library_job_interval"] = maxf(2.0, float(job["interval"]))
		actor["library_next_action"] = 2.5 + float(i) * 1.2
		actor["library_level"] = 1
		actor["library_actions"] = 0
		actor["library_down_until"] = 0.0
		actor["spawn"] = spawn
		actor["max_hp"] = 95.0
		actor["hp"] = 95.0
		actor["buffs"] = {}
		sim.state["units"].append(actor)
	sim._log("village_arrived", {"team": team, "faction": source["name"]})

static func _count_active(sim) -> int:
	var n := 0
	for u in sim.state["units"]:
		if u.get("library_minion", false) and sim._alive(u):
			n += 1
	return n

static func _minion_definition(sim, kind: String) -> Dictionary:
	return sim.config["library"]["minions"].get(kind, {})

static func _spawn_minion(sim, team: String, kind: String,
		lane: int, power: float = 1.0) -> bool:
	if _count_active(sim) >= MAX_ACTIVE_MINIONS or sim.state["units"].size() >= MAX_ALL_UNITS:
		return false
	var def: Dictionary = _minion_definition(sim, kind)
	if def.is_empty(): return false
	var map: Dictionary = sim.config["maps"][sim.state["map"]]
	var y: float = float(sim.state["h"]) * float(map["lanes"][lane])
	var start := Vector2(26.0 if team == "A" else float(sim.state["w"]) - 26.0, y)
	var unit: Dictionary = sim._new_unit("libm_" + str(sim.state["next_id"]),
		team, kind, start)
	sim.state["next_id"] = int(sim.state["next_id"]) + 1
	unit["library_minion"] = true
	unit["library_lane"] = lane
	unit["library_damage"] = float(def["damage"]) * minf(1.7, power)
	unit["library_range"] = float(def["range"])
	unit["library_speed"] = float(def["speed"])
	unit["library_cooldown"] = float(def["cooldown"])
	unit["library_heal"] = float(def["heal"])
	unit["library_radius"] = float(def["radius"])
	unit["library_structure_mult"] = float(def["structureMultiplier"])
	unit["max_hp"] = float(def["hp"]) * minf(1.7, power)
	unit["hp"] = unit["max_hp"]
	unit["buffs"] = {}
	sim.state["units"].append(unit)
	return true

static func advance_waves(sim) -> void:
	if sim.state.get("solo", false): return
	var rules: Dictionary = sim.config.get("libraryModes", {}).get(sim.state["mode"], {})
	var interval: float = clampf(float(rules.get("waveSeconds", WAVE_SECONDS)), 15.0, 60.0)
	var lanes: Array = [1] if rules.get("lanes", []).size() == 1 else [0, 1, 2]
	if not sim.state.has("library_next_wave"):
		sim.state["library_next_wave"] = interval
		sim.state["library_wave_index"] = 0
	if float(sim.state["time"]) < float(sim.state["library_next_wave"]): return
	sim.state["library_next_wave"] = float(sim.state["library_next_wave"]) + interval
	sim.state["library_wave_index"] = int(sim.state["library_wave_index"]) + 1
	# Remove defeated minions before capacity checking; never remove villager identity.
	for unit in sim.state["units"].duplicate():
		if unit.get("library_minion", false) and not sim._alive(unit):
			sim.state["units"].erase(unit)
	var composition: Array = sim.config["library"]["waves"].front()["units"]
	for wave in sim.config["library"]["waves"]:
		if float(sim.state["time"]) >= float(wave["from"]):
			composition = wave["units"]
	var index: int = int(sim.state["library_wave_index"])
	var power: float = minf(1.7, 1.0 + float(sim.state["time"]) / 60.0 * 0.04)
	var total := 0
	for team in ["A", "B"]:
		# The research villager's work provides a capped, match-only 2% stat
		# improvement per researched tier; it never grants permanent BP.
		var research: float = clampf(float(sim.state["team"][team].get("library_research", 0)), 0.0, 5.0)
		var team_power: float = minf(1.7, power * (1.0 + research * 0.02))
		for lane in lanes:
			for kind in composition:
				if _spawn_minion(sim, team, str(kind), lane, team_power):
					total += 1
			if sim.state["time"] >= 480.0 and index % 6 == 0:
				if _spawn_minion(sim, team, "siege", lane, team_power):
					total += 1
	if total > 0:
		sim._log("library_minion_wave", {"wave": index, "count": total})

static func advance_minion(sim, u: Dictionary) -> void:
	if not sim._alive(u): return
	var now: float = float(sim.state["time"])
	var enemy_team: String = sim._other(u["team"])
	var enemies: Array = []
	for group in [sim.state["units"], sim.state["players"].values(), sim.state["towers"]]:
		for e in group:
			if sim._alive(e) and e["team"] == enemy_team and sim._dist(u, e) < float(u["library_range"]) + 0.6:
				enemies.append(e)
	enemies.sort_custom(func(a, b): return sim._dist(u, a) < sim._dist(u, b))
	if u["kind"] == "healer":
		var wounded: Array = []
		for friend in sim.state["units"]:
			if sim._alive(friend) and friend["team"] == u["team"] and friend != u and \
					sim._dist(friend, u) < maxf(3.0, float(u["library_radius"])) and \
					float(friend["hp"]) < float(friend["max_hp"]):
				wounded.append(friend)
		if not wounded.is_empty() and now - float(u["last_attack"]) >= float(u["library_cooldown"]):
			wounded.sort_custom(func(a, b): return float(a["hp"]) / float(a["max_hp"]) < float(b["hp"]) / float(b["max_hp"]))
			var friend: Dictionary = wounded.front()
			friend["hp"] = minf(float(friend["max_hp"]), float(friend["hp"]) + float(u["library_heal"]))
			u["last_attack"] = now
			return
	elif not enemies.is_empty() and now - float(u["last_attack"]) >= float(u["library_cooldown"]):
		var target: Dictionary = enemies.front()
		var damage: float = float(u["library_damage"])
		if target["kind"] == "tower" and u["kind"] == "siege":
			damage *= float(u["library_structure_mult"])
		u["last_attack"] = now
		sim._hit(u, target, damage)
		return
	# Progress toward the enemy along the spawned lane; keep both teams mirrored.
	var lanes: Array = sim.config["maps"][sim.state["map"]]["lanes"]
	var goal := Vector2(float(sim.state["w"]) - 14.0 if u["team"] == "A" else 14.0,
		float(sim.state["h"]) * float(lanes[int(u["library_lane"])]))
	sim._move(u, goal - u["pos"], float(u["library_speed"]))

static func advance_villager(sim, v: Dictionary) -> void:
	var now: float = float(sim.state["time"])
	if not sim._alive(v):
		if float(v["library_down_until"]) <= 0:
			v["library_down_until"] = now + VILLAGER_RESPAWN
		elif now >= float(v["library_down_until"]):
			v["alive"] = true
			v["hp"] = v["max_hp"]
			v["pos"] = v["spawn"]
			v["library_down_until"] = 0.0
		return
	if now < float(v["library_next_action"]):
		return
	v["library_next_action"] = now + float(v["library_job_interval"])
	var team: Dictionary = sim.state["team"][v["team"]]
	var job: String = v["library_job"]
	var done := false
	match job:
		"gather":
			team["wood"] = minf(10000, float(team["wood"]) + 6.0)
			team["stone"] = minf(10000, float(team["stone"]) + 4.0)
			done = true
		"build":
			if float(team["wood"]) >= 20.0 and float(team["stone"]) >= 12.0:
				for tower in sim.state["towers"]:
					if sim._alive(tower) and tower["team"] == v["team"] and float(tower["hp"]) < float(tower["max_hp"]):
						team["wood"] = float(team["wood"]) - 20.0
						team["stone"] = float(team["stone"]) - 12.0
						tower["hp"] = minf(float(tower["max_hp"]), float(tower["hp"]) + 22.0)
						done = true
						break
		"train":
			if float(team["wood"]) >= 25.0 and _count_active(sim) < MAX_ACTIVE_MINIONS:
				if _spawn_minion(sim, v["team"], "infantry", int(sim.state["tick"]) % 3):
					team["wood"] = float(team["wood"]) - 25.0
					done = true
		"heal":
			for hero in sim.state["players"].values():
				if sim._alive(hero) and hero["team"] == v["team"] and \
						sim._dist(v, hero) <= 18.0:
					hero["hp"] = minf(float(hero["max_hp"]), float(hero["hp"]) + 12.0)
					done = true
		"research":
			if float(team["gold"]) >= 25.0 and int(team.get("library_research", 0)) < 5:
				team["gold"] = float(team["gold"]) - 25.0
				team["library_research"] = int(team.get("library_research", 0)) + 1
				done = true
		"supply":
			for hero in sim.state["players"].values():
				if sim._alive(hero) and hero["team"] == v["team"] and \
						sim._dist(v, hero) <= 18.0:
					hero["shield"] = minf(105.0, float(hero["shield"]) + 10.0)
					done = true
		"revive":
			for unit in sim.state["units"]:
				if unit.get("library_minion", false) and not sim._alive(unit) and unit["team"] == v["team"]:
					unit["alive"] = true
					unit["hp"] = float(unit["max_hp"]) * 0.45
					done = true
					break
		"craft":
			for hero in sim.state["players"].values():
				if sim._alive(hero) and hero["team"] == v["team"]:
					hero["buffs"]["fury"] = {"strength": 0.07, "until": now + 6.0}
					done = true
		"scavenge":
			var defeated := 0
			for unit in sim.state["units"]:
				if unit.get("library_minion", false) and not sim._alive(unit) and unit["team"] != v["team"]:
					defeated += 1
			if defeated > 0:
				team["wood"] = minf(10000, float(team["wood"]) + minf(12.0, 3.0 * defeated))
				done = true
	if done:
		v["library_actions"] = int(v["library_actions"]) + 1
		if int(v["library_actions"]) >= 4 and int(v["library_level"]) < 10:
			v["library_level"] = int(v["library_level"]) + 1
			v["library_actions"] = 0
			sim._log("village_level_up", {"team": v["team"],
				"villager": v["library_name"], "level": v["library_level"]})
