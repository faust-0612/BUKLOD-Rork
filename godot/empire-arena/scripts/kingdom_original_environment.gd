## Original procedural geometry. No image backdrop or imported prop required.
extends Node3D
var clock := 0.0
var flow: MeshInstance3D
var water: StandardMaterial3D
var crystal_nodes: Array[MeshInstance3D] = []
var palette := Color("#8bb976")
var waterfall_material: ShaderMaterial
var waterfall: MeshInstance3D
var feature_nodes: Array[Node3D] = []
func _material(color: Color, rough: float = 0.75, metallic: float = 0.0) -> StandardMaterial3D:
    var mat := StandardMaterial3D.new()
    mat.albedo_color = color
    mat.roughness = rough
    mat.metallic = metallic
    return mat
func _mesh(parent: Node3D, shape: Mesh, at: Vector3, mat: Material, scale_value: Vector3 = Vector3.ONE) -> MeshInstance3D:
    var n := MeshInstance3D.new()
    n.mesh = shape
    n.position = at
    n.material_override = mat
    n.scale = scale_value
    parent.add_child(n)
    return n
func _cone(radius: float, height: float, sides: int = 12) -> CylinderMesh:
    var shape := CylinderMesh.new()
    shape.top_radius = 0.04
    shape.bottom_radius = radius
    shape.height = height
    shape.radial_segments = sides
    return shape
func _rugged_peak(seed: int, radius: float, height: float) -> ArrayMesh:
    var surface := SurfaceTool.new()
    surface.begin(Mesh.PRIMITIVE_TRIANGLES)
    var rings := 7
    var sides := 24
    var vertices: Array[Vector3] = []
    for row in range(rings + 1):
        var t := float(row)/float(rings)
        var spread := radius * pow(1.0-t,0.78) + 0.06
        for i in range(sides):
            var angle := TAU*float(i)/float(sides)
            var jagged := 1.0+0.16*sin(angle*5.0+float(seed))+0.10*cos(angle*9.0+t*7.0)
            var shift := Vector3(sin(float(seed)*0.7)*t*0.8,0,cos(float(seed)*0.9)*t*0.5)
            vertices.append(Vector3(cos(angle)*spread*jagged,height*t+0.26*sin(angle*4.0+float(row))*sin(PI*t),sin(angle)*spread*jagged)+shift)
    for row in range(rings):
        for i in range(sides):
            var a := row*sides+i
            var b := row*sides+(i+1)%sides
            var c := a+sides
            var d := b+sides
            for idx in [a,b,c,b,d,c]:
                var point: Vector3 = vertices[idx]
                surface.set_uv(Vector2(point.x,point.y)*0.15)
                surface.set_color(Color.WHITE.lerp(palette.lightened(0.24),clampf(point.y/height,0.0,1.0)))
                surface.add_vertex(point)
    surface.generate_normals()
    return surface.commit()

func _leaf_clusters(at: Vector3, size: float, seed: int, winter: bool) -> void:
    var leaves := SphereMesh.new()
    leaves.radius = 0.75
    leaves.height = 1.05
    leaves.radial_segments = 12
    leaves.rings = 6
    var multi := MultiMesh.new()
    multi.transform_format = MultiMesh.TRANSFORM_3D
    multi.use_colors = true
    multi.mesh = leaves
    multi.instance_count = 15
    var base := Color("#d8e6ed") if winter else palette
    for i in range(15):
        var angle := float(i)*2.399963+float(seed)*0.13
        var spread := (0.4+float(i%4)*0.23)*size
        var local := Vector3(cos(angle)*spread,(2.6+float(i%5)*0.33)*size,sin(angle)*spread)
        var scale_value := (0.72+0.11*float(i%4))*size
        var basis := Basis.from_scale(Vector3(scale_value,scale_value*0.78,scale_value))
        multi.set_instance_transform(i,Transform3D(basis,local))
        multi.set_instance_color(i,base.lightened(float(i%3)*0.10).darkened(float(i%4)*0.075))
    var node := MultiMeshInstance3D.new()
    node.multimesh = multi
    var mat := _material(Color.WHITE)
    mat.vertex_color_use_as_albedo = true
    node.material_override = mat
    node.position = at
    add_child(node)

func _tree(at: Vector3, size: float, seed: int, winter: bool) -> void:
    var trunk := CylinderMesh.new()
    trunk.top_radius = 0.12
    trunk.bottom_radius = 0.24
    trunk.height = 2.8
    trunk.radial_segments = 10
    _mesh(self, trunk, at + Vector3(0, 1.4*size, 0), _material(Color("#6a4730")), Vector3.ONE*size)
    for layer in range(3):
        var col := Color("#d2e5ec") if winter else palette.darkened(0.23 - layer*0.08)
        var n := _mesh(self, _cone(1.25 - 0.25*layer, 2.0, 14), at + Vector3(0, (2.2 + 0.78*layer)*size, 0), _material(col), Vector3.ONE*size)
        n.rotation.y = float(seed + layer)*0.51
    if not winter:
        _leaf_clusters(at,size,seed,winter)
