## BUKLOD Genesis 2.0.6 - REAL Godot 4.7.2 binary glTF 3D explorer.
## Uses only Git-blob-pinned Kenney CC0 GLB meshes shipped in the verified ZIP.
## Arena combat remains on the canonical 2D offline-practice scene. This
## separate 3D preview does NOT impersonate the 13 characters or unlock rewards.
extends Node3D

const KENNEY_MODELS := [
  "arena_ground","arena_tower","arena_gate","arena_flag","arena_crystal",
  "arena_hero_a","arena_hero_b","kingdom_rocks","kingdom_tree","kingdom_wall",
  "house_building","house_building_2","house_tree","house_fence","house_path",
  "house_bed","house_table","house_chair","house_bookcase","kingdom_chest",
  "rig_knight","rig_mage"
]
const PRIVATE_MODEL_IDS := [
  "private_t1_sentinel","private_azure_champion","private_hooded_blade",
  "private_magic_scroll","private_desert_watchtower"
]
const MAX_TEMPLATES := 22
const MAX_MESH_SCENES := 65
const WALK_SPEED := 7.0
const AREA_LIMIT := 24.0

var world_id := "arena"
var player: Node3D
var camera: Camera3D
var destination := Vector3(0, 0, 0)
var model_templates: Dictionary = {}
var visual_count := 0
var elapsed := 0.0
var stage := 0
var near_destination := false
var reaction: MeshInstance3D
var reaction_time := 0.0
var label: Label
var worlds_title: Label
var quality := false
var animation_state := ""
var private_fx_sprite: Sprite3D
var private_fx_atlas: AtlasTexture
var private_fx_elapsed := 0.0
const PRIVATE_ARENA_FX := "res://private-fx/glacial_vortex_absolute_zero_frozen_abyss_vortex_south.png"
const PRIVATE_ARENA_FX_FRAMES := 35
const PRIVATE_ARENA_FX_FPS := 12.0
const PRIVATE_ARENA_FX_SIZE := 256

func _ready() -> void:
    world_id = _get_world()
    Engine.max_fps = 30
    _setup_world()
    _install_environment()
    _build_props()
    _build_avatar()
    _install_camera()
    _install_controls()
    print("BUKLOD_PREMIUM_3D_WORLD_READY: ", world_id, " models=", visual_count)
    set_process(true)
    set_process_unhandled_input(true)

func _get_world() -> String:
    for arg in OS.get_cmdline_user_args():
        var text: String = str(arg)
        if text.begins_with("--buklod-world="):
            var value: String = text.trim_prefix("--buklod-world=")
            if value in ["kingdom", "house", "community"]:
                return value
    return "arena"

func _model(id: String) -> Node3D:
    if not id in KENNEY_MODELS and not id in PRIVATE_MODEL_IDS:
        return null
    if model_templates.size() >= MAX_TEMPLATES + PRIVATE_MODEL_IDS.size():
        return null
    if model_templates.has(id):
        return model_templates[id]
    var folder := ("res://3d/private/" if id.begins_with("private_") else
        "res://3d/kaykit/" if id.begins_with("rig_") else "res://3d/kenney/")
    var bytes := FileAccess.get_file_as_bytes(folder + id + ".glb")
    if bytes.size() < 2000 or bytes.size() > (40 * 1024 * 1024 if id.begins_with("private_") else 5000000):
        return null
    var doc := GLTFDocument.new()
    var state := GLTFState.new()
    if doc.append_from_buffer(bytes, folder, state) != OK:
        return null
    var scene: Node = doc.generate_scene(state)
    if not (scene is Node3D):
        return null
    model_templates[id] = scene
    return scene

func _place(id: String, at: Vector3, size: float = 1.0, rotate_y: float = 0.0) -> Node3D:
    if visual_count >= MAX_MESH_SCENES:
        return null
    var template: Node3D = _model(id)
    if template == null:
        return null
    var mesh: Node3D = template.duplicate()
    if mesh == null:
        return null
    mesh.position = at
    mesh.scale = Vector3.ONE * clampf(size, 0.35, 5.0)
    mesh.rotation.y = rotate_y
    add_child(mesh)
    visual_count += 1
    return mesh

