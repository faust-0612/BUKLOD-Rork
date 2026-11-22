## BUKLOD Empire Arena: match-only geography derived from the canonical map catalog.
## No independent rewards, accounts, network calls or permanent economy.
class_name BuklodArenaGeography
extends RefCounted

const LANE_NAMES := ["Frontier Road", "Verdant Trail", "Crystal Rift"]

static func build(map: Dictionary, width: float, height: float) -> Dictionary:
	var routes: Array = []
	for index in range(3):
		var y: float = height * float(map["lanes"][index])
		routes.append({"id": LANE_NAMES[index], "lane": index, "y": y,
			"points": [Vector2(16, y), Vector2(width * 0.33, y),
				Vector2(width * 0.5, y), Vector2(width * 0.67, y),
				Vector2(width - 16, y)]})
	var links: Array = []
	for points in map.get("shortcuts", []):
		links.append({"from": Vector2(float(points[0]) * width, float(points[1]) * height),
			"to": Vector2(float(points[2]) * width, float(points[3]) * height)})
	# Resource-buff camps have mirrored approach distance. Other camps are contested.
	var creatures: Array = []
	for entry in [
		{"kind": "forest", "y": 0.18, "hp": 92.0},
		{"kind": "golden", "y": 0.5, "hp": 106.0},
		{"kind": "stone", "y": 0.82, "hp": 130.0}
	]:
		for side in ["A", "B"]:
			var x: float = 0.40 if side == "A" else 0.60
			creatures.append(_creature(str(entry["kind"]) + "-" + side, str(entry["kind"]),
				Vector2(width * x, height * float(entry["y"])), float(entry["hp"]), false, 0.0))
	for entry in [
		{"kind": "lumen", "x": 0.5, "y": 0.13},
		{"kind": "forager", "x": 0.5, "y": 0.5},
		{"kind": "wisp", "x": 0.5, "y": 0.87}
	]:
		creatures.append(_creature(str(entry["kind"]), str(entry["kind"]),
			Vector2(width * float(entry["x"]), height * float(entry["y"])),
			115.0, false, 0.0))
	creatures.append(_creature("rift-stalker", "rift_stalker",
		Vector2(width * 0.5, height * 0.34), 520.0, true, 150.0))
	creatures.append(_creature("ancient-shellkeeper", "shellkeeper",
		Vector2(width * 0.5, height * 0.66), 640.0, true, 240.0))
	var interval: float = float(map.get("hazardInterval", 0.0)) / 1000.0
	return {"routes": routes, "shortcuts": links, "creatures": creatures,
		"hazard": {"kind": str(map.get("hazard", "none")), "interval": interval,
			"next": interval if interval > 0.0 else -1.0,
			"warning_until": 0.0, "active_until": 0.0,
			"pos": Vector2(width * 0.5, height * 0.5),
			"radius": minf(width, height) * 0.10,
			"damage": float(map.get("hazardDamage", 0.0))}}

static func _creature(id: String, kind: String, position: Vector2,
		hp: float, boss: bool, arrival: float) -> Dictionary:
	return {"id": id, "kind": "creature", "species": kind, "team": "N",
		"pos": position, "home": position, "hp": hp, "max_hp": hp,
		"alive": arrival <= 0.0, "boss": boss, "respawn_at": arrival,
		"hits": 0, "last_attack": -1000.0}

static func line_clear(start: Vector2, goal: Vector2, covers: Array) -> bool:
	for cover in covers:
		var center: Vector2 = cover["pos"]
		var radius: float = float(cover["radius"])
		var nearest: Vector2 = Geometry2D.get_closest_point_to_segment(center, start, goal)
		if center.distance_to(nearest) < radius + 0.8:
			return false
	return true

static func steer(start: Vector2, goal: Vector2, covers: Array) -> Vector2:
	# Local deterministic detour so a paid minion/villager does not stay stuck
	# walking straight into a crystal or tree. Source route remains authoritative.
	for cover in covers:
		var center: Vector2 = cover["pos"]
		var radius: float = float(cover["radius"]) + 3.0
		var closest: Vector2 = Geometry2D.get_closest_point_to_segment(center, start, goal)
		if closest.distance_to(center) >= radius or start.distance_to(goal) < 0.5:
			continue
		var line: Vector2 = (goal - start).normalized()
		var normal := Vector2(-line.y, line.x)
		var one: Vector2 = center + normal * radius
		var two: Vector2 = center - normal * radius
		var score_one: float = start.distance_to(one) + one.distance_to(goal)
		var score_two: float = start.distance_to(two) + two.distance_to(goal)
		return one if score_one <= score_two else two
	return goal
