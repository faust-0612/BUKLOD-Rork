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

func _get_world() -> String:
    return "kingdom"

func _ready() -> void:
    var raw := FileAccess.get_file_as_bytes("res://data/kingdom_realms.json")
    var parsed: Variant = JSON.parse_string(raw.get_string_from_utf8())
    if parsed is Dictionary and parsed.get("schema") == 1 and parsed.get("serverSettlement") == false:
        realms = parsed.get("realms", [])
    super._ready()
    _refresh_missions()
    _update_quest_status()
    print("BUKLOD_LIVING_KINGDOM_READY: realms=", realms.size())

func _build_props() -> void:
    # Perimeter props leave mission corridors unobstructed; real navmesh is a later gate.
    _place("arena_gate", Vector3(0, 0, -15), 2.2)
    for x in [-15.0, 15.0]:
        for z in [-11.0, 11.0]:
            _place("arena_tower", Vector3(x, 0, z), 2.0)
        for z in [-6.0, 0.0, 6.0]:
            _place("kingdom_tree", Vector3(x, 0, z), 2.2)
    for x in [-9.0, 0.0, 9.0]:
        _place("kingdom_wall", Vector3(x, 0, -16), 1.8)
    for i in range(TARGETS.size()):
        var marker := _marker(TARGETS[i], Color("#f7d68b"))
        target_nodes.append(marker)
        marker.visible = false
    return_marker = _marker(START, Color("#77f1c5"))
    return_marker.visible = false

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
    var back := Button.new()
    back.text = "BACK TO BUKLOD"
    back.position = Vector2(1000, 20)
    back.custom_minimum_size = Vector2(240, 54)
    back.pressed.connect(func() -> void: get_tree().quit())
    layer.add_child(back)
    for child in get_children():
        if child is DirectionalLight3D:
            world_sun = child

func _toggle_sky() -> void:
    night = not night
    if world_sun != null:
        world_sun.light_energy = 0.35 if night else 1.7
        world_sun.light_color = Color("#b3cbff") if night else Color("#fff3d2")

func _select_realm(index: int) -> void:
    if quest.phase in ["active", "return"]:
        return
    realm_index = index
    _refresh_missions()

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
    if not super.move_to(point):
        return false
    pending_target = -1
    if quest.phase == "active":
        for i in range(int(quest.mission.get("count", 0))):
            if not quest.visited.has(i) and point.distance_to(TARGETS[i]) <= 2.2:
                pending_target = i
                destination = TARGETS[i]
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
    if pending_target < 0 or player.position.distance_to(destination) > 1.0:
        return
    var index := pending_target
    pending_target = -1
    if index == 3:
        quest.finish(player.position.distance_to(START))
    else:
        quest.visit(index, player.position.distance_to(TARGETS[index]))
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
    return result
