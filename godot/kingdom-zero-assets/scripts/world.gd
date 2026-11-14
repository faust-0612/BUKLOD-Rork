extends Node3D
## BUKLOD Godot 4 procedural living world. Standalone local concept only:
## no account, cash, score, online service, telemetry, purchase or persistent save.
const Data = preload("res://scripts/kingdom_data.gd")
const MAX_SUPPLIES: int = 16
const BUILD_COST: int = 4
const SUPPLY_INTERVAL: float = 6.0
const WORKER_COUNT: int = 8

var settlements: Array[Node3D] = []
var villagers: Array[Node3D] = []
var camera: Camera3D
var selected: int = 5
var constructed: Dictionary = {}
var supplies: int = 8
var elapsed: float = 0.0
var harvest_elapsed: float = 0.0
var camera_target: Vector3 = Vector3.ZERO
var zoom: float = 36.0
var dragging: bool = false
var drag_pixels: float = 0.0
var title: Label
var supplies_label: Label
var message: Label
var build_button: Button
var cursor: MeshInstance3D

func _ready() -> void:
    _world_lighting()
    _build_land()
    _build_roads()
    _build_trees()
    _build_settlements()
    _spawn_workers()
    _build_camera()
    _build_hud()
    _choose(5)

func _material(color_string: String) -> StandardMaterial3D:
    var result: StandardMaterial3D = StandardMaterial3D.new()
    result.albedo_color = Color(color_string)
    result.roughness = 0.86
    return result

func _box(parent: Node3D, size: Vector3, at: Vector3, tint: String) -> MeshInstance3D:
    var shape: BoxMesh = BoxMesh.new()
    shape.size = size
    var mesh: MeshInstance3D = MeshInstance3D.new()
    mesh.mesh = shape
    mesh.material_override = _material(tint)
    mesh.position = at
    parent.add_child(mesh)
    return mesh

func _pillar(parent: Node3D, radius: float, height: float, at: Vector3, tint: String) -> MeshInstance3D:
    var shape: CylinderMesh = CylinderMesh.new()
    shape.top_radius = radius
    shape.bottom_radius = radius
    shape.height = height
    var mesh: MeshInstance3D = MeshInstance3D.new()
    mesh.mesh = shape
    mesh.material_override = _material(tint)
    mesh.position = at
    parent.add_child(mesh)
    return mesh

func _world_lighting() -> void:
    var sky: WorldEnvironment = WorldEnvironment.new()
    var ambient: Environment = Environment.new()
    ambient.background_mode = Environment.BG_COLOR
    ambient.background_color = Color("#a8dce6")
    ambient.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    ambient.ambient_light_color = Color("#f3f6e6")
    ambient.ambient_light_energy = 0.75
    sky.environment = ambient
    add_child(sky)
    var sun: DirectionalLight3D = DirectionalLight3D.new()
    sun.rotation_degrees = Vector3(-62, -29, 0)
    sun.light_energy = 1.05
    sun.shadow_enabled = false
    add_child(sun)

func _build_land() -> void:
    _box(self, Vector3(63, 0.75, 50), Vector3(0,-0.48,0), "#407b67")
    _box(self, Vector3(59, 0.07, 45), Vector3(0,-0.07,0), "#81b584")
    _box(self, Vector3(13, 0.04, 3.0), Vector3(-15.4,0.02,0), "#55b5c4")
    _box(self, Vector3(10, 0.04, 2.1), Vector3(13.1,0.02,-10.1), "#52b6cc")
    for i in range(8):
        var x: float = -23.0 + 6.5 * float(i)
        _pillar(self, 1.6, 2.5, Vector3(x,0.85,-20), "#718f82")

func _road(a: Vector3, b: Vector3) -> void:
    var delta: Vector3 = b - a
    var strip: MeshInstance3D = _box(self, Vector3(0.38,0.04,delta.length()),
        (a+b)*0.5 + Vector3(0,0.02,0), "#eed9ac")
    strip.rotation.y = atan2(delta.x,delta.z)

func _build_roads() -> void:
    for pair in Data.ROADS:
        _road(Data.project(Data.STATIONS[pair.x]), Data.project(Data.STATIONS[pair.y]))

