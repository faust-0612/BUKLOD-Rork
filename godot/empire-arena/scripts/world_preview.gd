## Shared, scene-native BUKLOD Genesis world explorer; PREVIEW ONLY.
## Does not read client wallets, infer ownership, or write any permanent progress.
## Same Godot AAR + signed main pack hosts Arena, Kingdom, Community and House.
extends Node2D

const WORLD_ART := {
	"kingdom": "res://world-art/kingdom.webp",
	"community": "res://world-art/community.webp",
	"house": "res://world-art/house.webp"
}
const WORLD_TITLES := {"kingdom": "KINGDOM", "community": "PERSONAL COMMUNITY", "house": "PERSONAL HOUSE & LOT"}
const STAGES := ["Markers", "Foundation", "Framework", "Structure", "Finishing"]
const MAX_LEVEL := 10

var world_id: String = "kingdom"
var preview_level: int = 1
var preview_stage: int = 0
var preview_mastery: int = 0
var elapsed: float = 0.0
var image_texture: Texture2D
var music_enabled: bool = true
var max_quality: bool = false
var audio: AudioStreamPlayer
var hud_status: Label
var interaction_notice := ""

func _ready() -> void:
	for arg in OS.get_cmdline_user_args():
		var value: String = str(arg)
		if value.begins_with("--buklod-world="):
			var candidate: String = value.trim_prefix("--buklod-world=")
			if WORLD_ART.has(candidate):
				world_id = candidate
	Engine.max_fps = 30
	# The 2D authored world art is source-grounded, not a substitute for 3D meshes.
	_load_backdrop()
	_create_controls()
	set_process(true)
	queue_redraw()

func _load_backdrop() -> void:
	# Godot main ZIP contains original WebP bytes, not imported .ctex files.
	# Decode that verified bundled source explicitly on Android.
	var webp_bytes: PackedByteArray = FileAccess.get_file_as_bytes(str(WORLD_ART[world_id]))
	if webp_bytes.is_empty():
		return
	var bitmap: Image = Image.new()
	if bitmap.load_webp_from_buffer(webp_bytes) == OK and not bitmap.is_empty():
		image_texture = ImageTexture.create_from_image(bitmap)

func _create_controls() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var title := Label.new()
	title.position = Vector2(32, 20)
	title.text = "BUKLOD GENESIS  /  " + str(WORLD_TITLES[world_id])
	title.add_theme_font_size_override("font_size", 28)
	layer.add_child(title)
	hud_status = Label.new()
	hud_status.position = Vector2(32, 64)
	hud_status.add_theme_font_size_override("font_size", 17)
	layer.add_child(hud_status)
	var back := Button.new()
	back.text = "BACK TO BUKLOD"
	back.position = Vector2(1000, 20)
	back.custom_minimum_size = Vector2(240, 55)
	back.pressed.connect(func() -> void: get_tree().quit())
	layer.add_child(back)
	var previous := Button.new()
	previous.text = "LEVEL -"
	previous.position = Vector2(44, 630)
	previous.custom_minimum_size = Vector2(150, 54)
	previous.pressed.connect(func() -> void: change_preview_level(-1))
	layer.add_child(previous)
	var next := Button.new()
	next.text = "LEVEL +"
	next.position = Vector2(215, 630)
	next.custom_minimum_size = Vector2(150, 54)
	next.pressed.connect(func() -> void: change_preview_level(1))
	layer.add_child(next)
	var stage_button := Button.new()
	stage_button.text = "NEXT BUILD STAGE"
	stage_button.position = Vector2(386, 630)
	stage_button.custom_minimum_size = Vector2(232, 54)
	stage_button.pressed.connect(advance_preview_stage)
	layer.add_child(stage_button)
	var quality_button := Button.new()
	quality_button.text = "30/60 FPS"
	quality_button.position = Vector2(640, 630)
	quality_button.custom_minimum_size = Vector2(180, 54)
	quality_button.pressed.connect(_toggle_quality)
	layer.add_child(quality_button)
	audio = AudioStreamPlayer.new()
	audio.volume_db = -10.0
	add_child(audio)
	_refresh_status()

func _toggle_quality() -> void:
	max_quality = not max_quality
	Engine.max_fps = 60 if max_quality else 30
	_play_audio("navigation")

func _play_audio(name: String) -> void:
	if not music_enabled or not ["navigation", "build_start", "build_complete", "claim"].has(name):
		return
	var sound_bytes: PackedByteArray = FileAccess.get_file_as_bytes("res://world-audio/" + name + ".wav")
	if sound_bytes.is_empty():
		return
	var stream: AudioStreamWAV = AudioStreamWAV.load_from_buffer(sound_bytes)
	if stream == null:
		return
	audio.stop()
	audio.stream = stream
	audio.play()

func world_interaction(cue: String, message: String) -> void:
	interaction_notice = message
	_play_audio(cue)
	_refresh_status()
	queue_redraw()

func change_preview_level(delta: int) -> void:
	preview_level = clampi(preview_level + delta, 1, MAX_LEVEL)
	preview_stage = 0
	_play_audio("navigation")
	_refresh_status()
	queue_redraw()

func advance_preview_stage() -> void:
	preview_stage = (preview_stage + 1) % STAGES.size()
	_play_audio("build_complete" if preview_stage == 4 else "build_start")
	_refresh_status()
	queue_redraw()