func _setup_world() -> void:
    var floor := MeshInstance3D.new()
    var ground := PlaneMesh.new()
    ground.size = Vector2(55, 38)
    floor.mesh = ground
    var ground_mat := StandardMaterial3D.new()
    ground_mat.albedo_color = (
        Color("#354c45") if world_id == "kingdom" else
        Color("#54715b") if world_id == "house" else
        Color("#645749"))
    ground_mat.roughness = 0.9
    floor.material_override = ground_mat
    floor.position.y = -0.04
    add_child(floor)

func _install_environment() -> void:
    var env_node := WorldEnvironment.new()
    var environment := Environment.new()
    environment.background_mode = Environment.BG_COLOR
    environment.background_color = (
        Color("#a7c3cd") if world_id == "house" else
        Color("#8aaeb9") if world_id == "kingdom" else Color("#c19e82"))
    environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    environment.ambient_light_color = Color("#e3e6f2")
    environment.ambient_light_energy = 0.65
    env_node.environment = environment
    add_child(env_node)
    var sun := DirectionalLight3D.new()
    sun.rotation_degrees = Vector3(-50, 32, -18)
    sun.light_energy = 1.7
    sun.shadow_enabled = true
    add_child(sun)

func _build_props() -> void:
    if world_id == "arena":
        _place("arena_gate", Vector3(0, 0, -12), 2.3)
        if FileAccess.file_exists("res://3d/private/private_desert_watchtower.glb"):
            _place("private_desert_watchtower", Vector3(-17, 0, -13), 1.7)
        for x in [-13.0, 13.0]:
            for z in [-9.0, 9.0]:
                _place("arena_tower", Vector3(x, 0, z), 2.0)
                _place("arena_flag", Vector3(x + 1.0, 3.0, z), 1.5)
        for x in [-8.0, 8.0]:
            _place("arena_crystal", Vector3(x, 0.8, 0), 2.2)
        _place("arena_ground", Vector3(0, -0.01, 0), 5.0)
    elif world_id == "kingdom":
        _place("arena_gate", Vector3(0, 0, -13), 2.5)
        if FileAccess.file_exists("res://3d/private/private_magic_scroll.glb"):
            _place("private_magic_scroll", Vector3(6, 0.4, -6), 0.8)
        for x in [-15.0, 15.0]:
            for z in [-10.0, 10.0]:
                _place("arena_tower", Vector3(x, 0, z), 2.3)
        for x in [-10.0, 0.0, 10.0]:
            _place("kingdom_wall", Vector3(x, 0, -14.0), 2.0)
        for x in [-13.0, 13.0]:
            _place("kingdom_tree", Vector3(x, 0, 3), 2.4)
        _place("kingdom_chest", Vector3(0, 0.1, -6), 1.5)
    elif world_id == "house":
        _place("house_building", Vector3(0, 0, -9), 2.3)
        _place("house_building_2", Vector3(11, 0, -14), 1.3)
        for x in [-12.0, 12.0]:
            _place("house_tree", Vector3(x, 0, 2), 2.1)
            _place("house_fence", Vector3(x, 0, -7.0), 2.1)
        _place("house_path", Vector3(0, 0, 1), 3.0)
        _place("house_table", Vector3(-5, 0, 7), 1.9)
        _place("house_chair", Vector3(-3, 0, 7), 1.8)
        _place("house_bookcase", Vector3(8, 0, -2), 1.6)
        _place("house_bed", Vector3(-8, 0, -2), 1.6)
    else:
        for x in [-10.0, 0.0, 10.0]:
            _place("house_building", Vector3(x, 0, -11), 1.5)
            _place("house_tree", Vector3(x + 4, 0, 4), 1.9)
        _place("house_path", Vector3(0, 0, 3), 3.0)

