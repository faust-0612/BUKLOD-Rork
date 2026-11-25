## Independent Kingdom adventure on the existing reviewed 3D renderer.
## Uses original procedural articulated character meshes; visual quality remains device-gated.
extends "res://scripts/premium_world_3d.gd"

const MissionState = preload("res://scripts/kingdom_mission_state.gd")
const FieldChallenge = preload("res://scripts/kingdom_field_challenge.gd")
const AdventureProgress = preload("res://scripts/kingdom_adventure_progression.gd")
const START := Vector3(0, 0, 0)
const TARGETS := [Vector3(-5, 0, -5), Vector3(5, 0, -6), Vector3(0, 0, 7)]
var quest = MissionState.new()
var realms: Array = []
var realm_index := 0
var mission_index := 0
var realm_picker: OptionButton
var mission_picker: OptionButton
var action_button: Button
var target_nodes: Array[MeshInstance3D] = []
var quest_status: Label
var return_marker: Node3D
var world_sun: DirectionalLight3D
var night := false
var pending_target := -1
var realm_visuals: Node3D
var guide: Node3D
var original_character_id := "phan"
var avatar_picker: OptionButton
var sound_player: AudioStreamPlayer
var sound_enabled := false
var sound_button: Button
var guide_anim: AnimationPlayer
var motion_clip := ""
var footstep_time := 0.0
var last_step_side := 0
var moving_speed := 0.0
var avatar_anim: AnimationPlayer
var current_ambient_id := ""
var action_hold := 0.0
var ambient_player: AudioStreamPlayer
var ground_material: ShaderMaterial
var realm_environment: Environment
var guide_notice: Label
var talk_button: Button
var mission_targets: Array[Vector3] = []
var guide_label: Label3D
var guide_near := false
var guide_talking := false
var guide_talk_left := 0.0
var guide_clip := ""
var guide_dialogue_step := 0
var day_phase := 0.22
var sky_auto := true
var realm_profile: Dictionary = {}
var next_button: Button
var session_label: Label
var daylight_update := 0.0
var sky_material: ProceduralSkyMaterial
var sky_band := -1
var fill_light: DirectionalLight3D
var cinematic_fx
var realm_landmark := ""
var sfx_cache: Dictionary = {}
var steps_player: AudioStreamPlayer
var rhythm_player: AudioStreamPlayer
var rhythm_tones: Dictionary = {}
var field_refresh_elapsed := 0.0
var ambient_tail: AudioStreamPlayer
var ambient_fade: Tween
var valid_catalog := false
var realm_ready := false
var field = FieldChallenge.new()
var progression = AdventureProgress.new()
var difficulty_picker: OptionButton
var mode_picker: OptionButton
var progress_label: Label
var round_feedback: Label
var field_panel: PanelContainer
var field_prompt: Label
var field_status: Label
var field_grid: GridContainer
var field_index := -1
var field_buttons: Array[Button] = []
var sudoku_grid_ui: GridContainer
var sudoku_buttons: Array[Button] = []
var tile_style_cache: Dictionary = {}

func _get_world() -> String:
    return "kingdom"

func _ready() -> void:
    var raw := FileAccess.get_file_as_bytes("res://data/kingdom_realms.json")
    var parsed: Variant = JSON.parse_string(raw.get_string_from_utf8())
    if parsed is Dictionary and _valid_realm_catalog(parsed):
        realms = parsed.get("realms", [])
        valid_catalog = true
    super._ready()
    _refresh_missions()
    _apply_realm_visuals()
    _update_quest_status()
    if _adventure_ready():
        print("BUKLOD_LIVING_KINGDOM_READY: realms=", realms.size())
    else:
        push_warning("BUKLOD_LIVING_KINGDOM_CONTENT_NOT_READY: original games remain available")

func _valid_realm_catalog(data: Dictionary) -> bool:
    if data.get("schema") != 1 or data.get("serverSettlement") != false or data.get("mode") != "SESSION_LOCAL_ADVENTURE":
        return false
    var entries: Variant = data.get("realms", [])
    if not entries is Array or entries.size() != 13:
        return false
    var ids := {}
    var missions := {}
    for realm in entries:
        if not realm is Dictionary:
            return false
        var id := str(realm.get("id",""))
        if not id in ["phan","quin","van","christian","lhen","ace","ellusur","jawo","mitch","niel","angel","vhen","trudice"] or ids.has(id):
            return false
        ids[id] = true
        var profile: Variant = realm.get("profile",{})
        if not profile is Dictionary or int(profile.get("layout",-1)) < 0 or int(profile.get("layout",-1)) > 12:
            return false
        var games: Variant = realm.get("missions",[])
        if not games is Array or games.size() != 3:
            return false
        for game in games:
            if not game is Dictionary:
                return false
            var game_id := str(game.get("id",""))
            if game_id.is_empty() or missions.has(game_id) or not str(game.get("kind","")) in ["collect","sequence","delivery"] or not int(game.get("count",0)) in [2,3]:
                return false
            var challenge: Variant = game.get("challenge",{})
            if not challenge is Dictionary or not str(challenge.get("type","")) in FieldChallenge.TYPES:
                return false
            missions[game_id] = true
    return ids.size() == 13 and missions.size() == 39

func _adventure_ready() -> bool:
    return valid_catalog and realm_ready and avatar_anim != null and guide_anim != null and player != null and not player.find_children("*","Skeleton3D",true,false).is_empty()