func _spire(at: Vector3, size: float, tint: Color) -> void:
    var rock := PrismMesh.new()
    rock.size = Vector3(0.9, 2.4, 0.8)
    var material := _material(tint, 0.32, 0.25)
    material.emission_enabled = true
    material.emission = tint
    material.emission_energy_multiplier = 0.12
    var n := _mesh(self, rock, at + Vector3(0,size*1.2,0), material, Vector3.ONE*size)
    crystal_nodes.append(n)
func _tower(at: Vector3, tint: Color, size: float) -> void:
    var block := CylinderMesh.new()
    block.top_radius = 0.9
    block.bottom_radius = 1.1
    block.height = 3.9
    block.radial_segments = 10
    _mesh(self,block,at+Vector3(0,1.95*size,0),_material(tint),Vector3.ONE*size)
    _mesh(self,_cone(1.35,1.8,10),at+Vector3(0,4.55*size,0),_material(tint.darkened(0.35)),Vector3.ONE*size)
    var band := TorusMesh.new()
    band.inner_radius = 0.88
    band.outer_radius = 1.06
    band.rings = 16
    band.ring_segments = 8
    _mesh(self,band,at+Vector3(0,3.45*size,0),_material(Color("#cfad65"),0.37,0.55),Vector3.ONE*size)
    var windows := BoxMesh.new()
    windows.size = Vector3(0.18,0.64,0.08)
    var window_mat := _material(Color("#4c4135"),0.8)
    for side in range(5):
        var angle := TAU*float(side)/5.0
        var frame := _mesh(self,windows,at+Vector3(sin(angle)*0.97,2.15,cos(angle)*0.97)*size,window_mat,Vector3.ONE*size)
        frame.rotation.y = angle
func build(profile: Dictionary) -> void:
    palette = Color(str(profile.get("ground","#8bb976"))).lightened(0.15)
    var accent := Color(str(profile.get("accent","#ffe1a0")))
    var layout := int(profile.get("layout",0))
    var winter := layout == 1 or layout == 5
    # Perimeter terrain and geometry stay outside the traversable mission area.
    for i in range(8):
        var side := -1.0 if i < 4 else 1.0
        var at := Vector3(side*(15.0+float(i%2)),0,-12.0+float(i%4)*7.0)
        if layout in [1,4,8,12]:
            _spire(at,1.0+float(i%3)*0.28,accent)
        elif layout in [2,3,5,10]:
            _tower(at,palette.lightened(0.30),0.82+float(i%3)*0.14)
        else:
            _tree(at,0.95+float(i%3)*0.12,i+layout,winter)
    # Original mountain silhouettes beyond the far perimeter.
    for i in range(5):
        var peak := _rugged_peak(i+layout*19,4.8+float(i%2)*0.7,7.0+float((i+layout)%3)*1.7)
        var rock_mat := _material(palette.darkened(0.26))
        rock_mat.vertex_color_use_as_albedo = true
        _mesh(self,peak,Vector3(-22.0+i*11.0,0.0,-18.0),rock_mat,Vector3(1,1,0.65))
    if layout in [1,7,11]:
        var pool := PlaneMesh.new()
        pool.size = Vector2(13.0,3.5)
        water = _material(Color("#3d9eae"),0.26,0.16)
        water.emission_enabled = true
        water.emission = Color("#164f68")
        water.emission_energy_multiplier = 0.25
        flow = _mesh(self,pool,Vector3(0,0.015,-15.4),water)
        waterfall_material = ShaderMaterial.new()
        waterfall_material.shader = load("res://shaders/kingdom_original_water.gdshader")
        flow.material_override = waterfall_material
        var sheet := QuadMesh.new()
        sheet.size = Vector2(3.4,5.5)
        waterfall = _mesh(self,sheet,Vector3(-5.0,2.75,-16.8),waterfall_material)
        var rim := _rugged_peak(layout+77,3.0,5.6)
        _mesh(self,rim,Vector3(-5.0,0,-18.6),_material(palette.darkened(0.37)))
    else:
        _tower(Vector3(0,0,-15.0),palette.lightened(0.33),1.15)
func _process(delta: float) -> void:
    clock += minf(delta,0.05)
    if water != null and waterfall_material == null:
        water.albedo_color = Color("#3d9eae").lerp(Color("#83c8d0"),0.12+0.1*sin(clock*1.9))
    for i in range(crystal_nodes.size()):
        crystal_nodes[i].rotation.y = clock*0.19+i*0.4