func _build_trees() -> void:
    # Shared mesh: 72 trees cost only two multi-mesh draw batches.
    var trunks: MultiMesh = MultiMesh.new()
    var crowns: MultiMesh = MultiMesh.new()
    trunks.transform_format = MultiMesh.TRANSFORM_3D
    crowns.transform_format = MultiMesh.TRANSFORM_3D
    var wood: CylinderMesh = CylinderMesh.new()
    wood.top_radius = 0.08
    wood.bottom_radius = 0.14
    wood.height = 1.2
    var foliage: CylinderMesh = CylinderMesh.new()
    foliage.top_radius = 0.0
    foliage.bottom_radius = 0.72
    foliage.height = 2.1
    trunks.mesh = wood
    crowns.mesh = foliage
    trunks.instance_count = 72
    crowns.instance_count = 72
    var rng: RandomNumberGenerator = RandomNumberGenerator.new()
    rng.seed = 20261114
    for i in range(72):
        var x: float = rng.randf_range(-24,24)
        var z: float = rng.randf_range(-16,16)
        for station in Data.STATIONS:
            var point: Vector3 = Data.project(station)
            if Vector2(x,z).distance_to(Vector2(point.x,point.z)) < 2.5:
                x = clampf(x+3.1,-24,24)
        trunks.set_instance_transform(i,
            Transform3D(Basis(),Vector3(x,0.6,z)))
        crowns.set_instance_transform(i,
            Transform3D(Basis(),Vector3(x,2.0,z)))
    var trunk_batch: MultiMeshInstance3D = MultiMeshInstance3D.new()
    trunk_batch.multimesh = trunks
    trunk_batch.material_override = _material("#73594a")
    add_child(trunk_batch)
    var crown_batch: MultiMeshInstance3D = MultiMeshInstance3D.new()
    crown_batch.multimesh = crowns
    crown_batch.material_override = _material("#2f785c")
    add_child(crown_batch)

func _build_settlements() -> void:
    for data in Data.STATIONS:
        var site: Node3D = Node3D.new()
        site.name = String(data["id"])
        site.position = Data.project(data)
        add_child(site)
        _pillar(site,0.95,0.16,Vector3(0,0.09,0),"#e3d6b6")
        _box(site,Vector3(0.95,0.8,0.9),Vector3(0,0.55,0),"#e4d6bd")
        _box(site,Vector3(1.14,0.22,1.08),Vector3(0,1.08,0),String(data["color"]))
        _box(site,Vector3(0.26,0.42,0.07),Vector3(0,0.40,0.49),"#4a4540")
        settlements.append(site)
    cursor = _pillar(self,1.22,0.055,Vector3.ZERO,"#fff1ba")

func _spawn_workers() -> void:
    for i in range(WORKER_COUNT):
        var worker: Node3D = Node3D.new()
        worker.name = "Villager%d" % i
        _pillar(worker,0.15,0.44,Vector3(0,0.38,0),
            "#dbba7d" if i%2 == 0 else "#9bd2ce")
        _pillar(worker,0.135,0.18,Vector3(0,0.69,0),"#f2d1b1")
        add_child(worker)
        villagers.append(worker)

func _build_camera() -> void:
    camera = Camera3D.new()
    camera.projection = Camera3D.PROJECTION_ORTHOGONAL
    camera.size = zoom
    camera.near = 0.15
    camera.far = 140
    camera.current = true
    add_child(camera)
    _sync_camera()

func _sync_camera() -> void:
    if not is_instance_valid(camera):
        return
    camera.size = zoom
    camera.position = camera_target + Vector3(0,35,32)
    camera.look_at(camera_target,Vector3.UP)

func _button(text_value: String, callback: Callable) -> Button:
    var control: Button = Button.new()
    control.text = text_value
    control.custom_minimum_size = Vector2(105,55)
    control.pressed.connect(callback)
    return control

func _build_hud() -> void:
    var layer: CanvasLayer = CanvasLayer.new()
    add_child(layer)
    var root: Control = Control.new()
    root.set_anchors_preset(Control.PRESET_FULL_RECT)
    root.mouse_filter = Control.MOUSE_FILTER_IGNORE
    layer.add_child(root)
    var header: VBoxContainer = VBoxContainer.new()
    header.set_anchors_preset(Control.PRESET_TOP_WIDE)
    header.offset_left = 16
    header.offset_top = 10
    header.mouse_filter = Control.MOUSE_FILTER_IGNORE
    root.add_child(header)
    title = Label.new()
    title.add_theme_font_size_override("font_size",24)
    header.add_child(title)
    supplies_label = Label.new()
    supplies_label.add_theme_font_size_override("font_size",17)
    header.add_child(supplies_label)
    message = Label.new()
    message.text = "LOCAL 3D DEMO · NO BUKLOD POINTS, ADVERTISING OR CLOUD COSTS"
    header.add_child(message)
    var controls: HBoxContainer = HBoxContainer.new()
    controls.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
    controls.offset_top = -72
    controls.offset_left = 12
    controls.add_theme_constant_override("separation",8)
    root.add_child(controls)
    controls.add_child(_button("◀ PREV",func(): _choose((selected+12)%13)))
    build_button = _button("BUILD (4)",_construct)
    controls.add_child(build_button)
    controls.add_child(_button("NEXT ▶",func(): _choose((selected+1)%13)))
    controls.add_child(_button("−",func(): _zoom(3.0)))
    controls.add_child(_button("+",func(): _zoom(-3.0)))

