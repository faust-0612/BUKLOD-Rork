## Independent Kingdom adventure on the existing reviewed 3D renderer.
## Uses original procedural articulated character meshes; visual quality remains device-gated.
extends "res://scripts/premium_world_3d.gd"

const MissionState = preload("res://scripts/kingdom_mission_state.gd")
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
var day_phase := 0.22
var sky_auto := true
var realm_profile: Dictionary = {}
var next_button: Button
var session_label: Label
var daylight_update := 0.0

func _get_world() -> String:
    return "kingdom"

func _ready() -> void:
    var raw := FileAccess.get_file_as_bytes("res://data/kingdom_realms.json")
    var parsed: Variant = JSON.parse_string(raw.get_string_from_utf8())
    if parsed is Dictionary and parsed.get("schema") == 1 and parsed.get("serverSettlement") == false:
        realms = parsed.get("realms", [])
    super._ready()
    _refresh_missions()
    _apply_realm_visuals()
    _update_quest_status()
    print("BUKLOD_LIVING_KINGDOM_READY: realms=", realms.size())

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

func _build_props() -> void:
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
    return model as Node3D

func _build_avatar() -> void:
    player = Node3D.new()
    player.name = "OriginalLocalExplorer"
    add_child(player)
    var model := _original_hero(original_character_id)
    if model != null:
        player.add_child(model)
        visual_count += 1
        for candidate in model.find_children("*", "AnimationPlayer", true, false):
            if candidate is AnimationPlayer:
                avatar_anim = candidate
                break
    _play_avatar_animation("Idle")
    sound_player = AudioStreamPlayer.new()
    sound_player.volume_db = -13.0
    add_child(sound_player)
    ambient_player = AudioStreamPlayer.new()
    ambient_player.volume_db = -24.0
    add_child(ambient_player)

func _set_guide(id: String) -> void:
    for child in guide.get_children():
        guide.remove_child(child)
        child.queue_free()
    guide_anim = null
    var model := _original_hero(id)
    guide.visible = model != null
    if model == null:
        return
    guide.add_child(model)
    model.rotation.y = PI
    for candidate in model.find_children("*", "AnimationPlayer", true, false):
        if candidate is AnimationPlayer:
            guide_anim = candidate
            for clip in guide_anim.get_animation_list():
                if "idle" in str(clip).to_lower():
                    var animation := guide_anim.get_animation(clip)
                    animation.loop_mode = Animation.LOOP_LINEAR
                    guide_anim.play(clip)
                    break
            break

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
    if id == "footstep" and sound_player.playing:
        return
    if id != "footstep":
        sound_player.pitch_scale = 1.0
    var raw := FileAccess.get_file_as_bytes("res://kingdom-original/audio/" + id + ".wav")
    if raw.is_empty():
        return
    var stream := AudioStreamWAV.load_from_buffer(raw)
    if stream != null:
        sound_player.stream = stream
        sound_player.play()

func _set_realm_ambience() -> void:
    if not sound_enabled or ambient_player == null or realm_index >= realms.size():
        return
    var id := str(realms[realm_index].get("id", ""))
    if id == current_ambient_id and ambient_player.playing:
        return
    var raw := FileAccess.get_file_as_bytes("res://kingdom-original/ambience/" + id + ".wav")
    if raw.is_empty():
        raw = FileAccess.get_file_as_bytes("res://kingdom-original/audio/ambience.wav")
    var track: AudioStreamWAV = AudioStreamWAV.load_from_buffer(raw) if not raw.is_empty() else null
    if track != null:
        track.loop_mode = AudioStreamWAV.LOOP_FORWARD
        ambient_player.stream = track
        current_ambient_id = id
        ambient_player.play()

func _toggle_original_audio() -> void:
    sound_enabled = not sound_enabled
    sound_button.text = "SOUND ON" if sound_enabled else "SOUND OFF"
    if not sound_enabled:
        sound_player.stop()
        ambient_player.stop()
    else:
        _set_realm_ambience()
        _play_original_sound("guide")