func _setup_world() -> void:
    var floor := MeshInstance3D.new()
    var plane := PlaneMesh.new()
    plane.size = Vector2(55, 38)
    floor.mesh = plane
    ground_material = ShaderMaterial.new()
    ground_material.shader = load("res://shaders/kingdom_original_ground.gdshader")
    floor.material_override = ground_material
    floor.position.y = -0.04
    add_child(floor)

func _install_environment() -> void:
    var world := WorldEnvironment.new()
    var env := Environment.new()
    env.background_mode = Environment.BG_SKY
    sky_material = ProceduralSkyMaterial.new()
    sky_material.sky_top_color = Color("#44678d")
    sky_material.sky_horizon_color = Color("#c6d9d5")
    sky_material.ground_bottom_color = Color("#263e3a")
    sky_material.ground_horizon_color = Color("#879b84")
    var sky := Sky.new()
    sky.sky_material = sky_material
    env.sky = sky
    env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.ambient_light_color = Color("#c9dcf4")
    env.ambient_light_energy = 0.68
    world.environment = env
    add_child(world)
    world_sun = DirectionalLight3D.new()
    world_sun.rotation_degrees = Vector3(-48,32,0)
    world_sun.light_energy = 1.65
    world_sun.shadow_enabled = true
    world_sun.directional_shadow_max_distance = 37.0
    add_child(world_sun)
    fill_light = DirectionalLight3D.new()
    fill_light.rotation_degrees = Vector3(-30,-132,0)
    fill_light.light_color = Color("#b6d3ff")
    fill_light.light_energy = 0.32
    add_child(fill_light)
    realm_environment = env

func _build_props() -> void:
    cinematic_fx = preload("res://scripts/kingdom_cinematic_fx.gd").new()
    add_child(cinematic_fx)
    for i in range(TARGETS.size()):
        var marker := _marker(TARGETS[i], Color("#f7d68b"))
        target_nodes.append(marker)
        marker.visible = false
        mission_targets.append(TARGETS[i])
    return_marker = _marker(START, Color("#77f1c5"))
    return_marker.visible = false
    guide = Node3D.new()
    guide.position = Vector3(0, 0, -1.5)
    add_child(guide)
    guide_label = Label3D.new()
    guide_label.position = Vector3(0, 3.3, -1.5)
    guide_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
    guide_label.font_size = 40
    guide_label.pixel_size = 0.012
    guide_label.outline_size = 9
    add_child(guide_label)

func _original_hero(id: String) -> Node3D:
    if not id in ["phan","quin","van","christian","lhen","ace","ellusur","jawo","mitch","niel","angel","vhen","trudice"]:
        return null
    var raw := FileAccess.get_file_as_bytes("res://kingdom-original/heroes/" + id + ".glb")
    if raw.size() < 1024 or raw.size() > 4000000:
        return null
    var importer := GLTFDocument.new()
    var state := GLTFState.new()
    if importer.append_from_buffer(raw, "res://kingdom-original/heroes/", state) != OK:
        return null
    var model: Node = importer.generate_scene(state)
    if model == null:
        return null
    if not model is Node3D or model.find_children("*","Skeleton3D",true,false).is_empty():
        model.free()
        return null
    return model as Node3D

func _build_avatar() -> void:
    player = Node3D.new()
    player.name = "OriginalLocalExplorer"
    add_child(player)
    _replace_explorer(original_character_id)
    sound_player = AudioStreamPlayer.new()
    sound_player.volume_db = -13.0
    add_child(sound_player)
    ambient_player = AudioStreamPlayer.new()
    ambient_player.volume_db = -24.0
    add_child(ambient_player)
    ambient_tail = AudioStreamPlayer.new()
    ambient_tail.volume_db = -60.0
    add_child(ambient_tail)
    steps_player = AudioStreamPlayer.new()
    steps_player.volume_db = -21.0
    add_child(steps_player)
    rhythm_player = AudioStreamPlayer.new()
    rhythm_player.volume_db = -15.0
    add_child(rhythm_player)

func _replace_explorer(id: String) -> bool:
    var model := _original_hero(id)
    if model == null:
        return false
    var next_anim: AnimationPlayer
    for candidate in model.find_children("*", "AnimationPlayer", true, false):
        if candidate is AnimationPlayer:
            next_anim = candidate
            break
    if next_anim == null:
        model.free()
        return false
    for child in player.get_children():
        player.remove_child(child)
        child.queue_free()
    player.add_child(model)
    original_character_id = id
    avatar_anim = next_anim
    motion_clip = ""
    action_hold = 0.0
    _play_avatar_animation("Idle")
    return true

func _choose_practice_avatar(index: int) -> void:
    if index < 0 or index >= realms.size() or quest.phase in ["active", "return"]:
        return
    var id := str(realms[index].get("id", ""))
    if not _replace_explorer(id):
        guide_notice.text = "Explorer model unavailable. Previous model retained."
        for i in range(realms.size()):
            if str(realms[i].get("id", "")) == original_character_id:
                avatar_picker.select(i)
                break
    _update_quest_status()

func _set_guide(id: String) -> void:
    for child in guide.get_children():
        guide.remove_child(child)
        child.queue_free()
    guide_anim = null
    guide_clip = ""
    guide_talk_left = 0.0
    guide_dialogue_step = 0
    var model := _original_hero(id)
    guide.visible = model != null
    if model == null:
        return
    guide.add_child(model)
    model.rotation.y = PI
    for candidate in model.find_children("*", "AnimationPlayer", true, false):
        if candidate is AnimationPlayer:
            guide_anim = candidate
            _play_guide_animation("Idle")
            break

