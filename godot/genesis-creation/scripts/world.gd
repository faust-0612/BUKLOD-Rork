extends Node3D
## Original lightweight Genesis Creation 3D scene. Purely cosmetic, no client XP/points authority.
var orbs: Array[Node3D] = []
var lights: Array[OmniLight3D] = []
var fragments: Array[Node3D] = []
var clock: float = 0.0

func _material(base: Color, glowing: bool = false) -> StandardMaterial3D:
    var m: StandardMaterial3D = StandardMaterial3D.new()
    m.albedo_color = base
    m.roughness = 0.45
    if glowing:
        m.emission_enabled = true
        m.emission = base
        m.emission_energy_multiplier = 2.2
    return m

func _sphere(radius: float, tint: Color, parent: Node3D) -> MeshInstance3D:
    var mesh: SphereMesh = SphereMesh.new()
    mesh.radius = radius
    mesh.height = radius * 2.0
    mesh.radial_segments = 24
    mesh.rings = 12
    var result: MeshInstance3D = MeshInstance3D.new()
    result.mesh = mesh
    result.material_override = _material(tint,true)
    parent.add_child(result)
    return result

func _ready() -> void:
    var env_node: WorldEnvironment = WorldEnvironment.new()
    var env: Environment = Environment.new()
    env.background_mode = Environment.BG_COLOR
    env.background_color = Color("#040914")
    env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.ambient_light_color = Color("#667fa9")
    env.ambient_light_energy = 0.38
    env_node.environment = env
    add_child(env_node)
    var camera: Camera3D = Camera3D.new()
    camera.position = Vector3(0.0, 8.0, 22.0)
    camera.look_at(Vector3.ZERO, Vector3.UP)
    camera.current = true
    add_child(camera)
    var main_light: OmniLight3D = OmniLight3D.new()
    main_light.light_color = Color("#e7f4ff")
    main_light.light_energy = 3.3
    main_light.omni_range = 18
    add_child(main_light)
    lights.append(main_light)
    var creation_seed: Node3D = Node3D.new()
    add_child(creation_seed)
    _sphere(1.1,Color("#f4e3a1"),creation_seed)
    orbs.append(creation_seed)
    for i in range(1,7):
        var orbit: Node3D = Node3D.new()
        add_child(orbit)
        var distance: float = 2.6 + float(i) * 1.4
        var angle: float = float(i) * 2.399963
        orbit.position = Vector3(cos(angle) * distance,sin(angle * 2.0)*1.9,sin(angle)*distance*0.5)
        var hue: float = fmod(0.13 + float(i) * 0.117,1.0)
        _sphere(0.42 + float(i % 3) * 0.17, Color.from_hsv(hue,0.56,0.92),orbit)
        orbs.append(orbit)
    var rnd: RandomNumberGenerator = RandomNumberGenerator.new()
    rnd.seed = 20261206
    for i in range(90):
        var fragment: Node3D = Node3D.new()
        fragment.position = Vector3(rnd.randf_range(-17.0,17.0),rnd.randf_range(-8.0,8.0),rnd.randf_range(-12.0,6.0))
        add_child(fragment)
        _sphere(rnd.randf_range(0.015,0.045),Color("#c0e8ff"),fragment)
        fragments.append(fragment)
    var sun: DirectionalLight3D = DirectionalLight3D.new()
    sun.light_color = Color("#9cb7ff")
    sun.light_energy = 1.1
    sun.rotation_degrees = Vector3(-35,40,0)
    add_child(sun)
    _hud()

func _hud() -> void:
    var layer: CanvasLayer = CanvasLayer.new()
    add_child(layer)
    var title: Label = Label.new()
    title.text = "GENESIS: LET THERE BE LIGHT"
    title.position = Vector2(34,28)
    title.add_theme_font_size_override("font_size",30)
    layer.add_child(title)
    var caption: Label = Label.new()
    caption.text = "CREATION · ANDROID GODOT ENGINE PREVIEW · NO REWARDS"
    caption.position = Vector2(36,76)
    caption.add_theme_font_size_override("font_size",13)
    layer.add_child(caption)

func _process(delta: float) -> void:
    clock += delta
    for i in range(orbs.size()):
        orbs[i].rotate_y(delta * (0.24 + float(i) * 0.07))
        orbs[i].position.y += sin(clock * 0.57 + float(i)) * delta * 0.09
    for i in range(fragments.size()):
        fragments[i].position.y += sin(clock * 0.65 + float(i) * 0.9) * delta * 0.028
    lights[0].light_energy = 2.8 + sin(clock * 1.0) * 0.35
