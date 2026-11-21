## Draws the real Godot scene: terrain, living actors, health, VFX and drops.
## Physics and commands are owned by BuklodArenaSimulation; never by React Native.
extends Node2D

const SIM_SCRIPT = preload("res://scripts/arena_simulation.gd")
const PX := 10.0
const HEROSUIT := [Color("#7bf2cb"), Color("#75c9ff"), Color("#ffc68b"),
	Color("#d6b7ff"), Color("#f7ed8f"), Color("#ff9aa8"),
	Color("#a4f8ef"), Color("#e3ba84"), Color("#a7d2ff"),
	Color("#ffacbd"), Color("#e7c7f4"), Color("#b9df89"), Color("#f3b3cb")]

@onready var camera: Camera2D = $Camera2D
@onready var hud: Control = $CanvasLayer/Hud
var sim: BuklodArenaSimulation
var running := false
var paused := false
var input_vector := Vector2.ZERO
var aim_vector := Vector2.RIGHT
var scale_zoom := 1.0
var frames := 0.0
var accumulator := 0.0
var event_cursor := -1
var flashes: Array[Dictionary] = []
var art_cache: Dictionary = {}
var actor_pose: Dictionary = {}
var actor_last_pos: Dictionary = {}

# Godot-decoded PNG previews in signed main pack; bounded lazy GPU cache.
func _art(path: String) -> Texture2D:
	if art_cache.has(path):
		return art_cache[path]
	var bitmap: Image = Image.load_from_file(path)
	if bitmap == null or bitmap.is_empty():
		art_cache[path] = null
		return null
	if art_cache.size() >= 24:
		art_cache.erase(art_cache.keys().front())
	var texture: Texture2D = ImageTexture.create_from_image(bitmap)
	art_cache[path] = texture
	return texture


func _ready() -> void:
	sim = SIM_SCRIPT.new()
	hud.start_requested.connect(_start)
	hud.command_requested.connect(_command)
	hud.direction_changed.connect(_move)
	hud.zoom_requested.connect(_zoom)
	hud.pause_requested.connect(_pause)
	hud.exit_requested.connect(_exit)
	if not sim.available():
		hud.notify("FAILED: canonical 13-hero / 300-pickup data not bundled")
	set_process(true)
	set_physics_process(true)

func _exit() -> void:
	# GodotActivity returns to the React Native host; no app-wide termination.
	get_tree().quit(0)

func _start(mode: String, hero: String, map_id: String, solo: bool, foe: String) -> void:
	if not sim.begin("duel" if solo else mode, hero, map_id, solo, foe):
		hud.notify("Arena data validation failed. No match started.")
		hud.playing = false
		return
	running = true
	paused = false
	hud.paused = false
	event_cursor = -1
	flashes.clear()
	actor_pose.clear()
	actor_last_pos.clear()
	camera.position = (sim.actor("A0")["pos"] as Vector2) * PX
	_update_zoom()
	hud.set_snapshot(sim.state)
	hud.notify("OFFLINE ONLY • no ranked rewards")

func _pause() -> void:
	paused = not paused
	hud.paused = paused
	hud.notify("PAUSED" if paused else "RESUMED")

func _move(direction: Vector2) -> void:
	input_vector = direction
	if direction.length_squared() > 0.02:
		aim_vector = direction.normalized()

func _zoom(factor: float) -> void:
	scale_zoom = clampf(scale_zoom * factor, 0.65, 2.6)
	_update_zoom()

func _update_zoom() -> void:
	var width := maxf(320, get_viewport_rect().size.x)
	var base: float = clampf(width / 900.0, 0.5, 1.1)
	camera.zoom = Vector2.ONE * base * scale_zoom

func _command(name: String) -> void:
	if not running or paused or sim.state.get("status") != "active":
		return
	var cmd: String = name
	var target_id := ""
	if name == "train": target_id = "warrior"
	if name == "build": target_id = "watchtower"
	if name == "attack" or name in ["primary", "secondary", "ultimate"]:
		var me: Dictionary = sim.actor("A0")
		var enemies: Array = sim.state["players"].values().filter(func(p):
			return p["team"] != "A" and p["alive"])
		enemies.sort_custom(func(a, b):
			return (a["pos"] as Vector2).distance_to(me["pos"]) < (b["pos"] as Vector2).distance_to(me["pos"]))
		if not enemies.is_empty():
			target_id = str(enemies.front()["id"])
			var dir: Vector2 = enemies.front()["pos"] - me["pos"]
			if dir.length_squared() > 0.02:
				aim_vector = dir.normalized()
	var accepted: bool = sim.action("A0", cmd, aim_vector, target_id)
	if not accepted:
		hud.notify("Action unavailable: range, cooldown, resources or level")
	else:
		hud.set_snapshot(sim.state)