func _play_guide_animation(desired: String) -> void:
    if guide_anim == null or guide_clip == desired:
        return
    for clip in guide_anim.get_animation_list():
        if desired.to_lower() in str(clip).to_lower():
            var animation: Animation = guide_anim.get_animation(clip)
            animation.loop_mode = Animation.LOOP_LINEAR if desired == "Idle" else Animation.LOOP_NONE
            guide_anim.play(clip,0.15)
            guide_clip = desired
            return

func _play_avatar_animation(desired: String) -> void:
    if player == null or desired == motion_clip or (action_hold > 0.0 and desired in ["Idle","Walk","Run"]):
        return
    for candidate in player.find_children("*", "AnimationPlayer", true, false):
        if candidate is AnimationPlayer:
            for clip in candidate.get_animation_list():
                if desired.to_lower() in str(clip).to_lower():
                    var animation: Animation = candidate.get_animation(clip)
                    if desired in ["Idle", "Walk", "Run"]:
                        animation.loop_mode = Animation.LOOP_LINEAR
                    candidate.play(clip, 0.12)
                    motion_clip = desired
                    return

func _play_original_sound(id: String) -> void:
    if not sound_enabled or sound_player == null or not id in ["start","discover","guide","complete","footstep","ambience","return"]:
        return
    var output := steps_player if id == "footstep" else sound_player
    if id == "footstep" and output.playing:
        return
    if not sfx_cache.has(id):
        var raw := FileAccess.get_file_as_bytes("res://kingdom-original/audio/" + id + ".wav")
        if raw.is_empty():
            return
        var stream := AudioStreamWAV.load_from_buffer(raw)
        if stream == null:
            return
        sfx_cache[id] = stream
    output.stream = sfx_cache[id]
    output.pitch_scale = 0.96 if id == "footstep" and last_step_side == 0 else (1.04 if id == "footstep" else 1.0)
    output.play()

func _set_realm_ambience() -> void:
    if not sound_enabled or ambient_player == null or realm_index >= realms.size():
        return
    var id := str(realms[realm_index].get("id", ""))
    if id == current_ambient_id and ambient_player.playing:
        return
    var raw := FileAccess.get_file_as_bytes("res://kingdom-original/ambience/" + id + ".wav")
    var track: AudioStreamWAV = AudioStreamWAV.load_from_buffer(raw) if not raw.is_empty() else null
    if track == null:
        return
    track.loop_mode = AudioStreamWAV.LOOP_FORWARD
    if ambient_fade != null and ambient_fade.is_valid():
        ambient_fade.kill()
    ambient_tail.stop()
    if ambient_player.playing:
        ambient_tail.stream = ambient_player.stream
        ambient_tail.volume_db = ambient_player.volume_db
        ambient_tail.play(ambient_player.get_playback_position())
    ambient_player.stream = track
    ambient_player.volume_db = -60.0
    current_ambient_id = id
    ambient_player.play()
    ambient_fade = create_tween().set_parallel(true)
    ambient_fade.tween_property(ambient_player,"volume_db",-24.0,0.65)
    ambient_fade.tween_property(ambient_tail,"volume_db",-60.0,0.65)
    ambient_fade.chain().tween_callback(ambient_tail.stop)

func _toggle_original_audio() -> void:
    sound_enabled = not sound_enabled
    sound_button.text = "SOUND ON" if sound_enabled else "SOUND OFF"
    if not sound_enabled:
        if ambient_fade != null and ambient_fade.is_valid():
            ambient_fade.kill()
        sound_player.stop()
        steps_player.stop()
        rhythm_player.stop()
        ambient_player.stop()
        ambient_tail.stop()
    else:
        _set_realm_ambience()
        _play_original_sound("guide")

func _apply_realm_visuals() -> void:
    realm_ready = false
    if realm_index < 0 or realm_index >= realms.size():
        return
    var realm: Dictionary = realms[realm_index]
    realm_profile = realm.get("profile", {})
    if realm_visuals != null:
        remove_child(realm_visuals)
        realm_visuals.queue_free()
    realm_visuals = Node3D.new()
    add_child(realm_visuals)
    ground_material.set_shader_parameter("ground_color", Color(str(realm_profile.get("ground", "#6b8b45"))))
    ground_material.set_shader_parameter("realm_seed", float(realm_profile.get("layout", 0)))
    var accent := Color(str(realm_profile.get("accent", "#ffe1a0")))
    var layout := int(realm_profile.get("layout", 0))
    var original_environment = load("res://scripts/kingdom_original_environment.gd").new()
    realm_visuals.add_child(original_environment)
    original_environment.build(realm_profile)
    realm_landmark = str(original_environment.landmark_id)
    realm_ready = not realm_landmark.is_empty() and original_environment.get_child_count() >= 8
    sky_band = -1
    cinematic_fx.clear()
    # Different layouts, all within visible traversable ground. Phan retains original coordinates.
    var angle := 0.0 if str(realm.get("id")) == "phan" else float(layout) * 0.48
    for i in range(TARGETS.size()):
        mission_targets[i] = TARGETS[i].rotated(Vector3.UP, angle)
        target_nodes[i].position = mission_targets[i] + Vector3(0, 0.12, 0)
        var mat: StandardMaterial3D = target_nodes[i].material_override
        mat.albedo_color = accent
        mat.emission = accent
    _set_guide(str(realm.get("id", "")))
    guide_label.text = str(realm.get("theme", "")) + " GUIDE"
    guide_label.modulate = accent
    guide_talking = false
    guide_notice.text = str(realm_profile.get("biome", "")) + " • " + str(realm.get("theme", ""))
    _apply_daylight()
    _set_realm_ambience()

