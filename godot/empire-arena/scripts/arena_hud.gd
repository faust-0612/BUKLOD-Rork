## Responsive native Godot touch HUD: no React Native game tick or network access.
extends Control
signal start_requested(mode: String, hero: String, map_id: String, solo: bool, foe: String)
signal command_requested(action: String)
signal direction_changed(direction: Vector2)
signal zoom_requested(multiplier: float)
signal exit_requested
signal pause_requested

const HEROES := ["phan", "quin", "van", "christian", "lhen", "ace", "ellusur",
	"jawo", "mitch", "niel", "angel", "vhen", "trudice"]
const MAPS := ["genesis_rift", "aurora_foundry", "verdant_fracture"]
const MODES := ["classic_conquest", "genesis_rift", "dominion_frontier", "special_event"]
var hero_index := 0
var foe_index := 5
var map_index := 0
var mode_index := 0
var offline_solo := true
var playing := false
var paused := false
var status: Dictionary = {}
var skill_cooldowns: Dictionary = {}
var move_direction := Vector2.ZERO
var active_joystick := -1
var touch_origin := Vector2.ZERO
var event_messages: Array[String] = []
var show_result := false

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	set_process_input(true)
	set_process(true)

func set_snapshot(s: Dictionary, cooldowns: Dictionary = {}) -> void:
	status = s
	skill_cooldowns = cooldowns
	show_result = s.get("status", "active") != "active"
	queue_redraw()

func release_joystick() -> void:
	active_joystick = -1
	_set_joystick(Vector2(103, size.y - 89))

func notify(message: String) -> void:
	event_messages.push_front(message)
	if event_messages.size() > 3: event_messages.pop_back()
	queue_redraw()

func _text(at: Vector2, value: String, size: int = 18, color: Color = Color.WHITE) -> void:
	draw_string(ThemeDB.fallback_font, at, value, HORIZONTAL_ALIGNMENT_LEFT, -1, size, color)

func _panel(rect: Rect2, label: String, fill: Color = Color(0.06, 0.16, 0.23, 0.86)) -> void:
	draw_rect(rect, fill, true)
	draw_rect(rect, Color(0.65, 0.92, 0.83, 0.6), false, 1.0)
	_text(rect.position + Vector2(12, rect.size.y * 0.67), label, 17, Color(0.94, 0.99, 0.94))

func _button_at(x: float, y: float, label: String, radius: float = 29.0,
		fill: Color = Color(0.11, 0.28, 0.37, 0.87)) -> void:
	draw_circle(Vector2(x, y), radius, fill)
	draw_arc(Vector2(x, y), radius, 0, TAU, 40, Color(0.5, 0.95, 0.8, 0.9), 2.0)
	_text(Vector2(x - 23, y + 6), label, 15)

func _cooldown_ring(at: Vector2, radius: float, slot: String) -> void:
	var cd: Dictionary = skill_cooldowns.get(slot, {})
	if bool(cd.get("locked", false)):
		draw_circle(at, radius - 3.0, Color(0.02, 0.05, 0.08, 0.68))
		_text(at + Vector2(-20, 5), "LV " + str(cd.get("level_requirement", 1)), 12, Color("#ffd88f"))
		return
	var remaining: float = maxf(0.0, float(cd.get("remaining", 0.0)))
	if remaining <= 0.0:
		return
	var duration: float = maxf(0.05, float(cd.get("duration", 1.0)))
	draw_circle(at, radius - 3.0, Color(0.02, 0.05, 0.08, 0.54))
	draw_arc(at, radius - 3.0, -PI * 0.5,
		-PI * 0.5 + TAU * (1.0 - remaining / duration), 40, Color("#ffe29b"), 4.0)
	_text(at + Vector2(-11, 5), str(ceili(remaining)) + "s", 12, Color.WHITE)

