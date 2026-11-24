## Landscape game hub using the original BUKLOD artwork.
extends Control
const CARDS := [
 ["kingdom","LIVING KINGDOM","Explore thirteen character realms","res://world-art/kingdom.webp"],
 ["arena","EMPIRE ARENA","Solo battles and four practice modes","res://art/scene/genesis_rift.png"],
 ["house","MY HOUSE","Explore and build your home","res://world-art/house.webp"],
 ["community","MY COMMUNITY","Discover your living village","res://world-art/community.webp"]
]
var content: VBoxContainer
func _ready() -> void:
 Engine.max_fps = 60
 var background := ColorRect.new()
 background.color = Color("#071523")
 background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
 background.mouse_filter = Control.MOUSE_FILTER_IGNORE
 add_child(background)
 var margin := MarginContainer.new()
 margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
 for side in ["left","right","top","bottom"]:
  margin.add_theme_constant_override("margin_"+side,24)
 add_child(margin)
 content = VBoxContainer.new()
 content.add_theme_constant_override("separation",14)
 margin.add_child(content)
 var heading := Label.new()
 heading.text = "BUKLOD  /  EMPIRE"
 heading.add_theme_font_size_override("font_size",34)
 heading.add_theme_color_override("font_color",Color("#FFE2AA"))
 content.add_child(heading)
 var sub := Label.new()
 sub.text = "GENESIS • Choose your world"
 sub.add_theme_font_size_override("font_size",20)
 sub.add_theme_color_override("font_color",Color("#B6D8D0"))
 content.add_child(sub)
 var grid := GridContainer.new()
 grid.columns = 2
 grid.size_flags_vertical = Control.SIZE_EXPAND_FILL
 grid.add_theme_constant_override("h_separation",16)
 grid.add_theme_constant_override("v_separation",16)
 content.add_child(grid)
 for card in CARDS:
  grid.add_child(_card(card))
 var footer := Label.new()
 footer.text = "DEV PREVIEW  •  OFFLINE PRACTICE  •  Shared BUKLOD rewards not yet connected"
 footer.add_theme_font_size_override("font_size",16)
 footer.add_theme_color_override("font_color",Color("#C1D6D1"))
 content.add_child(footer)
 var updates := HBoxContainer.new()
 content.add_child(updates)
 var ota := get_node("/root/EmpireOta")
 var update_status := Label.new()
 update_status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
 update_status.add_theme_font_size_override("font_size",15)
 updates.add_child(update_status)
 var check := Button.new()
 check.text = "CHECK UPDATE"
 check.pressed.connect(func() -> void: ota.check_update())
 updates.add_child(check)
 var rollback := Button.new()
 rollback.text = "ROLLBACK"
 rollback.pressed.connect(func() -> void: ota.rollback())
 updates.add_child(rollback)
 var restart := Button.new()
 restart.text = "REOPEN TO APPLY"
 restart.pressed.connect(func() -> void: get_tree().quit())
 updates.add_child(restart)
 var bar := ProgressBar.new()
 bar.min_value = 0
 bar.max_value = 1
 bar.show_percentage = true
 bar.custom_minimum_size = Vector2(120,0)
 updates.add_child(bar)
 var refresh := func() -> void:
  update_status.text = ota.status
  check.disabled = ota.busy or ota.restart_required
  rollback.disabled = ota.busy or ota.restart_required or ota.state.active.is_empty()
  restart.visible = ota.restart_required
  bar.visible = ota.busy and ota.progress >= 0
  bar.value = maxf(0,ota.progress)
 ota.status_changed.connect(refresh)
 tree_exiting.connect(func() -> void:
  if ota.status_changed.is_connected(refresh):
   ota.status_changed.disconnect(refresh))
 refresh.call()
 ota.check_once()
 await get_tree().process_frame
 if DisplayServer.get_name() != "headless":
  await RenderingServer.frame_post_draw
 print("BUKLOD_EMPIRE_MENU_RENDERED")
func _card(card: Array) -> Control:
 var button := Button.new()
 button.custom_minimum_size = Vector2(420,190)
 button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
 button.size_flags_vertical = Control.SIZE_EXPAND_FILL
 button.clip_contents = true
 button.tooltip_text = card[1]
 var style := StyleBoxFlat.new()
 style.bg_color = Color("#163943")
 style.border_color = Color("#70B7A4")
 style.set_border_width_all(2)
 style.set_corner_radius_all(14)
 button.add_theme_stylebox_override("normal",style)
 button.add_theme_stylebox_override("hover",style)
 button.add_theme_stylebox_override("pressed",style)
 var art := TextureRect.new()
 art.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
 art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
 art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
 art.mouse_filter = Control.MOUSE_FILTER_IGNORE
 var data := FileAccess.get_file_as_bytes(card[3])
 var bitmap := Image.new()
 var ok := bitmap.load_webp_from_buffer(data) if str(card[3]).ends_with(".webp") else bitmap.load_png_from_buffer(data)
 if ok == OK and not bitmap.is_empty():
  art.texture = ImageTexture.create_from_image(bitmap)
 button.add_child(art)
 var shade := ColorRect.new()
 shade.color = Color(0.02,0.08,0.13,0.58)
 shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
 shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
 button.add_child(shade)
 var text := VBoxContainer.new()
 text.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
 text.offset_left = -195
 text.offset_right = 195
 text.offset_top = -45
 text.offset_bottom = 45
 text.mouse_filter = Control.MOUSE_FILTER_IGNORE
 button.add_child(text)
 var title := Label.new()
 title.text = card[1]
 title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
 title.add_theme_font_size_override("font_size",28)
 title.add_theme_color_override("font_color",Color("#FFE6B3"))
 text.add_child(title)
 var subtitle := Label.new()
 subtitle.text = card[2]
 subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
 subtitle.add_theme_font_size_override("font_size",18)
 text.add_child(subtitle)
 button.pressed.connect(func() -> void: get_node("/root/EmpireSession").enter_world(card[0]))
 return button
