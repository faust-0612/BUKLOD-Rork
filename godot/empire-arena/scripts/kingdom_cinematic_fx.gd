## Original bounded event effects: reusable geometry and no external media.
extends Node3D
const CAPACITY := 48
var burst: MultiMeshInstance3D
var ring: MeshInstance3D
var ring_material: StandardMaterial3D
var duration := 0.85
var age := 0.0
var count := 0
var serial := 0
var tint := Color("#ffe3a3")

func _ready() -> void:
    var shape := SphereMesh.new()
    shape.radius = 0.06
    shape.height = 0.12
    shape.radial_segments = 8
    shape.rings = 4
    var multi := MultiMesh.new()
    multi.transform_format = MultiMesh.TRANSFORM_3D
    multi.use_colors = true
    multi.mesh = shape
    multi.instance_count = CAPACITY
    multi.visible_instance_count = 0
    burst = MultiMeshInstance3D.new()
    burst.multimesh = multi
    var mat := StandardMaterial3D.new()
    mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
    mat.vertex_color_use_as_albedo = true
    burst.material_override = mat
    burst.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    add_child(burst)
    var mesh := TorusMesh.new()
    mesh.inner_radius = 0.83
    mesh.outer_radius = 1.0
    mesh.rings = 32
    mesh.ring_segments = 8
    ring = MeshInstance3D.new()
    ring.mesh = mesh
    ring_material = StandardMaterial3D.new()
    ring_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
    ring_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
    ring.material_override = ring_material
    ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    add_child(ring)
    ring.position.y = 0.045
    clear()

func trigger(kind: String, at: Vector3, color: Color) -> void:
    if burst == null:
        return
    position = at
    tint = color
    count = 48 if kind == "complete" else (20 if kind == "discover" else 12)
    duration = 1.35 if kind == "complete" else 0.85
    age = 0.0
    serial += 1
    burst.multimesh.visible_instance_count = count
    ring.show()
    set_process(true)
    _animate()

func _animate() -> void:
    var t := clampf(age/duration,0.0,1.0)
    var fade := 1.0-t
    var particle_scale := maxf(0.05,0.8*fade)
    for i in range(count):
        var a := float(i)*2.399963+float(serial)*0.53
        var spread := (0.35+float(i%5)*0.15)*t*2.8
        var y := sin(PI*t)*(0.85+float(i%7)*0.15)
        var pos := Vector3(cos(a)*spread,y,sin(a)*spread)
        burst.multimesh.set_instance_transform(i,Transform3D(Basis.from_scale(Vector3.ONE*particle_scale),pos))
        burst.multimesh.set_instance_color(i,tint.lerp(Color.WHITE,float(i%3)*0.15).darkened(t*0.65))
    ring.scale = Vector3.ONE*(0.35+t*2.4)
    ring_material.albedo_color = Color(tint.r,tint.g,tint.b,fade*0.68)

func _process(delta: float) -> void:
    age += minf(delta,0.05)
    if age >= duration:
        clear()
        return
    _animate()

func clear() -> void:
    count = 0
    if burst != null:
        burst.multimesh.visible_instance_count = 0
    if ring != null:
        ring.hide()
    set_process(false)
