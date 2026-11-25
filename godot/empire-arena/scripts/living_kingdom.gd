## Independent Kingdom adventure on the existing reviewed 3D renderer.
## Shared rig is an explorer, not a claim of 13 individually modeled heroes.
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
var target_nodes: Array[Node3D] = []
var quest_status: Label
var return_marker: Node3D
var world_sun: DirectionalLight3D
var night := false
var pending_target := -1
var realm_visuals: Node3D
var guide: Sprite3D
var guide_texture_cache: Dictionary = {}
var ground_material: StandardMaterial3D
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
    ground_material = StandardMaterial3D.new()
    ground_material.roughness = 0.92
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
    guide = Sprite3D.new()
    guide.billboard = BaseMaterial3D.BILLBOARD_ENABLED
    guide.hframes = 4
    guide.vframes = 2
    guide.position = Vector3(0, 1.65, -1.5)
    add_child(guide)
    guide_label = Label3D.new()
    guide_label.position = Vector3(0, 3.3, -1.5)
    guide_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
    guide_label.font_size = 40
    guide_label.pixel_size = 0.012
    guide_label.outline_size = 9
    add_child(guide_label)

func _guide_texture(id: String) -> Texture2D:
    if guide_texture_cache.has(id):
        return guide_texture_cache[id]
    var bytes := FileAccess.get_file_as_bytes("res://art/fullbody/" + id + "_idle.png")
    var img := Image.new()
    if bytes.is_empty() or img.load_png_from_buffer(bytes) != OK or img.get_width() % 4 != 0 or img.get_height() % 2 != 0:
        return null
    var texture := ImageTexture.create_from_image(img)
    # Keep only two decoded atlases; never load all 13 at once.
    if guide_texture_cache.size() >= 2:
        guide_texture_cache.clear()
    guide_texture_cache[id] = texture
    return texture

func _realm_prop(id: String, at: Vector3, size: float, angle: float) -> void:
    if realm_visuals.get_child_count() >= 20:
        return
    var template: Node3D = _model(id)
    if template == null:
        return
    var prop: Node3D = template.duplicate()
    prop.position = at
    prop.scale = Vector3.ONE * size
    prop.rotation.y = angle
    realm_visuals.add_child(prop)

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
    ground_material.albedo_color = Color(str(realm_profile.get("ground", "#6b8b45")))
    var accent := Color(str(realm_profile.get("accent", "#ffe1a0")))
    var props: Array = realm_profile.get("props", [])
    var layout := int(realm_profile.get("layout", 0))
    # Real imported props and varied perimeter arrangements. Keep open mission corridors.
    if props.size() == 4:
        for i in range(12):
            var side := -1.0 if i < 6 else 1.0
            var z := -13.0 + float(i % 6) * 5.2
            var x := side * (13.0 + float((i + layout) % 3))
            _realm_prop(str(props[(i + layout) % 4]), Vector3(x, 0, z), 1.5 + float((i + layout) % 3) * 0.3, float(i + layout) * 0.54)
        for i in range(3):
            _realm_prop(str(props[i]), Vector3(-8.0 + i * 8.0, 0, -15.0), 1.8, float(layout) * 0.3)
    # Different layouts, all within visible traversable ground. Phan retains original coordinates.
    var angle := 0.0 if str(realm.get("id")) == "phan" else float(layout) * 0.48
    for i in range(TARGETS.size()):
        mission_targets[i] = TARGETS[i].rotated(Vector3.UP, angle)
        target_nodes[i].position = mission_targets[i] + Vector3(0, 0.12, 0)
        var mat: StandardMaterial3D = target_nodes[i].material_override
        mat.albedo_color = accent
        mat.emission = accent
    guide.texture = _guide_texture(str(realm.get("id", "")))
    if guide.texture != null:
        guide.pixel_size = 2.5 / float(guide.texture.get_height() / 2)
    guide.visible = guide.texture != null
    guide_label.text = str(realm.get("theme", "")) + " GUIDE"
    guide_label.modulate = accent
    guide_talking = false
    guide_notice.text = str(realm_profile.get("biome", "")) + " • " + str(realm.get("theme", ""))
    _apply_daylight()

func _apply_daylight() -> void:
    if world_sun == null or realm_environment == null:
        return
    var sun_amount := 0.0 if night else (0.65 + 0.35 * sin(day_phase * TAU))
    world_sun.light_energy = lerpf(0.27, 1.7, sun_amount)
    world_sun.light_color = Color("#b3cbff").lerp(Color("#fff3d2"), sun_amount)
    var sky := Color(str(realm_profile.get("sky", "#a6d3f0")))
    realm_environment.background_color = Color("#172440").lerp(sky, sun_amount)
    realm_environment.ambient_light_energy = lerpf(0.42, 0.82, sun_amount)

func _marker(at: Vector3, tint: Color) -> Node3D:
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
    guide_notice.text = str(realm_profile.get("dialogue", ""))

func _select_realm(index: int) -> void:
    if quest.phase in ["active", "return"]:
        return
    if index < 0 or index >= realms.size():
        return
    realm_index = index
    _refresh_missions()
    _apply_realm_visuals()

func _refresh_missions() -> void:
    mission_picker.clear()
    mission_index = 0
    if realm_index >= realms.size():
        action_button.disabled = true
        return
    for mission in realms[realm_index].get("missions", []):
        mission_picker.add_item(str(mission.get("title", "")))

func _start_or_cancel() -> void:
    if quest.phase in ["active", "return"]:
        quest.cancel()
    elif realm_index < realms.size():
        var missions: Array = realms[realm_index].get("missions", [])
        if mission_index < missions.size():
            quest.begin(missions[mission_index])
    pending_target = -1
    destination = player.position
    _update_quest_status()

func move_to(point: Vector3) -> bool:
    if not point.is_finite() or absf(point.x) > 24.0 or absf(point.z) > 17.5:
        return false
    if not super.move_to(point):
        return false
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
    super._process(delta)
    if sky_auto:
        day_phase = fposmod(day_phase + minf(delta, 0.05) / 240.0, 1.0)
        _apply_daylight()
    if guide != null:
        guide.frame = int(elapsed * 5.0) % 8
        guide_near = player.position.distance_to(Vector3(0, 0, -1.5)) <= 3.2
        talk_button.disabled = not guide_near
        if guide_talking and not guide_near:
            guide_talking = false
            guide_notice.text = str(realm_profile.get("biome", ""))
    if pending_target < 0 or player.position.distance_to(destination) > 1.0:
        return
    var index := pending_target
    pending_target = -1
    if index == 3:
        quest.finish(player.position.distance_to(START))
    else:
        quest.visit(index, player.position.distance_to(mission_targets[index]))
    _update_quest_status()

func _update_quest_status() -> void:
    var active: bool = quest.phase in ["active", "return"]
    realm_picker.disabled = active
    mission_picker.disabled = active
    action_button.text = "CANCEL ADVENTURE" if active else "START ADVENTURE"
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
        quest_status.text = "Adventure complete! Session practice only. No BP, XP or wallet credit."
    else:
        quest_status.text = "Choose a realm and adventure. Session practice, no account rewards."

func get_dev_snapshot() -> Dictionary:
    var result := super.get_dev_snapshot()
    result["realms"] = realms.size()
    result["phase"] = quest.phase
    result["local_completed"] = quest.completed.duplicate()
    result["biome"] = realm_profile.get("biome", "")
    result["realm_props"] = realm_visuals.get_child_count() if realm_visuals != null else 0
    result["guide_ready"] = guide != null and guide.texture != null
    result["guide_near"] = guide_near
    return result