func _refresh_status() -> void:
	if hud_status != null:
		hud_status.text = ("VISUAL PREVIEW ONLY  |  Level %d / 10  |  Stage %d / 5 (%s)" % [preview_level, preview_stage + 1, STAGES[preview_stage]]) + ("  |  " + interaction_notice if not interaction_notice.is_empty() else "")

func _process(delta: float) -> void:
	elapsed += minf(delta, 0.05)
	queue_redraw()

func _draw_structure(center: Vector2, size: float, tint: Color) -> void:
	var ground: Vector2 = Vector2(size * 0.75, size * 0.44)
	draw_ellipse_shadow(center, size)
	if preview_stage >= 0:
		for direction in [-1.0, 1.0]:
			draw_rect(Rect2(center + Vector2(direction * ground.x - 4, -4), Vector2(7, 16)), Color("#d6c59b"))
	if preview_stage >= 1:
		draw_rect(Rect2(center - ground, ground * 2.0), tint.darkened(0.42))
	if preview_stage >= 2:
		for x in [-ground.x * 0.8, ground.x * 0.8]:
			draw_line(center + Vector2(x, 0), center + Vector2(x, -size), tint.lightened(0.2), 6)
	if preview_stage >= 3:
		draw_rect(Rect2(center + Vector2(-ground.x * 0.82, -size), Vector2(ground.x * 1.64, size)), tint)
		draw_rect(Rect2(center + Vector2(-8, -size * 0.42), Vector2(16, size * 0.42)), Color("#203d49"))
	if preview_stage >= 4:
		draw_colored_polygon(PackedVector2Array([
			center + Vector2(-ground.x * 1.1, -size),
			center + Vector2(0, -size * 1.6),
			center + Vector2(ground.x * 1.1, -size)]), tint.lightened(0.32))
		# Stage-locked roof trim and windows; no fake ownership or permanent unlocks.
		draw_line(center + Vector2(-ground.x * 1.08, -size),
			center + Vector2(0, -size * 1.6), Color("#ffe4ad"), 5.0)
		draw_line(center + Vector2(0, -size * 1.6),
			center + Vector2(ground.x * 1.08, -size), Color("#ffe4ad"), 5.0)
		for window_x in [-ground.x * 0.48, ground.x * 0.48]:
			draw_rect(Rect2(center + Vector2(window_x - 12, -size * 0.66), Vector2(24, 29)),
				Color("#ffe6ad"))
		draw_circle(center + Vector2(0, -size * 1.4), 3.0 + 1.3 * sin(elapsed * 3.0), Color("#fff4bf"))

func draw_ellipse_shadow(center: Vector2, size: float) -> void:
	draw_circle(center + Vector2(0, size * 0.18), size * 0.7, Color(0.0, 0.0, 0.0, 0.23))

func _draw() -> void:
	draw_rect(Rect2(0, 0, 1280, 720), Color("#071c2e"))
	if image_texture != null:
		draw_texture_rect(image_texture, Rect2(0, 0, 1280, 720), false, Color(1, 1, 1, 0.82))
	draw_rect(Rect2(0, 0, 1280, 116), Color(0.02, 0.08, 0.16, 0.88))
	draw_rect(Rect2(0, 606, 1280, 114), Color(0.02, 0.08, 0.16, 0.82))
	if world_id == "kingdom":
		# Thirteen permanent character stations; cosmetic world map, no fake wins.
		for i in range(13):
			var col: int = i % 7
			var row: int = i / 7
			var pos: Vector2 = Vector2(154 + col * 160, 275 + row * 188)
			draw_circle(pos, 28 + sin(elapsed * 2.0 + i) * 3.0, Color(0.36, 0.8, 0.95, 0.23))
			# Actual animated 13-character sprites are rendered by WorldExploreController.
			# These are subtle station shadows, not triangular stand-in characters.
			draw_arc(pos + Vector2(0, 43), 39, 0, TAU, 36, Color(0.45, 0.94, 0.73, 0.54), 2.0)
			draw_circle(pos + Vector2(0, 52), 25, Color(0.02, 0.08, 0.11, 0.28))
	elif world_id == "community":
		for i in range(6):
			var pos: Vector2 = Vector2(188 + (i % 3) * 430, 300 + (i / 3) * 210)
			_draw_structure(pos, 42.0 + preview_level * 2.5, Color("#9fd5ad"))
		for i in range(10):
			var pos: Vector2 = Vector2(120 + i * 95.0, 470 + sin(elapsed * 1.6 + i * 2.0) * 6)
			draw_circle(pos, 7.0, Color("#baf2c6") if i % 2 == 0 else Color("#f9cc8f"))
			draw_line(pos + Vector2(0, 7), pos + Vector2(sin(elapsed * 3 + i) * 4, 18), Color("#dfebce"), 3)
	else:
		draw_rect(Rect2(230, 240, 820, 315), Color(0.19, 0.45, 0.38, 0.32), false, 3)
		_draw_structure(Vector2(640, 505), 110.0 + preview_level * 13.0, Color("#ecc9a0"))
		draw_string(ThemeDB.fallback_font, Vector2(235, 225), "PRIVATE LOT / HOUSE - STAGE PREVIEW", HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color.WHITE)