func _build_avatar() -> void:
    player = Node3D.new()
    player.name = "LocalExplorer"
    add_child(player)
    var avatar_model: Node3D = null
    # World-specific private avatars are optional; missing/licensing-gated assets
    # always fall back to the two SHA-verified public CC0 KayKit rigs.
    var private_avatar := (
        "private_azure_champion" if world_id == "kingdom" else
        "private_hooded_blade" if world_id == "house" else
        "private_t1_sentinel"
    )
    if FileAccess.file_exists("res://3d/private/" + private_avatar + ".glb"):
        avatar_model = _model(private_avatar)
    if avatar_model == null:
        avatar_model = _model("rig_knight")
    if avatar_model == null:
        avatar_model = _model("arena_hero_a")
    if avatar_model != null:
        var mesh: Node3D = avatar_model.duplicate()
        mesh.scale = Vector3.ONE * 1.3
        player.add_child(mesh)
        visual_count += 1
    var highlight := MeshInstance3D.new()
    var halo_mesh := CylinderMesh.new()
    halo_mesh.top_radius = 0.85
    halo_mesh.bottom_radius = 0.85
    halo_mesh.height = 0.035
    highlight.mesh = halo_mesh
    var halo_material := StandardMaterial3D.new()
    halo_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
    halo_material.albedo_color = Color(0.29, 0.96, 0.63, 0.6)
    highlight.material_override = halo_material
    highlight.position = Vector3(0, 0.03, 0)
    player.add_child(highlight)
    _play_avatar_animation("Idle")
    _install_private_fx()
    reaction = MeshInstance3D.new()
    var sphere := SphereMesh.new()
    sphere.radius = 0.5
    sphere.height = 1.0
    reaction.mesh = sphere
    var glow := StandardMaterial3D.new()
    glow.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
    glow.albedo_color = Color("#ffdc80")
    reaction.material_override = glow
    reaction.visible = false
    player.add_child(reaction)

## Optional original 2D vortex is displayed as a world-space sprite only when
## the separately reviewed finished-game animation pack is present.
## It never controls combat, rewards, hit registration or progression.
func _install_private_fx() -> void:
    if world_id != "arena" or not FileAccess.file_exists(PRIVATE_ARENA_FX):
        return
    var bytes := FileAccess.get_file_as_bytes(PRIVATE_ARENA_FX)
    if bytes.size() < 100 or bytes.size() > 4 * 1024 * 1024:
        return
    var img := Image.new()
    if img.load_png_from_buffer(bytes) != OK:
        return
    if img.get_width() != 8 * PRIVATE_ARENA_FX_SIZE or img.get_height() != 5 * PRIVATE_ARENA_FX_SIZE:
        return
    private_fx_atlas = AtlasTexture.new()
    private_fx_atlas.atlas = ImageTexture.create_from_image(img)
    private_fx_atlas.region = Rect2(0, 0, PRIVATE_ARENA_FX_SIZE, PRIVATE_ARENA_FX_SIZE)
    private_fx_sprite = Sprite3D.new()
    private_fx_sprite.texture = private_fx_atlas
    private_fx_sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
    private_fx_sprite.pixel_size = 0.012
    private_fx_sprite.position = Vector3(0, 1.25, 0)
    private_fx_sprite.visible = false
    player.add_child(private_fx_sprite)

## Select an actual embedded authored animation; preserve a still fallback.
func _play_avatar_animation(desired: String) -> void:
    if player == null or desired == animation_state:
        return
    for node in player.find_children("*", "AnimationPlayer", true, false):
        if node is AnimationPlayer:
            var clips: PackedStringArray = node.get_animation_list()
            # Exact semantic match first: avoid picking sword_idle before idle.
            var want := desired.to_lower()
            for clip in clips:
                if str(clip).to_lower() == want:
                    node.play(clip)
                    animation_state = desired
                    return
            for clip in clips:
                var name := str(clip).to_lower()
                if want in name or (want == "attack" and
                        ("sword_regular_a" in name or "punch_jab" in name or "kick" in name)):
                    node.play(clip)
                    animation_state = desired
                    return

func _install_camera() -> void:
    camera = Camera3D.new()
    camera.current = true
    camera.fov = 52.0
    camera.near = 0.1
    camera.far = 160.0
    camera.position = Vector3(0, 19, 22)
    add_child(camera)
    camera.look_at(Vector3.ZERO, Vector3.UP)

func _install_controls() -> void:
    var layer := CanvasLayer.new()
    add_child(layer)
    worlds_title = Label.new()
    worlds_title.text = "BUKLOD " + world_id.to_upper() + " • REAL 3D ENVIRONMENT"
    worlds_title.add_theme_font_size_override("font_size", 25)
    worlds_title.position = Vector2(32, 24)
    layer.add_child(worlds_title)
    label = Label.new()
    label.text = "TOUCH GROUND TO WALK • OFFLINE VISUAL PREVIEW • NO REWARDS"
    label.position = Vector2(32, 65)
    label.add_theme_font_size_override("font_size", 15)
    layer.add_child(label)
    var back := Button.new()
    back.text = "BACK"
    back.position = Vector2(1090, 16)
    back.custom_minimum_size = Vector2(150, 56)
    back.pressed.connect(_back_to_2d)
    layer.add_child(back)
    var interact := Button.new()
    interact.text = "3D ACTION"
    interact.position = Vector2(1060, 626)
    interact.custom_minimum_size = Vector2(170, 58)
    interact.pressed.connect(_react)
    layer.add_child(interact)