func _apply_daylight() -> void:
    if world_sun == null or realm_environment == null:
        return
    var sun_amount := clampf(0.5 + 0.65 * sin(day_phase * TAU), 0.0, 1.0) if sky_auto else (0.0 if night else 1.0)
    world_sun.light_energy = lerpf(0.27, 1.7, sun_amount)
    world_sun.light_color = Color("#b3cbff").lerp(Color("#fff3d2"), sun_amount)
    var sky := Color(str(realm_profile.get("sky", "#a6d3f0")))
    realm_environment.ambient_light_energy = lerpf(0.42,0.82,sun_amount)
    fill_light.light_energy = lerpf(0.18,0.36,sun_amount)
    # Quantize sky edits so the environment cubemap is not regenerated every frame.
    var band := int(round(sun_amount*6.0))
    if sky_material != null and band != sky_band:
        sky_band = band
        var brightness := float(band)/6.0
        sky_material.sky_top_color = Color("#111b36").lerp(sky.darkened(0.26),brightness)
        sky_material.sky_horizon_color = Color("#35476b").lerp(sky.lightened(0.24),brightness)
        sky_material.ground_horizon_color = sky_material.sky_horizon_color

func _marker(at: Vector3, tint: Color) -> MeshInstance3D:
    var node := MeshInstance3D.new()
    var mesh := CylinderMesh.new()
    mesh.top_radius = 0.65
    mesh.bottom_radius = 0.85
    mesh.height = 0.22
    node.mesh = mesh
    var material := StandardMaterial3D.new()
    material.albedo_color = tint
    material.emission_enabled = true
    material.emission = tint
    material.emission_energy_multiplier = 0.35
    node.material_override = material
    node.position = at + Vector3(0, 0.12, 0)
    add_child(node)
    return node

func _install_controls() -> void:
    var layer := CanvasLayer.new()
    add_child(layer)
    var panel := VBoxContainer.new()
    panel.position = Vector2(20, 14)
    panel.custom_minimum_size = Vector2(380, 0)
    layer.add_child(panel)
    var title := Label.new()
    title.text = "BUKLOD KINGDOM | LIVING REALMS"
    title.add_theme_font_size_override("font_size", 24)
    panel.add_child(title)
    realm_picker = OptionButton.new()
    mission_picker = OptionButton.new()
    avatar_picker = OptionButton.new()
    avatar_picker.tooltip_text = "Local practice appearance only; does not change your BUKLOD character."
    for realm in realms:
        realm_picker.add_item(str(realm.get("title", "")))
        avatar_picker.add_item("Explorer: " + str(realm.get("id", "")).capitalize())
    panel.add_child(avatar_picker)
    avatar_picker.item_selected.connect(_choose_practice_avatar)
    panel.add_child(realm_picker)
    panel.add_child(mission_picker)
    difficulty_picker = OptionButton.new()
    for name in AdventureProgress.DIFFICULTIES:
        difficulty_picker.add_item(name)
    difficulty_picker.select(1)
    difficulty_picker.item_selected.connect(func(index: int) -> void:
        progression.difficulty = index
        _update_quest_status())
    panel.add_child(difficulty_picker)
    mode_picker = OptionButton.new()
    mode_picker.add_item("Quick game • 1 encounter")
    mode_picker.add_item("Story expedition • 2–3 encounters")
    mode_picker.item_selected.connect(func(index: int) -> void:
        progression.quick_play = index == 0
        _update_quest_status())
    panel.add_child(mode_picker)
    realm_picker.item_selected.connect(_select_realm)
    mission_picker.item_selected.connect(func(index: int) -> void:
        mission_index = index
        _update_quest_status())
    var controls := HBoxContainer.new()
    panel.add_child(controls)
    action_button = Button.new()
    action_button.text = "START ADVENTURE"
    action_button.custom_minimum_size = Vector2(170, 50)
    action_button.pressed.connect(_start_or_cancel)
    controls.add_child(action_button)
    var sky_button := Button.new()
    sky_button.text = "DAY / NIGHT"
    sky_button.custom_minimum_size = Vector2(130, 50)
    sky_button.pressed.connect(_toggle_sky)
    controls.add_child(sky_button)
    sound_button = Button.new()
    sound_button.text = "SOUND OFF"
    sound_button.custom_minimum_size = Vector2(120, 48)
    sound_button.pressed.connect(_toggle_original_audio)
    controls.add_child(sound_button)
    next_button = Button.new()
    next_button.text = "NEXT ADVENTURE"
    next_button.custom_minimum_size = Vector2(160, 48)
    next_button.pressed.connect(_next_adventure)
    panel.add_child(next_button)
    session_label = Label.new()
    panel.add_child(session_label)
    progress_label = Label.new()
    progress_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    panel.add_child(progress_label)
    round_feedback = Label.new()
    round_feedback.add_theme_color_override("font_color",Color("#ffe1a0"))
    panel.add_child(round_feedback)
    quest_status = Label.new()
    quest_status.add_theme_font_size_override("font_size", 17)
    quest_status.custom_minimum_size = Vector2(390, 0)
    quest_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    panel.add_child(quest_status)
    guide_notice = Label.new()
    guide_notice.custom_minimum_size = Vector2(390, 0)
    guide_notice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    panel.add_child(guide_notice)
    talk_button = Button.new()
    talk_button.text = "TALK TO GUIDE"
    talk_button.custom_minimum_size = Vector2(180, 48)
    talk_button.pressed.connect(_talk_to_guide)
    panel.add_child(talk_button)
    var back := Button.new()
    back.text = "BACK TO BUKLOD"
    back.position = Vector2(1000, 20)
    back.custom_minimum_size = Vector2(240, 54)
    back.pressed.connect(func() -> void: get_tree().quit())
    layer.add_child(back)
    _install_field_panel(layer)
    for child in get_children():
        if child is DirectionalLight3D and child.shadow_enabled:
            world_sun = child
        if child is WorldEnvironment:
            realm_environment = child.environment