func _apply_realm_visuals() -> void:
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
    realm_environment.background_color = Color("#172440").lerp(sky, sun_amount)
    realm_environment.ambient_light_energy = lerpf(0.42, 0.82, sun_amount)

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
    for realm in realms:
        realm_picker.add_item(str(realm.get("title", "")))
    panel.add_child(realm_picker)
    panel.add_child(mission_picker)
    realm_picker.item_selected.connect(_select_realm)
    mission_picker.item_selected.connect(func(index: int) -> void: mission_index = index)
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
    for child in get_children():
        if child is DirectionalLight3D:
            world_sun = child
        if child is WorldEnvironment:
            realm_environment = child.environment

func _toggle_sky() -> void:
    sky_auto = false
    night = not night
    _apply_daylight()

func _talk_to_guide() -> void:
    if not guide_near:
        guide_notice.text = "Walk to the guide to talk."
        return
    guide_talking = true
    _play_avatar_animation("Interact")
    action_hold = 1.1
    _play_original_sound("guide")
    guide_notice.text = str(realm_profile.get("dialogue", ""))

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
    if quest.phase in ["active", "return"]:
        quest.cancel()
    elif realm_index < realms.size():
        var missions: Array = realms[realm_index].get("missions", [])
        if mission_index < missions.size():
            if quest.begin(missions[mission_index]):
                _play_original_sound("start")
    pending_target = -1
    destination = player.position
    _update_quest_status()

func move_to(point: Vector3) -> bool:
    if not point.is_finite() or absf(point.x) > 24.0 or absf(point.z) > 17.5:
        return false
    if not super.move_to(point):
        return false
    action_hold = 0.0
    pending_target = -1
    if quest.phase == "active":
        for i in range(int(quest.mission.get("count", 0))):
            if not quest.visited.has(i) and point.distance_to(mission_targets[i]) <= 2.2:
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
        talk_button.disabled = not guide_near
        if guide_talking and not guide_near:
            guide_talking = false
            guide_notice.text = str(realm_profile.get("biome", ""))
    if moving and moving_speed > 0.7:
        footstep_time += dt
        var step_period := 0.32 if moving_speed > 3.2 else 0.46
        if footstep_time >= step_period:
            footstep_time = 0.0
            last_step_side = 1 - last_step_side
            sound_player.pitch_scale = 0.96 if last_step_side == 0 else 1.04
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
            _play_avatar_animation("Celebrate")
            action_hold = 1.4
            _play_original_sound("complete")
    else:
        if quest.visit(index, player.position.distance_to(mission_targets[index])):
            _play_avatar_animation("Interact")
            action_hold = 1.1
            _play_original_sound("return" if quest.phase == "return" else "discover")
    _update_quest_status()

func _update_quest_status() -> void:
    var active: bool = quest.phase in ["active", "return"]
    realm_picker.disabled = active
    mission_picker.disabled = active
    action_button.text = "CANCEL ADVENTURE" if active else "START ADVENTURE"
    next_button.visible = quest.phase == "complete"
    session_label.text = "SESSION DISCOVERIES: %d / 39" % quest.completed.size()
    for i in range(target_nodes.size()):
        target_nodes[i].visible = quest.phase == "active" and i < int(quest.mission.get("count", 0)) and not quest.visited.has(i)
        if target_nodes[i].visible and quest.mission.get("kind") != "collect":
            target_nodes[i].visible = i == quest.visited.size()
    return_marker.visible = quest.phase == "return"
    if realms.is_empty():
        quest_status.text = "Adventure data unavailable. Return to BUKLOD."
    elif quest.phase == "active":
        quest_status.text = str(quest.mission.get("title")) + ": " + str(quest.mission.get("object")) + " " + str(quest.visited.size()) + "/" + str(quest.mission.get("count")) + ". Tap illuminated markers to walk."
    elif quest.phase == "return":
        quest_status.text = "Return to the green beacon to finish."
    elif quest.phase == "complete":
        quest_status.text = "Adventure complete! Continue to the next challenge or replay. No BP, XP or wallet credit."
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
    result["skinned_avatar"] = player != null and not player.find_children("*", "Skeleton3D", true, false).is_empty()
    result["guide_near"] = guide_near
    return result
