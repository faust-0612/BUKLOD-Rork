## Godot 4.7.2 offline scene and simultaneous two-finger input smoke test.
extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _check(ok: bool, reason: String, code: int) -> bool:
	if not ok:
		push_error("BUKLOD_GODOT_TOUCH_FAIL: " + reason)
		quit(code)
	return ok

func _touch(hud: Control, id: int, pos: Vector2, pressed: bool) -> void:
	var event := InputEventScreenTouch.new()
	event.index = id
	event.position = pos
	event.pressed = pressed
	hud._gui_input(event)

func _drag(hud: Control, id: int, pos: Vector2) -> void:
	var event := InputEventScreenDrag.new()
	event.index = id
	event.position = pos
	hud._gui_input(event)

func _run() -> void:
	var packed: PackedScene = load("res://scenes/ArenaTouchTest.tscn")
	if not _check(packed != null, "touch scene imports", 1): return
	var game: Node2D = packed.instantiate()
	root.add_child(game)
	await process_frame
	var hud: Control = game.get_node("CanvasLayer/Hud")
	hud.size = Vector2(1280, 720)
	if not _check(game.sim.available() and hud.HEROES.size() == 13, "offline catalog and hero roster", 2): return
	hud._menu_tap(Vector2(640, 500))
	if not _check(game.running and hud.playing and game.sim.state.get("solo", false), "offline CPU scene launches", 3): return
	var commands: Array[String] = []
	hud.command_requested.connect(func(cmd: String): commands.append(cmd))
	_touch(hud, 7, Vector2(103, 631), true)
	_drag(hud, 7, Vector2(173, 631))
	if not _check(hud.active_joystick == 7 and hud.move_direction.x > 0.9, "finger 7 joystick", 4): return
	_touch(hud, 8, Vector2(110, 631), true)
	if not _check(hud.active_joystick == 7, "second finger cannot steal joystick", 5): return
	_touch(hud, 8, Vector2(110, 631), false)
	_touch(hud, 8, Vector2(1086, 651), true)
	if not _check(commands.size() == 1 and commands.back() == "primary" and hud.active_joystick == 7, "skill while moving", 6): return
	_touch(hud, 8, Vector2(1086, 651), false)
	_touch(hud, 7, Vector2(173, 631), false)
	if not _check(hud.active_joystick == -1 and hud.move_direction.is_zero_approx(), "release stops movement", 7): return
	game._pause()
	_touch(hud, 9, Vector2(173, 631), true)
	if not _check(hud.active_joystick == -1 and hud.move_direction.is_zero_approx(), "pause blocks movement", 8): return
	game._pause()
	var hero: Dictionary = game.sim.actor("A0")
	var foe: Dictionary = game.sim.actor("B0")
	foe["pos"] = (hero["pos"] as Vector2) + Vector2(2, 0)
	game._command("attack")
	var cd: Dictionary = game.sim.cooldown_snapshot("A0")
	if not _check(cd.has("primary") and cd.has("ultimate") and float(cd["attack"]["remaining"]) > 0.0 and hud.skill_cooldowns.has("attack"), "combat-clock cooldown feeds UI", 9): return
	if not _check(hud._minimap_point(Vector2.ZERO, Rect2(100, 10, 175, 96)) == Vector2(100, 10), "minimap scales positions", 10): return
	game._start("classic_conquest", "phan", "genesis_rift", false, "ace")
	if not _check(game.running and game.sim.state["towers"].size() == 6 and game.sim.state["units"].size() >= 12, "scene instantiates lanes towers and villagers", 11): return
	print("BUKLOD_GODOT_TOUCH_PASS: scene / hero select / two-finger controls / pause / cooldown / minimap / towers / villagers")
	quit(0)