func _minimap_point(world_pos: Vector2, rect: Rect2) -> Vector2:
	return rect.position + Vector2(
		clampf(world_pos.x / maxf(1.0, float(status.get("w", 1))), 0.0, 1.0) * rect.size.x,
		clampf(world_pos.y / maxf(1.0, float(status.get("h", 1))), 0.0, 1.0) * rect.size.y)

func _draw_minimap() -> void:
	if status.is_empty():
		return
	var rect := Rect2(Vector2(size.x - 188, 8), Vector2(175, 96))
	draw_rect(rect, Color(0.02, 0.1, 0.17, 0.90), true)
	draw_rect(rect, Color(0.5, 0.82, 0.83, 0.9), false, 1.0)
	for frac in [0.24, 0.5, 0.76]:
		draw_line(rect.position + Vector2(0, rect.size.y * frac),
			rect.position + Vector2(rect.size.x, rect.size.y * frac),
			Color(0.28, 0.58, 0.59, 0.5), 1.0)
	for tower in status.get("towers", []):
		if not tower.get("alive", false):
			continue
		var spot: Vector2 = _minimap_point(tower["pos"], rect)
		draw_rect(Rect2(spot - Vector2(3, 3), Vector2(6, 6)),
			Color("#6eebc0") if tower.get("team") == "A" else Color("#fb998e"))
	for actor in status.get("players", {}).values():
		if not actor.get("alive", false):
			continue
		var spot: Vector2 = _minimap_point(actor["pos"], rect)
		var radius: float = 5.0 if actor.get("id") == "A0" else 2.8
		draw_circle(spot, radius, Color("#fbe88e") if actor.get("id") == "A0" else
			Color("#69e8bd") if actor.get("team") == "A" else Color("#f59b8e"))

