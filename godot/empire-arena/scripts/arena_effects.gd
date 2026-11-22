## GPU-friendly transient combat VFX: capped sprites, event-specific palettes.
## Godot Arena remains offline-practice-only. Visual events cannot mint rewards.
extends Node2D

const IMPACT_SHADER = preload("res://shaders/arena_impact.gdshader")
const LIMIT := 28
const PX := 10.0
var active: Array[Dictionary] = []
var white_texture: Texture2D

func _ready() -> void:
	var bitmap := Image.create(64, 64, false, Image.FORMAT_RGBA8)
	bitmap.fill(Color.WHITE)
	white_texture = ImageTexture.create_from_image(bitmap)
	set_process(true)

func clear() -> void:
	for item in active:
		var sprite: Sprite2D = item["sprite"]
		if is_instance_valid(sprite):
			sprite.queue_free()
	active.clear()

func _style(kind: String) -> Dictionary:
	match kind:
		"damage": return {"color": Color("#ff755d"), "size": 44.0, "life": 0.32}
		"skill": return {"color": Color("#72caff"), "size": 78.0, "life": 0.58}
		"defeat": return {"color": Color("#ffd27a"), "size": 112.0, "life": 0.82}
		"seal_damage": return {"color": Color("#ff9478"), "size": 144.0, "life": 0.75}
		"field_pickup_drop": return {"color": Color("#e6d1ff"), "size": 70.0, "life": 0.52}
		"field_pickup_claimed": return {"color": Color("#9afac2"), "size": 102.0, "life": 0.68}
		"construction_start": return {"color": Color("#ffdd8d"), "size": 64.0, "life": 0.48}
		"construction_complete": return {"color": Color("#90e9b7"), "size": 96.0, "life": 0.65}
		"level_up": return {"color": Color("#e8c3ff"), "size": 130.0, "life": 0.78}
		"respawn": return {"color": Color("#96c6ff"), "size": 120.0, "life": 0.75}
	return {}

func play_event(kind: String, world_position: Vector2) -> void:
	var style: Dictionary = _style(kind)
	if style.is_empty() or white_texture == null:
		return
	while active.size() >= LIMIT:
		var oldest: Dictionary = active.pop_front()
		var previous: Sprite2D = oldest["sprite"]
		if is_instance_valid(previous):
			previous.queue_free()
	var sprite := Sprite2D.new()
	sprite.texture = white_texture
	sprite.position = world_position * PX
	sprite.scale = Vector2.ONE * (float(style["size"]) / 64.0 * 0.5)
	var mat := ShaderMaterial.new()
	mat.shader = IMPACT_SHADER
	mat.set_shader_parameter("energy_color", style["color"])
	mat.set_shader_parameter("phase", 0.0)
	mat.set_shader_parameter("variation", float(active.size()) * 0.41)
	sprite.material = mat
	add_child(sprite)
	active.append({"sprite": sprite, "age": 0.0,
		"lifetime": float(style["life"]), "size": float(style["size"])})

func _process(delta: float) -> void:
	var dt: float = minf(delta, 0.065)
	for i in range(active.size() - 1, -1, -1):
		var item: Dictionary = active[i]
		var sprite: Sprite2D = item["sprite"]
		if not is_instance_valid(sprite):
			active.remove_at(i)
			continue
		item["age"] = float(item["age"]) + dt
		var phase: float = clampf(float(item["age"]) / float(item["lifetime"]), 0.0, 1.0)
		if phase >= 1.0:
			sprite.queue_free()
			active.remove_at(i)
			continue
		sprite.scale = Vector2.ONE * (float(item["size"]) / 64.0 * (0.5 + 0.7 * phase))
		var mat: ShaderMaterial = sprite.material
		mat.set_shader_parameter("phase", phase)