func _install_field_panel(layer: CanvasLayer) -> void:
    field_panel = PanelContainer.new()
    field_panel.position = Vector2(725,105)
    field_panel.custom_minimum_size = Vector2(490,0)
    var panel_style := StyleBoxFlat.new()
    panel_style.bg_color = Color("#172b32")
    panel_style.border_color = Color("#d7b575")
    panel_style.set_border_width_all(2)
    panel_style.set_corner_radius_all(14)
    panel_style.content_margin_left = 12
    panel_style.content_margin_right = 12
    panel_style.content_margin_top = 10
    panel_style.content_margin_bottom = 10
    field_panel.add_theme_stylebox_override("panel",panel_style)
    layer.add_child(field_panel)
    var body := VBoxContainer.new()
    field_panel.add_child(body)
    field_prompt = Label.new()
    field_prompt.custom_minimum_size = Vector2(455,0)
    field_prompt.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    field_prompt.add_theme_font_size_override("font_size",20)
    body.add_child(field_prompt)
    field_status = Label.new()
    field_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    body.add_child(field_status)
    sudoku_grid_ui = GridContainer.new()
    sudoku_grid_ui.columns = 4
    sudoku_grid_ui.add_theme_constant_override("h_separation",3)
    sudoku_grid_ui.add_theme_constant_override("v_separation",3)
    body.add_child(sudoku_grid_ui)
    for i in range(49):
        var cell := Button.new()
        cell.custom_minimum_size = Vector2(69,38)
        cell.add_theme_font_size_override("font_size",20)
        cell.pressed.connect(_select_sudoku_cell.bind(i))
        sudoku_grid_ui.add_child(cell)
        sudoku_buttons.append(cell)
    sudoku_grid_ui.hide()
    field_grid = GridContainer.new()
    field_grid.columns = 3
    body.add_child(field_grid)
    for i in range(9):
        var button := Button.new()
        button.custom_minimum_size = Vector2(145,54)
        button.pressed.connect(_choose_field.bind(i))
        field_grid.add_child(button)
        field_buttons.append(button)
    var retry := Button.new()
    retry.text = "RESTART CHALLENGE"
    retry.pressed.connect(_restart_field)
    body.add_child(retry)
    var close := Button.new()
    close.text = "RETURN TO EXPLORATION"
    close.pressed.connect(_leave_field)
    body.add_child(close)
    field_panel.hide()

func _open_field(index: int) -> bool:
    var prepared: Dictionary = progression.prepare(quest.mission.get("challenge",{}),progression.active_level,progression.active_difficulty,index)
    if not field.begin(prepared,int((progression.active_level-1+index)%3)):
        return false
    field_index = index
    field_panel.show()
    _refresh_field()
    return true

func _tile_style(key: String, color: Color, border_color: Color) -> StyleBoxFlat:
    if not tile_style_cache.has(key):
        var style := StyleBoxFlat.new()
        style.bg_color = color
        style.border_color = border_color
        style.set_border_width_all(2)
        style.set_corner_radius_all(6)
        tile_style_cache[key] = style
    return tile_style_cache[key]

func _select_sudoku_cell(index: int) -> void:
    if field_index < 0 or quest.phase!="active":
        return
    if field.spec.type=="wordsearch":
        if field.choose_word_cell(index):
            _complete_field()
        else:
            _refresh_field()
    elif field.select_sudoku_cell(index):
        _refresh_field()

func _refresh_sudoku() -> void:
    var is_word: bool = field.spec.type=="wordsearch"
    var active: bool = field.spec.type == "sudoku"
    sudoku_grid_ui.visible = active or is_word
    field_grid.visible = not is_word
    field_grid.columns = int(field.sudoku_size)+1 if active else 3
    if is_word:
        var size: int = int(field.spec.size)
        sudoku_grid_ui.columns = size
        for i in range(sudoku_buttons.size()):
            var cell := sudoku_buttons[i]
            cell.visible = i<size*size
            if not cell.visible:
                continue
            cell.disabled = false
            cell.text = str(field.spec.letters[i])
            cell.custom_minimum_size = Vector2(floorf(431.0/size),38)
            var found: bool = field.word_cells.has(i)
            var selected: bool = field.word_start==i
            var tint := Color("#35745c") if found else (Color("#806b36") if selected else Color("#304951"))
            cell.add_theme_stylebox_override("normal",_tile_style("word:"+str(found)+":"+str(selected),tint,Color("#b6d4a1") if found or selected else Color("#67818a")))
        return
    if not active:
        return
    var n: int = field.sudoku_size
    sudoku_grid_ui.columns = n
    for i in range(sudoku_buttons.size()):
        var cell := sudoku_buttons[i]
        cell.visible = i < n*n
        if not cell.visible:
            continue
        var value: int = int(field.sudoku_grid[i])
        cell.text = str(value) if value else "·"
        cell.disabled = field.sudoku_fixed.has(i)
        cell.custom_minimum_size = Vector2(69 if n==6 else 104,38)
        var row_group := floori(float(floori(float(i)/n))/field.sudoku_box_rows)
        var col_group := floori(float(i%n)/field.sudoku_box_cols)
        var group := (row_group+col_group)%2
        var selected: bool = field.sudoku_selected == i
        var color := Color("#475d69") if group==0 else Color("#304951")
        var outline := Color("#f4d68c") if selected else Color("#67818a")
        cell.add_theme_stylebox_override("normal",_tile_style("sudoku:"+str(group)+":"+str(selected),color,outline))
        cell.add_theme_stylebox_override("disabled",_tile_style("fixed",Color("#264b3b"),Color("#74a78d")))
        cell.add_theme_color_override("font_disabled_color",Color("#f5e7b9"))