func _draw() -> void:
	var w: float = size.x
	var h: float = size.y
	if not playing:
		draw_rect(Rect2(Vector2.ZERO, size), Color(0.02, 0.05, 0.11, 0.9))
		draw_circle(Vector2(w * 0.5, h * 0.38), minf(w, h) * 0.43, Color(0.17, 0.3, 0.49, 0.27))
		_text(Vector2(w * 0.13, h * 0.13), "BUKLOD EMPIRE ARENA  •  GODOT 4", 24, Color(0.96, 0.84, 0.48))
		_text(Vector2(w * 0.13, h * 0.20), "NATIVE OFFLINE GAMEPLAY • NO BP / DIAMOND / RANKED REWARDS", 12, Color(0.63, 0.88, 0.85))
		_panel(Rect2(w * 0.13, h * 0.27, w * 0.33, 43), "<   HERO: " + HEROES[hero_index].to_upper() + "   >")
		_panel(Rect2(w * 0.54, h * 0.27, w * 0.33, 43), "<   CPU: " + HEROES[foe_index].to_upper() + "   >")
		_panel(Rect2(w * 0.13, h * 0.43, w * 0.33, 43), "<   MAP: " + MAPS[map_index].replace("_", " ").to_upper() + "   >")
		_panel(Rect2(w * 0.54, h * 0.43, w * 0.33, 43), "<   MODE: " + ("SOLO CPU" if offline_solo else MODES[mode_index].replace("_", " ").to_upper()) + "   >")
		_panel(Rect2(w * 0.35, h * 0.67, w * 0.3, 55), "ENTER GODOT BATTLE", Color(0.09, 0.48, 0.37, 0.98))
		_panel(Rect2(10, 8, 80, 30), "BACK")
		return
	var p: Dictionary = status.get("players", {}).get("A0", {})
	var enemy: Dictionary = status.get("players", {}).get("B0", {})
	var hp: float = float(p.get("hp", 0))
	var max_hp: float = maxf(1, float(p.get("max_hp", 1)))
	var mana: float = float(p.get("mana", 0))
	var max_mana: float = maxf(1, float(p.get("max_mana", 1)))
	_panel(Rect2(10, 8, 76, 34), "EXIT")
	_panel(Rect2(91, 8, 77, 34), "PAUSE" if not paused else "PLAY")
	draw_rect(Rect2(180, 10, 192, 12), Color(0.23, 0.17, 0.22, 0.86))
	draw_rect(Rect2(180, 10, 192 * clampf(hp / max_hp, 0, 1), 12), Color(0.34, 0.92, 0.58))
	draw_rect(Rect2(180, 26, 192, 9), Color(0.16, 0.2, 0.3))
	draw_rect(Rect2(180, 26, 192 * clampf(mana / max_mana, 0, 1), 9), Color(0.43, 0.73, 1.0))
	var shield: float = maxf(0.0, float(p.get("shield", 0.0)))
	if shield > 0.0:
		draw_rect(Rect2(180, 19, 192 * clampf(shield / 105.0, 0, 1), 5), Color("#8cf4ef"))
	_text(Vector2(384, 22), "HP " + str(ceili(hp)) + "  SH " + str(ceili(shield)) +
		"  MP " + str(ceili(mana)) + "  LV " + str(p.get("level", 1)), 13)
	if status.get("solo", false):
		_text(Vector2(384, 37), "ROUND " + str(status.get("solo_round", 1)) + "   YOU " +
			str(status.get("solo_wins", {}).get("A", 0)) + " : " +
			str(status.get("solo_wins", {}).get("B", 0)) + " CPU  HP " + str(ceili(float(enemy.get("hp", 0)))), 13)
	else:
		var pool: Dictionary = status.get("team", {}).get("A", {})
		_text(Vector2(384, 37), "WOOD " + str(roundi(float(pool.get("wood", 0)))) +
			"   GOLD " + str(roundi(float(pool.get("gold", 0)))) +
			"   STONE " + str(roundi(float(pool.get("stone", 0)))), 13)
	_button_at(103, h - 89, "+", 72, Color(0.1, 0.24, 0.32, 0.42))
	draw_circle(Vector2(103, h - 89) + move_direction * 35.0, 26.0, Color(0.48, 0.95, 0.82, 0.65))
	_button_at(w - 92, h - 92, "ATK", 39, Color(0.64, 0.23, 0.21, 0.88))
	_button_at(w - 194, h - 69, "S1", 29)
	_button_at(w - 182, h - 143, "S2", 29)
	_button_at(w - 92, h - 184, "ULT", 34, Color(0.54, 0.32, 0.68, 0.9))
	_cooldown_ring(Vector2(w - 92, h - 92), 39, "attack")
	_cooldown_ring(Vector2(w - 194, h - 69), 29, "primary")
	_cooldown_ring(Vector2(w - 182, h - 143), 29, "secondary")
	_cooldown_ring(Vector2(w - 92, h - 184), 34, "ultimate")
	_draw_minimap()
	_panel(Rect2(w - 105, 108, 92, 32), "ZOOM +")
	_button_at(w - 292, h - 53, "GET", 27)
	if not status.get("solo", false):
		_button_at(w - 290, h - 118, "MINE", 27)
		_button_at(w - 363, h - 80, "UNIT", 26)
		_button_at(w - 357, h - 146, "BUILD", 27)
	_text(Vector2(w * 0.48, h - 12), status.get("map", "").replace("_", " ").to_upper() +
		"  •  " + str(int(status.get("time", 0))) + "s", 13)
	if not event_messages.is_empty():
		_text(Vector2(180, 65), event_messages.front(), 14, Color(1, 0.89, 0.54))
	if show_result:
		draw_rect(Rect2(w * 0.29, h * 0.30, w * 0.42, h * 0.33), Color(0.03, 0.11, 0.19, 0.96))
		_text(Vector2(w * 0.35, h * 0.43), "RESULT: " + str(status.get("winner", "DRAW")), 25, Color(0.99, 0.85, 0.45))
		_text(Vector2(w * 0.35, h * 0.54), "TAP TO RETURN", 17)