func _physics_process(delta: float) -> void:
	if not running or paused or sim.state.get("status") != "active":
		return
	# Bound catchup on slow devices. Never cause a 5-second offline attack burst.
	accumulator = minf(0.35, accumulator + delta)
	var steps := 0
	while accumulator >= sim.STEP and steps < 3:
		accumulator -= sim.STEP
		steps += 1
		sim.advance()
		if sim.state["status"] != "active":
			break
		if input_vector.length_squared() > 0.02:
			sim.action("A0", "move", input_vector)
	if sim.state["tick"] % 2 == 0:
		hud.set_snapshot(sim.state)
	_read_events()

func _read_events() -> void:
	for event in sim.state.get("events", []):
		if int(event["id"]) <= event_cursor:
			continue
		event_cursor = int(event["id"])
		if event["type"] in ["damage", "skill"]:
			var id: String = str(event.get("actor", event.get("from", "")))
			if id != "":
				actor_pose[id] = {"pose": "skill" if event["type"] == "skill" else "attack",
					"until": frames + 0.45}
		if event.has("pos") and event["pos"] is Vector2:
			flashes.append({"pos": event["pos"], "time": frames, "type": event["type"]})
		if event["type"] in ["level_up", "construction_complete", "seal_damage",
				"field_pickup_claimed", "solo_round_end", "result", "minion_wave",
				"tower_destroyed", "minion_heal", "minion_siege_hit"]:
			hud.notify(str(event["type"]).replace("_", " ").to_upper())
	while flashes.size() > 30:
		flashes.pop_front()

func _process(delta: float) -> void:
	frames += minf(0.06, delta)
	if running and not sim.state.is_empty():
		var me := sim.actor("A0")
		if me.has("pos"):
			camera.position = camera.position.lerp((me["pos"] as Vector2) * PX, clampf(delta * 8.0, 0.0, 1.0))
	for f in flashes.duplicate():
		if frames - float(f["time"]) > 1.0:
			flashes.erase(f)
	queue_redraw()

func _suit_color(hero: String) -> Color:
	var idx: int = max(0, hud.HEROES.find(hero))
	return HEROSUIT[idx % HEROSUIT.size()]