func _choose(index: int) -> void:
    selected = clampi(index,0,settlements.size()-1)
    var point: Vector3 = settlements[selected].position
    camera_target = Vector3(point.x,0,point.z)
    cursor.position = point + Vector3(0,0.12,0)
    _sync_camera()
    _refresh()

func _refresh() -> void:
    if not is_instance_valid(title):
        return
    var data: Dictionary = Data.STATIONS[selected]
    var id: String = String(data["id"])
    title.text = "BUKLOD KINGDOM 3D  •  %s" % String(data["name"]).to_upper()
    supplies_label.text = "SUPPLIES %d/%d  ·  FINISHED %d/13" % [supplies,MAX_SUPPLIES,constructed.size()]
    build_button.disabled = constructed.has(id) or supplies < BUILD_COST
    build_button.text = "BUILT ✓" if constructed.has(id) else "BUILD (4)"

func _construct() -> void:
    var id: String = String(Data.STATIONS[selected]["id"])
    if constructed.has(id) or supplies < BUILD_COST:
        return
    supplies -= BUILD_COST
    constructed[id] = true
    var site: Node3D = settlements[selected]
    _box(site,Vector3(1.7,0.7,1.6),Vector3(0,0.75,0),"#e7dfc4")
    _box(site,Vector3(2.1,0.28,2.0),Vector3(0,1.25,0),
        String(Data.STATIONS[selected]["color"]))
    _box(site,Vector3(0.48,0.56,0.15),Vector3(0,0.68,0.87),"#65574b")
    message.text = "NEW BUILDING COMPLETE! Visit another district."
    _refresh()

func _zoom(amount: float) -> void:
    zoom = clampf(zoom+amount,17.0,57.0)
    _sync_camera()

func _process(delta: float) -> void:
    elapsed += delta
    harvest_elapsed += delta
    if harvest_elapsed >= SUPPLY_INTERVAL:
        harvest_elapsed = fmod(harvest_elapsed,SUPPLY_INTERVAL)
        if supplies < MAX_SUPPLIES:
            supplies += 1
            _refresh()
    for i in range(villagers.size()):
        var pair: Vector2i = Data.ROADS[i%Data.ROADS.size()]
        var a: Vector3 = settlements[pair.x].position
        var b: Vector3 = settlements[pair.y].position
        var position_t: float = pingpong(elapsed*(0.10+float(i%3)*0.027)+float(i)*0.14,1.0)
        villagers[i].position = a.lerp(b,position_t)+Vector3(0,0.11,0)
    var r: float = 1.0+0.06*sin(elapsed*2.8)
    cursor.scale = Vector3(r,1,r)

func _notification(kind: int) -> void:
    if kind == NOTIFICATION_APPLICATION_PAUSED:
        set_process(false)
    elif kind == NOTIFICATION_APPLICATION_RESUMED:
        set_process(true)

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventMouseButton:
        if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
            _zoom(-2.0)
        elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
            _zoom(2.0)
        elif event.button_index == MOUSE_BUTTON_LEFT:
            dragging = event.pressed
            if event.pressed:
                drag_pixels = 0
            elif drag_pixels < 8.0:
                _pick(event.position)
    elif event is InputEventMouseMotion and dragging:
        _pan(event.relative)
    elif event is InputEventScreenTouch:
        dragging = event.pressed
        if event.pressed:
            drag_pixels = 0
        elif drag_pixels < 14.0:
            _pick(event.position)
    elif event is InputEventScreenDrag:
        _pan(event.relative)

func _pan(delta_pixels: Vector2) -> void:
    drag_pixels += delta_pixels.length()
    camera_target.x = clampf(camera_target.x-delta_pixels.x*zoom*0.0009,-25,25)
    camera_target.z = clampf(camera_target.z-delta_pixels.y*zoom*0.0009,-25,25)
    _sync_camera()

func _pick(point: Vector2) -> void:
    var origin: Vector3 = camera.project_ray_origin(point)
    var ray: Vector3 = camera.project_ray_normal(point)
    var hit: Variant = Plane(Vector3.UP,0).intersects_ray(origin,ray)
    if hit == null:
        return
    var ground: Vector3 = hit
    var closest: float = 2.0
    var chosen: int = -1
    for i in range(settlements.size()):
        var pos: Vector3 = settlements[i].position
        var dist: float = Vector2(ground.x,ground.z).distance_to(Vector2(pos.x,pos.z))
        if dist < closest:
            chosen = i
            closest = dist
    if chosen >= 0:
        _choose(chosen)