func _menu_tap(at: Vector2) -> void:
	var w: float = size.x
	var h: float = size.y
	if at.y < 44 and at.x < 100:
		exit_requested.emit()
	elif at.x >= w * 0.13 and at.x <= w * 0.46 and at.y >= h * 0.27 and at.y <= h * 0.27 + 43:
		hero_index = (hero_index + 1) % HEROES.size()
	elif at.x >= w * 0.54 and at.x <= w * 0.87 and at.y >= h * 0.27 and at.y <= h * 0.27 + 43:
		foe_index = (foe_index + 1) % HEROES.size()
	elif at.x >= w * 0.13 and at.x <= w * 0.46 and at.y >= h * 0.43 and at.y <= h * 0.43 + 43:
		map_index = (map_index + 1) % MAPS.size()
	elif at.x >= w * 0.54 and at.x <= w * 0.87 and at.y >= h * 0.43 and at.y <= h * 0.43 + 43:
		if offline_solo:
			offline_solo = false
			mode_index = 0
		else:
			mode_index = (mode_index + 1) % MODES.size()
			if mode_index == 0:
				offline_solo = true
	elif at.x >= w * 0.35 and at.x <= w * 0.65 and at.y >= h * 0.67 and at.y <= h * 0.67 + 55:
		playing = true
		show_result = false
		start_requested.emit(MODES[mode_index], HEROES[hero_index], MAPS[map_index], offline_solo, HEROES[foe_index])
	queue_redraw()

func _game_tap(at: Vector2) -> void:
	var w: float = size.x
	var h: float = size.y
	if show_result:
		playing = false
		show_result = false
		release_joystick()
		queue_redraw()
		return
	if at.y < 45 and at.x < 87: exit_requested.emit(); return
	if at.y < 45 and at.x < 174: pause_requested.emit(); return
	if paused:
		return
	if Rect2(w - 105, 108, 92, 32).has_point(at):
		zoom_requested.emit(1.2)
		return
	if Rect2(w - 188, 8, 175, 96).has_point(at):
		return
	for b in [
		{"id": "attack", "p": Vector2(w - 92, h - 92), "r": 43.0},
		{"id": "primary", "p": Vector2(w - 194, h - 69), "r": 34.0},
		{"id": "secondary", "p": Vector2(w - 182, h - 143), "r": 34.0},
		{"id": "ultimate", "p": Vector2(w - 92, h - 184), "r": 38.0},
		{"id": "loot", "p": Vector2(w - 292, h - 53), "r": 32.0},
		{"id": "mine", "p": Vector2(w - 290, h - 118), "r": 32.0},
		{"id": "train", "p": Vector2(w - 363, h - 80), "r": 32.0},
		{"id": "build", "p": Vector2(w - 357, h - 146), "r": 32.0}
	]:
		if at.distance_to(b["p"]) <= b["r"]:
			if status.get("solo", false) and b["id"] in ["mine", "train", "build"]:
				return
			command_requested.emit(b["id"])
			return
	queue_redraw()

func _set_joystick(at: Vector2) -> void:
	move_direction = (at - Vector2(103, size.y - 89)).limit_length(72) / 72.0
	direction_changed.emit(move_direction)
	queue_redraw()

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			if not playing:
				_menu_tap(event.position)
			elif not paused and active_joystick == -1 and event.position.x < 195 and event.position.y > size.y * 0.48:
				active_joystick = event.index
				_set_joystick(event.position)
			else:
				_game_tap(event.position)
		elif active_joystick == event.index:
			active_joystick = -1
			_set_joystick(Vector2(103, size.y - 89))
	elif event is InputEventScreenDrag and event.index == active_joystick:
		_set_joystick(event.position)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			if not playing: _menu_tap(event.position)
			elif not paused and active_joystick == -1 and event.position.x < 195 and event.position.y > size.y * 0.48:
				active_joystick = 0
				_set_joystick(event.position)
			else: _game_tap(event.position)
		elif active_joystick == 0:
			active_joystick = -1
			_set_joystick(Vector2(103, size.y - 89))
	elif event is InputEventMouseMotion and active_joystick == 0:
		_set_joystick(event.position)