func _back_to_2d() -> void:
    var target := "res://scenes/Arena.tscn" if world_id == "arena" else "res://scenes/WorldPreview.tscn"
    get_tree().change_scene_to_file(target)

func _react() -> void:
    reaction_time = 0.6
    _play_avatar_animation("Attack")
    if private_fx_sprite != null:
        private_fx_elapsed = 0.0
        private_fx_sprite.visible = true
    if reaction != null:
        reaction.visible = true
    if world_id == "house" and player.position.distance_to(Vector3(0, 0, -9)) <= 5.5:
        stage = mini(stage + 1, 4)
        label.text = "BUILD VISUAL STAGE " + str(stage + 1) + "/5 • NO PROPERTY UNLOCK"
    else:
        label.text = "3D ANIMATION PREVIEW • NO DAMAGE / XP / BP / WALLET UPDATES"

func move_to(point: Vector3) -> bool:
    if absf(point.x) > AREA_LIMIT or absf(point.z) > AREA_LIMIT:
        return false
    destination = Vector3(point.x, 0, point.z)
    return true

func _unhandled_input(event: InputEvent) -> void:
    var screen := Vector2(-1, -1)
    if event is InputEventScreenTouch and event.pressed:
        screen = event.position
    elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
        screen = event.position
    if screen.x < 0 or screen.y < 100 or screen.y > 616:
        return
    var ray_start := camera.project_ray_origin(screen)
    var ray_direction := camera.project_ray_normal(screen)
    var plane := Plane(Vector3.UP, 0.0)
    var impact = plane.intersects_ray(ray_start, ray_direction)
    if impact is Vector3 and move_to(impact):
        get_viewport().set_input_as_handled()

func _process(delta: float) -> void:
    var dt := minf(delta, 0.05)
    elapsed += dt
    if player != null:
        var before := player.position
        player.position = player.position.move_toward(destination, WALK_SPEED * dt)
        var motion := player.position - before
        if reaction_time <= 0.0:
            _play_avatar_animation("Walk" if motion.length_squared() > 0.00001 else "Idle")
        if motion.length_squared() > 0.00001:
            player.rotation.y = atan2(motion.x, motion.z)
            if player.get_child_count() > 0:
                var child: Node = player.get_child(0)
                if child is Node3D:
                    child.position.y = 0.07 * sin(elapsed * 11.0)
        if camera != null:
            var target_pos: Vector3 = player.position + Vector3(0, 19, 22)
            camera.position = camera.position.lerp(target_pos, minf(1.0, dt * 3.2))
            camera.look_at(player.position, Vector3.UP)
    if private_fx_sprite != null and private_fx_sprite.visible:
        private_fx_elapsed += dt
        var frame := int(private_fx_elapsed * PRIVATE_ARENA_FX_FPS)
        if frame >= PRIVATE_ARENA_FX_FRAMES:
            private_fx_sprite.visible = false
        elif private_fx_atlas != null:
            private_fx_atlas.region = Rect2(
                (frame % 8) * PRIVATE_ARENA_FX_SIZE,
                int(frame / 8) * PRIVATE_ARENA_FX_SIZE,
                PRIVATE_ARENA_FX_SIZE, PRIVATE_ARENA_FX_SIZE)
    if reaction_time > 0:
        reaction_time = maxf(0.0, reaction_time - dt)
        if reaction != null:
            reaction.visible = reaction_time > 0
            reaction.scale = Vector3.ONE * (1.0 + (0.6 - reaction_time) * 3.0)

func get_dev_snapshot() -> Dictionary:
    return {
        "world": world_id, "models": visual_count, "imported": model_templates.size(), "rigged_available": model_templates.has("rig_knight") or model_templates.has("private_t1_sentinel"),
        "private_library_loaded": model_templates.has("private_t1_sentinel") or model_templates.has("private_azure_champion") or model_templates.has("private_hooded_blade"),
        "private_fx_available": private_fx_sprite != null,
        "offline": true, "server_settlement": false,
        "pos": player.position if player != null else Vector3.ZERO
    }