func _draw_actor(p: Dictionary) -> void:
	if not p.get("alive", false):
		return
	var pos: Vector2 = p["pos"] * PX
	var team: String = p.get("team", "A")
	var is_hero: bool = p.get("kind", "") == "hero"
	var large := 11.5 if is_hero else 6.0
	var color: Color = _suit_color(p.get("hero", "phan")) if is_hero else \
		Color("#7de8d0") if team == "A" else Color("#f39a92")
	if not is_hero:
		match str(p.get("kind", "")):
			"vanguard": large = 8.0
			"ranger": large = 6.0
			"mender":
				large = 7.0
				color = color.lightened(0.28)
			"siege_breaker":
				large = 10.0
				color = color.darkened(0.24)
	var breath: float = sin(frames * (3.0 if is_hero else 5.0) + float(pos.x) * 0.15)
	var shift := Vector2(0, breath * 1.2)
	draw_circle(pos + Vector2(0, 8), large * 1.1, Color(0, 0, 0, 0.35))
	draw_circle(pos + shift, large, color.darkened(0.35))
	draw_circle(pos + shift - Vector2(0, large * 0.33), large * 0.62, color)
	draw_line(pos + shift + Vector2(-large, 2), pos + shift + Vector2(-large * 1.55, 5 + breath * 2), color, 3.0)
	draw_line(pos + shift + Vector2(large, 2), pos + shift + Vector2(large * 1.55, 5 - breath * 2), color, 3.0)
	draw_circle(pos + shift - Vector2(large * 0.18, large * 0.36), 1.25, Color("#0c1f2c"))
	draw_circle(pos + shift + Vector2(large * 0.18, -large * 0.36), 1.25, Color("#0c1f2c"))
	if not is_hero:
		var kind: String = str(p.get("kind", ""))
		match kind:
			"vanguard":
				draw_arc(pos + shift, large + 2, -PI * 0.8, PI * 0.8, 20, Color("#f8edbd"), 2.0)
			"ranger":
				draw_line(pos + Vector2(0, -large - 5), pos + Vector2(0, -large + 1), Color("#f2e99d"), 2.0)
			"mender":
				draw_line(pos + Vector2(-4, -large), pos + Vector2(4, -large), Color.WHITE, 2.0)
				draw_line(pos + Vector2(0, -large - 4), pos + Vector2(0, -large + 4), Color.WHITE, 2.0)
			"siege_breaker":
				draw_rect(Rect2(pos + Vector2(-7, -large - 5), Vector2(14, 6)), Color("#f6ce7f"))
	if is_hero:
		var hero_id: String = str(p.get("hero", "phan"))
		var portrait: Texture2D = _art("res://art/sprite/" + hero_id + ".png")
		if portrait != null:
			var old_pos: Vector2 = actor_last_pos.get(p["id"], pos)
			var walking: bool = old_pos.distance_to(pos) > 0.9
			actor_last_pos[p["id"]] = pos
			var last_pose: Dictionary = actor_pose.get(p["id"], {})
			var pose: String = str(last_pose.get("pose", "walk" if walking else "idle")) if float(last_pose.get("until", 0)) > frames else ("walk" if walking else "idle")
			# Fullbody source contains four approved distinct poses, not fake frame indicators.
			var frame_texture: Texture2D = _art("res://art/fullbody/" + hero_id + "_" + pose + ".png")
			var destination := Rect2(pos + Vector2(-large * 1.95, -large * 2.8 + breath * 1.1),
				Vector2(large * 3.9, large * 3.9))
			if frame_texture != null:
				# Four columns / two rows, eight actual frames from each approved animation.
				var idx: int = posmod(int(frames * 8.0) + int(pos.x * 0.2), 8)
				var cell := Vector2(float(frame_texture.get_width()) * 0.25,
					float(frame_texture.get_height()) * 0.5)
				var region := Rect2(Vector2(float(idx % 4) * cell.x,
					float(idx / 4) * cell.y), cell)
				draw_texture_rect_region(frame_texture, destination, region,
					Color(1, 1, 1, 0.98))
			else:
				draw_texture_rect(portrait, destination, false, Color(1, 1, 1, 0.98))
		draw_arc(pos, large + 4.0, -PI, PI, 30,
			Color("#6af7ca") if team == "A" else Color("#ff9b8c"), 2.0)
		draw_string(ThemeDB.fallback_font, pos + Vector2(-18, -large - 16),
			str(p["hero"]).to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color.WHITE)
	var ratio: float = clampf(float(p.get("hp", 1)) / maxf(1, float(p.get("max_hp", 1))), 0.0, 1.0)
	draw_rect(Rect2(pos + Vector2(-large, large + 6), Vector2(large * 2, 3.0)), Color("#542e33"))
	draw_rect(Rect2(pos + Vector2(-large, large + 6), Vector2(large * 2 * ratio, 3.0)),
		Color("#53e8a3") if team == "A" else Color("#ffad89"))