func _refresh_field() -> void:
    if field_index < 0:
        return
    _refresh_sudoku()
    field_prompt.text = str(field.spec.get("prompt",""))
    field_status.text = field.status() + (" • " + field.feedback if not field.feedback.is_empty() else "")
    for i in range(field_buttons.size()):
        var button := field_buttons[i]
        button.custom_minimum_size = Vector2(57,42) if field.spec.type == "sudoku" else Vector2(145,54)
        button.visible = i < field.spec.items.size()
        if not button.visible:
            continue
        var selected: bool = field.picks.has(i) or field.matched.has(i)
        button.text = ("✓ " if selected else "") + field.tile_label(i)
        button.disabled = field.preview_left > 0.0 or field.reveal_left > 0.0 or field.solved or field.matched.has(i)
        if field.spec.type == "domino" and field.picks.has(i):
            button.disabled = true
        if field.spec.type == "codebreaker" and field.code_locked:
            button.disabled = true
        if field.spec.type == "farm" and field.crop_stage[i] == 4:
            button.disabled = true
        if field.spec.type == "match3" and str(field.board[i]).is_empty():
            button.disabled = true

func _play_rhythm_note(index: int) -> void:
    if not sound_enabled or rhythm_player == null or index < 0 or index > 2:
        return
    if not rhythm_tones.has(index):
        var rate := 44100
        var frames := int(rate*0.18)
        var pcm := PackedByteArray()
        pcm.resize(frames*2)
        var hz := float([261.63,329.63,392.0][index])
        for i in range(frames):
            var t := float(i)/float(rate)
            var envelope := minf(1.0,t*180.0)*exp(-t*13.0)*minf(1.0,(0.18-t)*45.0)
            var sample := (sin(TAU*hz*t)*0.65+sin(TAU*hz*2.0*t)*0.18+sin(TAU*hz*3.0*t)*0.06)*envelope
            pcm.encode_s16(i*2,int(clampf(sample,-0.9,0.9)*24000.0))
        var tone := AudioStreamWAV.new()
        tone.format = AudioStreamWAV.FORMAT_16_BITS
        tone.mix_rate = rate
        tone.stereo = false
        tone.data = pcm
        rhythm_tones[index] = tone
    rhythm_player.stream = rhythm_tones[index]
    rhythm_player.play()

func _choose_field(index: int) -> void:
    if field_index < 0 or quest.phase != "active":
        return
    var previous_beat: int = field.beat_index
    var finished: bool = field.choose(index)
    if field.spec.type == "rhythm" and field.beat_index > previous_beat:
        _play_rhythm_note(index)
    if not finished:
        _refresh_field()
        return
    _complete_field()

func _complete_field() -> void:
    if field_index<0 or not field.solved or quest.phase!="active":
        return
    var target := field_index
    if progression.quick_play:
        if quest.finish_quick(field.solved):
            _close_field()
            _finish_practice_round()
            _update_quest_status()
        return
    _close_field()
    if quest.visit(target,player.position.distance_to(mission_targets[target])):
        _play_avatar_animation("Interact")
        action_hold = 1.1
        _play_original_sound("return" if quest.phase == "return" else "discover")
        cinematic_fx.trigger("discover",player.position,Color(str(realm_profile.get("accent","#ffe3a3"))))
    _update_quest_status()

func _finish_practice_round() -> void:
    var earned: int = progression.complete_round()
    if earned <= 0:
        return
    round_feedback.text = "+%d practice score • Level %d cleared!" % [earned,progression.active_level]
    _play_avatar_animation("Celebrate")
    action_hold = 1.4
    _play_original_sound("complete")
    cinematic_fx.trigger("complete",player.position,Color("#f5d77d"))

func _restart_field() -> void:
    if field_index >= 0:
        var prepared: Dictionary = progression.prepare(quest.mission.get("challenge",{}),progression.active_level,progression.active_difficulty,field_index)
        field.begin(prepared,int((progression.active_level-1+field_index)%3))
        _refresh_field()

func _leave_field() -> void:
    if progression.quick_play and quest.phase == "active":
        quest.cancel()
        progression.abandon()
    _close_field()
    _update_quest_status()

func _close_field() -> void:
    field_index = -1
    field.clear()
    if field_panel != null:
        field_panel.hide()

func _toggle_sky() -> void:
    sky_auto = false
    night = not night
    _apply_daylight()

func _talk_to_guide() -> void:
    if not guide_near or not _adventure_ready():
        guide_notice.text = "Walk to the guide to talk."
        return
    guide_talking = true
    guide_talk_left = 1.1
    _play_guide_animation("Interact")
    _play_avatar_animation("Interact")
    action_hold = 1.1
    _play_original_sound("guide")
    var realm: Dictionary = realms[realm_index]
    var missions: Array = realm.get("missions",[])
    if quest.phase == "return":
        guide_notice.text = "Your work is ready. Return to the green beacon to finish."
    elif quest.phase == "active":
        guide_notice.text = "Continue " + str(quest.mission.get("title","")) + ": " + str(quest.visited.size()) + "/" + str(quest.mission.get("count",0)) + " objectives."
    elif quest.phase == "complete":
        guide_notice.text = "Well done. Continue your adventure or revisit a previous challenge."
    elif guide_dialogue_step % 2 == 0:
        guide_notice.text = str(realm_profile.get("dialogue", ""))
    elif mission_index >= 0 and mission_index < missions.size():
        guide_notice.text = "Your next challenge is " + str(missions[mission_index].get("title","")) + ". Prepare to explore."
    guide_dialogue_step += 1

