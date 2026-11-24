extends Control

const ARENA = "res://scenes/Arena.tscn"
const KINGDOM = "res://scenes/WorldPreview.tscn"

func _ready() -> void:
	Engine.max_fps = 60
	get_tree().set_meta("buklod_empire_world", "arena")
	var backdrop := ColorRect.new()
	backdrop.color = Color("#071523")
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(backdrop)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var column := VBoxContainer.new()
	column.custom_minimum_size = Vector2(760, 0)
	column.add_theme_constant_override("separation", 18)
	center.add_child(column)
	var brand := TextureRect.new()
	brand.texture = load("res://splash/buklod-green-b.png")
	brand.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	brand.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	brand.custom_minimum_size = Vector2(0, 100)
	column.add_child(brand)
	var title := Label.new()
	title.text = "BUKLOD EMPIRE"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 48)
	title.add_theme_color_override("font_color", Color("#F5D99A"))
	column.add_child(title)
	var subtitle := Label.new()
	subtitle.text = "Explore the Kingdom. Train in the Arena."
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle.add_theme_font_size_override("font_size", 23)
	column.add_child(subtitle)
	var cards := HBoxContainer.new()
	cards.add_theme_constant_override("separation", 18)
	column.add_child(cards)
	_add_door(cards, "KINGDOM", "Explore • collectibles • living world", Color("#285D49"), "kingdom", KINGDOM)
	_add_door(cards, "ARENA", "13 heroes • offline combat • skills", Color("#304D75"), "arena", ARENA)
	var note := Label.new()
	note.text = "STANDALONE PREVIEW • Offline only · no BP, QMP, rank or reward settlement"
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	note.add_theme_color_override("font_color", Color("#C8D7DF"))
	note.add_theme_font_size_override("font_size", 18)
	column.add_child(note)
	print("BUKLOD_EMPIRE_STANDALONE_HUB_READY")

func _add_door(parent: HBoxContainer, title: String, details: String, tint: Color, world: String, scene: String) -> void:
	var button := Button.new()
	button.text = title + "\n" + details
	button.custom_minimum_size = Vector2(370, 156)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.add_theme_font_size_override("font_size", 24)
	for state in ["normal", "hover", "pressed", "focus"]:
		var box := StyleBoxFlat.new()
		box.bg_color = tint.lightened(0.1) if state == "hover" else tint
		box.set_corner_radius_all(14)
		box.set_border_width_all(2)
		box.border_color = Color("#D2C28F")
		button.add_theme_stylebox_override(state, box)
	button.pressed.connect(func() -> void: open_world(world, scene))
	parent.add_child(button)

func open_world(world: String, scene: String) -> void:
	if not ((world == "arena" and scene == ARENA) or (world == "kingdom" and scene == KINGDOM)):
		return
	get_tree().set_meta("buklod_empire_world", world)
	get_tree().change_scene_to_file(scene)
