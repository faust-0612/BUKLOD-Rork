extends Node2D
## Godot-native, deterministic OFFLINE practice prototype. NOT ranked gameplay.
## Initial migration foundation only. Does not replace the full JS Arena yet.
const HEROES := ["phan", "quin", "van", "christian", "lhen", "ace", "ellusur", "jawo", "mitch", "niel", "angel", "vhen", "trudice"]
const TICK_SECONDS := 0.1
const MATCH_SECONDS := 90.0
const HERO_SPEED := 165.0
const HERO_RANGE := 70.0
const HERO_DAMAGE := 12.0
const HERO_COOLDOWN := 0.6

var rng := RandomNumberGenerator.new()
var elapsed := 0.0
var accumulator := 0.0
var status := "active"
var local_hero := "phan"
var cpu_hero := "ace"
var local_hp := 180.0
var cpu_hp := 180.0
var local_position := Vector2(330, 360)
var cpu_position := Vector2(950, 360)
var local_cooldown := 0.0
var cpu_cooldown := 0.0
var attack_pressed := false
var move_vector := Vector2.ZERO
var cpu_think := 0.0
var winner := ""
var hud: Label

func _ready() -> void:
	rng.seed = 20261122
	hud = Label.new()
	hud.position = Vector2(20, 15)
	hud.add_theme_font_size_override("font_size", 22)
	add_child(hud)
	queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		attack_pressed = event.pressed
	elif event is InputEventScreenDrag:
		move_vector = (event.relative / 20.0).limit_length(1.0)
	elif event is InputEventKey and event.pressed and event.keycode == KEY_SPACE:
		attack_pressed = true

func _process(delta: float) -> void:
	if status != "active":
		_draw_hud()
		return
	accumulator += minf(delta, 0.25)
	while accumulator >= TICK_SECONDS:
		accumulator -= TICK_SECONDS
		_simulate(TICK_SECONDS)
	_draw_hud()
	queue_redraw()

func _simulate(dt: float) -> void:
	elapsed += dt
	local_cooldown = maxf(0.0, local_cooldown - dt)
	cpu_cooldown = maxf(0.0, cpu_cooldown - dt)
	cpu_think -= dt
	var keyboard_direction := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	var direction := keyboard_direction if keyboard_direction.length_squared() > 0 else move_vector
	local_position = _clamp_position(local_position + direction.limit_length(1.0) * HERO_SPEED * dt)
	if cpu_think <= 0.0:
		cpu_think = 0.35
		var toward := local_position - cpu_position
		if toward.length() > HERO_RANGE * 0.85:
			cpu_position = _clamp_position(cpu_position + toward.normalized() * HERO_SPEED * 0.35)
	if attack_pressed and local_cooldown <= 0.0 and local_position.distance_to(cpu_position) <= HERO_RANGE:
		cpu_hp = maxf(0.0, cpu_hp - HERO_DAMAGE)
		local_cooldown = HERO_COOLDOWN
		attack_pressed = false
	if cpu_cooldown <= 0.0 and cpu_position.distance_to(local_position) <= HERO_RANGE:
		local_hp = maxf(0.0, local_hp - HERO_DAMAGE)
		cpu_cooldown = HERO_COOLDOWN
	if local_hp <= 0.0 or cpu_hp <= 0.0 or elapsed >= MATCH_SECONDS:
		status = "finished"
		if local_hp > cpu_hp:
			winner = "A"
		elif cpu_hp > local_hp:
			winner = "B"
		else:
			winner = "draw"

func _clamp_position(pos: Vector2) -> Vector2:
	return Vector2(clampf(pos.x, 48.0, 1232.0), clampf(pos.y, 80.0, 672.0))

func _draw_hud() -> void:
	hud.text = "OFFLINE GODOT PRACTICE   %s HP: %d   %s HP: %d   %ds%s" % [local_hero, int(local_hp), cpu_hero, int(cpu_hp), int(elapsed), ("   RESULT: " + winner) if status == "finished" else ""]

func _draw() -> void:
	draw_rect(Rect2(0, 0, 1280, 720), Color("#101d33"))
	for i in range(9):
		draw_line(Vector2(0, 90 + i * 65), Vector2(1280, 90 + i * 65), Color("#223c51"), 1.0)
	draw_circle(Vector2(640, 360), 130, Color("#1a334a"))
	draw_circle(local_position, 22, Color("#67ddac"))
	draw_circle(cpu_position, 22, Color("#ef7b82"))
	draw_arc(local_position, HERO_RANGE, 0.0, TAU, 48, Color("#5ea997", 0.3), 1.0)