func _select_realm(index: int) -> void:
    if quest.phase in ["active", "return"]:
        return
    if index < 0 or index >= realms.size():
        return
    realm_index = index
    quest.cancel()
    _refresh_missions()
    _apply_realm_visuals()
    _update_quest_status()

func _refresh_missions() -> void:
    mission_picker.clear()
    mission_index = 0
    if realm_index >= realms.size():
        action_button.disabled = true
        return
    for mission in realms[realm_index].get("missions", []):
        mission_picker.add_item(str(mission.get("title", "")))

func _next_adventure() -> void:
    if quest.phase != "complete" or realms.is_empty():
        return
    var missions: Array = realms[realm_index].get("missions", [])
    if progression.quick_play:
        quest.cancel()
        _start_or_cancel()
        return
    if mission_index + 1 < missions.size():
        mission_index += 1
        mission_picker.select(mission_index)
        quest.cancel()
        _update_quest_status()
    else:
        # Continue through the realm story without inventing unlocks or reward credit.
        var next_realm := (realm_index + 1) % realms.size()
        realm_picker.select(next_realm)
        _select_realm(next_realm)

func _start_or_cancel() -> void:
    _close_field()
    if not _adventure_ready():
        _update_quest_status()
        return
    if quest.phase in ["active", "return"]:
        quest.cancel()
        progression.abandon()
    elif realm_index < realms.size():
        var missions: Array = realms[realm_index].get("missions", [])
        if mission_index < missions.size():
            var selected: Dictionary = missions[mission_index].duplicate(true)
            if progression.quick_play:
                selected.count = 1
                selected.quick = true
            if quest.begin(selected):
                progression.begin(str(selected.id))
                round_feedback.text = ""
                _play_original_sound("start")
                cinematic_fx.trigger("start",player.position,Color(str(realm_profile.get("accent","#ffe3a3"))))
    pending_target = -1
    destination = player.position
    if progression.quick_play and quest.phase == "active" and not _open_field(0):
        quest.cancel()
        progression.abandon()
        guide_notice.text = "Challenge could not start. Try another game."
    _update_quest_status()

func move_to(point: Vector3) -> bool:
    if field_index >= 0 or not _adventure_ready() or not point.is_finite() or absf(point.x) > 11.5 or absf(point.z) > 11.5:
        return false
    if not super.move_to(point):
        return false
    action_hold = 0.0
    pending_target = -1
    if quest.phase == "active":
        for i in range(int(quest.mission.get("count", 0))):
            var eligible: bool = quest.mission.get("kind") == "collect" or i == quest.visited.size()
            if eligible and not quest.visited.has(i) and point.distance_to(mission_targets[i]) <= 2.2:
                pending_target = i
                destination = mission_targets[i]
                break
    elif quest.phase == "return" and point.distance_to(START) <= 2.2:
        pending_target = 3
        destination = START
    return true

func _unhandled_input(event: InputEvent) -> void:
    var screen := Vector2(-1, -1)
    if event is InputEventScreenTouch and event.pressed:
        screen = event.position
    elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
        screen = event.position
    if screen.x < 0 or screen.y < 100:
        return
    var impact: Variant = Plane(Vector3.UP, 0.0).intersects_ray(camera.project_ray_origin(screen), camera.project_ray_normal(screen))
    if impact is Vector3 and move_to(impact):
        get_viewport().set_input_as_handled()