func _draw_world() -> void:
	var s: Dictionary = sim.state
	var w: float = float(s["w"]) * PX
	var h: float = float(s["h"]) * PX
	var map: Dictionary = sim.config["maps"][s["map"]]
	var colors: Array = map["colors"]
	var ground := Color(str(colors[0]))
	var lane := Color(str(colors[1]))
	draw_rect(Rect2(Vector2(-100, -100), Vector2(w + 200, h + 200)), ground)
	var scenery: Texture2D = _art("res://art/scene/" + str(s["map"]) + ".png")
	if scenery != null:
		draw_texture_rect(scenery, Rect2(Vector2.ZERO, Vector2(w, h)), false,
			Color(1.0, 1.0, 1.0, 0.82))
	draw_circle(Vector2(w * 0.5, h * 0.5), w * 0.35, lane * Color(1, 1, 1, 0.3))
	for i in range(3):
		var y: float = h * float(map["lanes"][i])
		draw_line(Vector2(0, y), Vector2(w, y), lane.lightened(0.35), 25)
		draw_line(Vector2(0, y), Vector2(w, y), Color(0.51, 0.86, 0.83, 0.45), 2)
	for i in range(80):
		var x := fposmod(float(i * 157 + 17), w)
		var y := fposmod(float(i * 113 + 31), h)
		draw_circle(Vector2(x, y), float(1 + i % 2), Color(0.7, 0.89, 1.0, 0.19 + 0.1 * sin(frames + i)))
	for cover in s["cover"]:
		var pos: Vector2 = cover["pos"] * PX
		var radius: float = float(cover["radius"]) * PX
		draw_circle(pos, radius + 7.0, Color(0.42, 0.74, 0.98, 0.16))
		draw_colored_polygon(PackedVector2Array([pos + Vector2(0, -radius),
			pos + Vector2(radius * 0.7, 0), pos + Vector2(0, radius),
			pos + Vector2(-radius * 0.7, 0)]), Color("#67baf3"))
		draw_line(pos + Vector2(0, -radius), pos + Vector2(0, radius), Color(0.9, 0.98, 1.0, 0.7), 2)
	for node in s["nodes"]:
		var pos: Vector2 = node["pos"] * PX
		var color := Color("#7fe9a1") if node["type"] == "wood" else Color("#fbd67a") if node["type"] == "gold" else Color("#bdc0e7")
		draw_circle(pos, 24, color * Color(1, 1, 1, 0.18))
		draw_colored_polygon(PackedVector2Array([pos + Vector2(0, -18), pos + Vector2(14, 5),
			pos + Vector2(0, 17), pos + Vector2(-14, 5)]), color)
	for building in s["buildings"]:
		if not building.get("alive", false): continue
		var pos: Vector2 = building["pos"] * PX
		var color: Color = Color("#55cda7") if building["team"] == "A" else Color("#dd807c")
		var progress: float = float(building.get("progress", 1))
		draw_rect(Rect2(pos - Vector2(20, 16), Vector2(40, 32)), color.darkened(0.65))
		draw_rect(Rect2(pos - Vector2(16, 12), Vector2(32 * progress, 24 * progress)), color)
		draw_string(ThemeDB.fallback_font, pos + Vector2(-28, 28), str(building["kind"]), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color.WHITE)
	for tower in s["towers"]:
		if not tower.get("alive", false): continue
		var pos: Vector2 = tower["pos"] * PX
		var color: Color = Color("#65e4b1") if tower["team"] == "A" else Color("#fa887e")
		draw_circle(pos, 28, color.darkened(0.65))
		draw_colored_polygon(PackedVector2Array([pos + Vector2(-15, 18), pos + Vector2(-13, -24),
			pos + Vector2(0, -38), pos + Vector2(13, -24), pos + Vector2(15, 18)]), color)
		draw_circle(pos + Vector2(0, -23), 6 + 2 * sin(frames * 4), Color("#fcf0b6"))
	for unit in s["units"]:
		_draw_actor(unit)
	for minion in s.get("minions", []):
		_draw_actor(minion)
	for hero in s["players"].values():
		_draw_actor(hero)
	for drop in s["loot"]:
		var pos: Vector2 = drop["pos"] * PX
		var pulse: float = 8.0 + sin(frames * 6 + pos.x) * 3.0
		draw_circle(pos, pulse + 7, Color(0.99, 0.76, 0.35, 0.22))
		draw_colored_polygon(PackedVector2Array([pos + Vector2(0, -pulse), pos + Vector2(pulse, 0),
			pos + Vector2(0, pulse), pos + Vector2(-pulse, 0)]), Color("#ffdc74"))
	for team in ["A", "B"]:
		var seal: Dictionary = s["seals"][team]
		var pos: Vector2 = Vector2(14 if team == "A" else s["w"] - 14, s["h"] * 0.5) * PX
		var color: Color = Color("#54f9cb") if team == "A" else Color("#ff9a89")
		draw_circle(pos, 44 + sin(frames * 2.5) * 5, color * Color(1, 1, 1, 0.14))
		draw_circle(pos, 20, color)
		draw_arc(pos, 35, 0, TAU * clampf(float(seal["hp"]) / 1050.0, 0, 1), 50, color, 5)
	for flash in flashes:
		var elapsed: float = frames - float(flash["time"])
		var where: Vector2 = flash["pos"] * PX
		draw_arc(where, 12 + elapsed * 48, 0, TAU, 36,
			Color(1, 0.82, 0.44, clampf(1.0 - elapsed, 0, 1)), 3)

func _draw() -> void:
	if sim == null or sim.state.is_empty():
		return
	_draw_world()