func _process(delta: float) -> void:
    # Custom locomotion: acceleration, deceleration and motion-rate matching;
    # no inherited child bounce or abrupt teleport on touch.
    var dt := minf(delta, 0.05)
    if field_index >= 0:
        var changed: bool = field.tick(dt)
        field_refresh_elapsed += dt
        if changed and (field.spec.type != "rhythm" or field_refresh_elapsed >= 0.08):
            field_refresh_elapsed = 0.0
            _refresh_field()
    elapsed += dt
    action_hold = maxf(0.0, action_hold - dt)
    var remaining := player.position.distance_to(destination)
    var desired_speed := 4.4 if remaining > 6.0 else 2.45
    desired_speed *= clampf(remaining / 1.15, 0.0, 1.0)
    moving_speed = move_toward(moving_speed, desired_speed, 10.0 * dt)
    var moving := remaining > 0.08
    if moving:
        action_hold = 0.0
        var direction := (destination - player.position).normalized()
        player.rotation.y = lerp_angle(player.rotation.y, atan2(direction.x, direction.z), minf(1.0,dt*12.0))
        player.position = player.position.move_toward(destination, maxf(0.04,moving_speed)*dt)
        var clip := "Run" if moving_speed > 3.2 else "Walk"
        _play_avatar_animation(clip)
        if avatar_anim != null:
            avatar_anim.speed_scale = clampf(moving_speed / (4.4 if clip == "Run" else 2.45), 0.40, 1.35)
    else:
        player.position = destination
        moving_speed = 0.0
        if avatar_anim != null:
            avatar_anim.speed_scale = 1.0
        _play_avatar_animation("Idle")
    if camera != null:
        var focus := player.position + Vector3(0,0.85,0)
        var follow := player.position + Vector3(0,12.5,15.5)
        camera.position = camera.position.lerp(follow, minf(1.0,dt*3.5))
        camera.look_at(focus, Vector3.UP)
    if sky_auto:
        day_phase = fposmod(day_phase + minf(delta, 0.05) / 240.0, 1.0)
        daylight_update += delta
        if daylight_update >= 0.2:
            daylight_update = 0.0
            _apply_daylight()
    if guide != null:
        guide_near = player.position.distance_to(Vector3(0, 0, -1.5)) <= 3.2
        talk_button.disabled = not guide_near or not _adventure_ready()
        if guide_near and guide.visible:
            var face := player.position - guide.position
            if face.length_squared() > 0.04:
                guide.rotation.y = lerp_angle(guide.rotation.y,atan2(face.x,face.z)-PI,minf(1.0,dt*6.0))
        guide_talk_left = maxf(0.0,guide_talk_left-dt)
        if guide_talk_left <= 0.0:
            _play_guide_animation("Idle")
        if guide_talking and not guide_near:
            guide_talking = false
            guide_talk_left = 0.0
            _play_guide_animation("Idle")
            guide_notice.text = str(realm_profile.get("biome", ""))
    if moving and moving_speed > 0.7:
        footstep_time += dt
        var step_period := 0.32 if moving_speed > 3.2 else 0.46
        if footstep_time >= step_period:
            footstep_time = 0.0
            last_step_side = 1 - last_step_side
            _play_original_sound("footstep")
    else:
        footstep_time = 0.0
    if pending_target < 0 or player.position.distance_to(destination) > 0.30:
        return
    var index := pending_target
    pending_target = -1
    destination = player.position
    moving_speed = 0.0
    if avatar_anim != null:
        avatar_anim.speed_scale = 1.0
    if index == 3:
        if quest.finish(player.position.distance_to(START)):
            _finish_practice_round()
    else:
        if not _open_field(index):
            guide_notice.text = "Challenge unavailable. Cancel and retry the adventure."
    _update_quest_status()

func _update_quest_status() -> void:
    var active: bool = quest.phase in ["active", "return"]
    realm_picker.disabled = active
    mission_picker.disabled = active
    avatar_picker.disabled = active
    difficulty_picker.disabled = active
    mode_picker.disabled = active
    action_button.text = "CANCEL GAME" if active and progression.quick_play else ("CANCEL ADVENTURE" if active else ("PLAY ROUND" if progression.quick_play else "START ADVENTURE"))
    action_button.disabled = not _adventure_ready()
    next_button.visible = quest.phase == "complete"
    session_label.text = "SESSION DISCOVERIES: %d / 39" % quest.completed.size()
    var game_id := ""
    if realm_index < realms.size():
        var missions: Array = realms[realm_index].get("missions",[])
        if mission_index < missions.size():
            game_id = str(missions[mission_index].get("id",""))
    progress_label.text = "%s • Level %d • %d rounds\nPractice score: %d (not BP)" % [progression.milestone(),progression.level_for(game_id,progression.difficulty),progression.total_rounds,progression.practice_score]
    next_button.text = "NEXT LEVEL" if progression.quick_play else "NEXT ADVENTURE"
    for i in range(target_nodes.size()):
        target_nodes[i].visible = not progression.quick_play and quest.phase == "active" and i < int(quest.mission.get("count", 0)) and not quest.visited.has(i)
        if target_nodes[i].visible and quest.mission.get("kind") != "collect":
            target_nodes[i].visible = i == quest.visited.size()
    return_marker.visible = quest.phase == "return"
    if not _adventure_ready():
        quest_status.text = "Kingdom content unavailable. Try another realm or return to the original Kingdom games."
    elif quest.phase == "active" and progression.quick_play:
        quest_status.text = "Quick game • Solve the board to complete this level."
    elif quest.phase == "active":
        quest_status.text = str(quest.mission.get("title")) + ": " + str(quest.mission.get("object")) + " " + str(quest.visited.size()) + "/" + str(quest.mission.get("count")) + ". Tap illuminated markers to walk."
    elif quest.phase == "return":
        quest_status.text = "Return to the green beacon to finish."
    elif quest.phase == "complete":
        quest_status.text = "Round cleared! Continue to the next level or choose a different difficulty. Practice only; no BP credit." if progression.quick_play else "Adventure complete! Continue to the next challenge or replay. No BP, XP or wallet credit."
    else:
        quest_status.text = "Choose a realm and adventure. Session practice, no account rewards."

func get_dev_snapshot() -> Dictionary:
    var result := super.get_dev_snapshot()
    result["realms"] = realms.size()
    result["phase"] = quest.phase
    result["local_completed"] = quest.completed.duplicate()
    result["biome"] = realm_profile.get("biome", "")
    result["realm_props"] = realm_visuals.get_child(0).get_child_count() if realm_visuals != null and realm_visuals.get_child_count() > 0 else 0
    result["guide_ready"] = guide != null and guide.get_child_count() > 0 and guide_anim != null
    result["original_avatar"] = player != null and player.get_child_count() > 0
    result["practice_avatar_id"] = original_character_id
    result["skinned_avatar"] = player != null and not player.find_children("*", "Skeleton3D", true, false).is_empty()
    result["guide_near"] = guide_near
    result["guide_clip"] = guide_clip
    result["field_index"] = field_index
    result["practice_score"] = progression.practice_score
    result["practice_rounds"] = progression.total_rounds
    result["difficulty"] = progression.difficulty
    result["adventure_ready"] = _adventure_ready()
    result["landmark_id"] = realm_landmark
    result["fx_count"] = cinematic_fx.count if cinematic_fx != null else 0
    return result
