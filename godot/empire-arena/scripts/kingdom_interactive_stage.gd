## Real-time original 3D field table. Existing FieldChallenge remains the only rules engine.
extends TextureRect
signal tile_pressed(index: int, is_cell: bool)
const RENDER_SIZE := Vector2i(1920,960)
const MAX_TILES := 56
var render_view: SubViewport
var stage_root: Node3D
var board_root: Node3D
var scenario: Node3D
var scene_actor: Node3D
var route_traveler: Node3D
var route_goal := Vector3.ZERO
var view_camera: Camera3D
var tiles: Array[Dictionary] = []
var meshes: Dictionary = {}
var materials: Dictionary = {}
var layout_key := ""
var active := false
var kind := ""
var phase := 0.0
var intro := 0.0
var pulse := 0.0
var state_key := ""
var last_input_kind := ""
var last_input_time := -1000
var last_input_pos := Vector2(-10000,-10000)

func _ready() -> void:
    custom_minimum_size = Vector2(880,360)
    expand_mode = TextureRect.EXPAND_IGNORE_SIZE
    stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
    mouse_filter = Control.MOUSE_FILTER_STOP
    render_view = SubViewport.new()
    render_view.size = RENDER_SIZE
    render_view.own_world_3d = true
    render_view.msaa_3d = Viewport.MSAA_4X
    render_view.render_target_update_mode = SubViewport.UPDATE_DISABLED
    add_child(render_view)
    texture = render_view.get_texture()
    stage_root = Node3D.new()
    render_view.add_child(stage_root)
    var world := WorldEnvironment.new()
    var environment := Environment.new()
    environment.background_mode = Environment.BG_COLOR
    environment.background_color = Color("#192b35")
    environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    environment.ambient_light_color = Color("#d7e8f2")
    environment.ambient_light_energy = 0.78
    world.environment = environment
    stage_root.add_child(world)
    var sun := DirectionalLight3D.new()
    sun.rotation_degrees = Vector3(-49,-38,0)
    sun.light_energy = 1.65
    sun.shadow_enabled = true
    sun.directional_shadow_max_distance = 25.0
    stage_root.add_child(sun)
    var fill := DirectionalLight3D.new()
    fill.rotation_degrees = Vector3(-43,144,0)
    fill.light_color = Color("#bcd8ff")
    fill.light_energy = 0.62
    stage_root.add_child(fill)
    var rim := DirectionalLight3D.new()
    rim.rotation_degrees = Vector3(-25,65,0)
    rim.light_color = Color("#ffd9a1")
    rim.light_energy = 0.42
    stage_root.add_child(rim)
    view_camera = Camera3D.new()
    view_camera.projection = Camera3D.PROJECTION_ORTHOGONAL
    view_camera.size = 8.2
    view_camera.position = Vector3(0,13,8)
    stage_root.add_child(view_camera)
    view_camera.look_at(Vector3.ZERO,Vector3.UP)
    view_camera.make_current()
    _mesh(stage_root,"bevel",Vector3(0,-0.36,0),Vector3(14,0.66,8.4),Color("#253b42"),0.15)
    _mesh(stage_root,"bevel",Vector3(0,-0.045,0),Vector3(13.78,0.12,8.18),Color("#b28b4c"),0.55)
    _mesh(stage_root,"bevel",Vector3(0,0.025,0),Vector3(13.5,0.09,7.9),Color("#344d43"))
    for side in [-1,1]:
        for end in [-1,1]:
            _mesh(stage_root,"coin",Vector3(side*6.48,0.11,end*3.72),Vector3(0.34,0.13,0.34),Color("#d9b86e"),0.78)
            _mesh(stage_root,"gem",Vector3(side*6.48,0.23,end*3.72),Vector3(0.19,0.21,0.19),Color("#8acdb5"),0.38)
    board_root = Node3D.new()
    stage_root.add_child(board_root)
    scenario = Node3D.new()
    stage_root.add_child(scenario)
    scenario.position = Vector3(4.7,0,0)
    gui_input.connect(_pointer)
    set_process(false)

func _material(tint: Color, metallic: float) -> StandardMaterial3D:
    var key := tint.to_html()+":"+str(metallic)
    if not materials.has(key):
        var mat := StandardMaterial3D.new()
        mat.albedo_color = tint
        mat.roughness = 0.46 if metallic>0.0 else 0.82
        mat.metallic = metallic
        materials[key] = mat
    return materials[key]

func _shape(id: String) -> Mesh:
    if meshes.has(id):
        return meshes[id]
    var shape: Mesh
    match id:
        "bevel":
            var surface := SurfaceTool.new()
            surface.begin(Mesh.PRIMITIVE_TRIANGLES)
            var rings := [[-0.5,0.88],[-0.36,1.0],[0.36,1.0],[0.5,0.88]]
            var outline := [Vector2(-0.42,-0.5),Vector2(0.42,-0.5),Vector2(0.5,-0.42),Vector2(0.5,0.42),Vector2(0.42,0.5),Vector2(-0.42,0.5),Vector2(-0.5,0.42),Vector2(-0.5,-0.42)]
            for ring in range(3):
                for i in range(8):
                    var j := (i+1)%8
                    var a := Vector3(outline[i].x*rings[ring][1],rings[ring][0],outline[i].y*rings[ring][1])
                    var b := Vector3(outline[j].x*rings[ring][1],rings[ring][0],outline[j].y*rings[ring][1])
                    var c := Vector3(outline[i].x*rings[ring+1][1],rings[ring+1][0],outline[i].y*rings[ring+1][1])
                    var d := Vector3(outline[j].x*rings[ring+1][1],rings[ring+1][0],outline[j].y*rings[ring+1][1])
                    for v in [a,b,c,b,d,c]:
                        surface.add_vertex(v)
            for i in range(8):
                var j := (i+1)%8
                for v in [Vector3(0,0.5,0),Vector3(outline[i].x*0.88,0.5,outline[i].y*0.88),Vector3(outline[j].x*0.88,0.5,outline[j].y*0.88)]:
                    surface.add_vertex(v)
                for v in [Vector3(0,-0.5,0),Vector3(outline[j].x*0.88,-0.5,outline[j].y*0.88),Vector3(outline[i].x*0.88,-0.5,outline[i].y*0.88)]:
                    surface.add_vertex(v)
            surface.generate_normals()
            shape = surface.commit()
        "gem","coin":
            var cylinder := CylinderMesh.new()
            cylinder.top_radius = 0.28 if id=="gem" else 0.5
            cylinder.bottom_radius = 0.5
            cylinder.height = 1.0
            cylinder.radial_segments = 8 if id=="gem" else 32
            shape = cylinder
        "orb","leaf":
            var sphere := SphereMesh.new()
            sphere.radius = 0.5
            sphere.height = 1.0
            sphere.radial_segments = 24
            sphere.rings = 12
            shape = sphere
        "roof":
            var roof := PrismMesh.new()
            roof.size = Vector3.ONE
            shape = roof
        _:
            var box := BoxMesh.new()
            box.size = Vector3.ONE
            shape = box
    meshes[id] = shape
    return shape

func _mesh(parent: Node3D, id: String, at: Vector3, dimensions: Vector3, tint: Color, metallic: float = 0.0) -> MeshInstance3D:
    var node := MeshInstance3D.new()
    node.mesh = _shape(id)
    node.material_override = _material(tint,metallic)
    node.position = at
    node.scale = dimensions
    parent.add_child(node)
    return node

func _label(parent: Node3D, message: String, at: Vector3, font_size: int = 42) -> Label3D:
    var label := Label3D.new()
    label.text = message
    label.position = at
    label.font_size = font_size
    label.pixel_size = 0.0065
    label.outline_size = 8
    label.outline_modulate = Color("#142330")
    label.modulate = Color("#fff1ce")
    label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
    parent.add_child(label)
    return label

func _clear(parent: Node3D) -> void:
    for child in parent.get_children():
        parent.remove_child(child)
        child.queue_free()

func set_active(value: bool) -> void:
    active = value
    visible = value
    if render_view != null:
        render_view.render_target_update_mode = SubViewport.UPDATE_ALWAYS if value else SubViewport.UPDATE_DISABLED
    set_process(value)
    if not value:
        layout_key = ""
        last_input_kind = ""

func _new_tile(index: int, cell: bool, at: Vector3, half: Vector2) -> void:
    if tiles.size()>=MAX_TILES:
        return
    var root := Node3D.new()
    root.position = at
    board_root.add_child(root)
    _mesh(root,"bevel",Vector3(0,0.08,0),Vector3(half.x*2,0.16,half.y*2),Color("#9d8050"),0.58)
    var cap := _mesh(root,"bevel",Vector3(0,0.205,0),Vector3(half.x*1.88,0.17,half.y*1.88),Color("#46675c"))
    var actor := Node3D.new()
    actor.position.y = 0.34
    root.add_child(actor)
    var label := _label(root,"",Vector3(0,0.52,0))
    tiles.append({"index":index,"cell":cell,"node":root,"cap":cap,"actor":actor,"label":label,"at":at,"half":half,"enabled":true,"signature":"","lift":0.0,"pulse":0.0})

func _build_board(field) -> void:
    _clear(board_root)
    tiles.clear()
    route_traveler = null
    kind = str(field.spec.type)
    if kind in ["wordsearch","sudoku"]:
        var n: int = int(field.spec.size) if kind=="wordsearch" else int(field.sudoku_size)
        var step := minf(1.28,5.7/float(n))
        for i in range(n*n):
            _new_tile(i,true,Vector3((float(i%n)-(n-1)*0.5)*step-1.0,0,(float(floori(float(i)/n))-(n-1)*0.5)*step+(-0.35 if kind=="sudoku" else 0.0)),Vector2(step*0.46,step*0.46))
        if kind=="sudoku":
            var count: int = field.spec.items.size()
            for i in range(count):
                _new_tile(i,false,Vector3((float(i)-(count-1)*0.5)-1.0,0,3.15),Vector2(0.46,0.39))
    else:
        var count: int = field.spec.items.size()
        var rows := ceili(float(count)/3.0)
        for i in range(count):
            _new_tile(i,false,Vector3((float(i%3)-1.0)*2.58-1.3,0,(float(floori(float(i)/3.0))-(rows-1)*0.5)*2.0),Vector2(1.19,0.88))
    _build_scenario()
    if kind=="route":
        route_traveler = Node3D.new()
        board_root.add_child(route_traveler)
        var at: Vector3 = tiles[0].at
        route_goal = at+Vector3(0,0.55,0)
        route_traveler.position = route_goal
        _mesh(route_traveler,"coin",Vector3(0,0.06,0),Vector3(0.45,0.12,0.45),Color("#ffd27a"),0.7)
        _mesh(route_traveler,"gem",Vector3(0,0.35,0),Vector3(0.34,0.54,0.34),Color("#f1c46b"),0.48)
    intro = 0.55
    state_key = ""

func _build_scenario() -> void:
    _clear(scenario)
    _mesh(scenario,"coin",Vector3(0,0.12,0),Vector3(3.25,0.22,3.25),Color("#a88b50"),0.52)
    _mesh(scenario,"coin",Vector3(0,0.25,0),Vector3(3.06,0.17,3.06),Color("#39564a"))
    scene_actor = Node3D.new()
    scenario.add_child(scene_actor)
    match kind:
        "farm":
            _mesh(scene_actor,"box",Vector3(0,0.40,0),Vector3(2,0.22,1.55),Color("#694c35"))
            for i in range(5):
                _plant(scene_actor,Vector3((i-2)*0.33,0.54,0),1.1)
        "route":
            for i in range(5):
                _mesh(scene_actor,"box",Vector3(-0.8+i*0.4,0.38,0),Vector3(0.30,0.16,0.8),Color("#b8ab83"))
            _flag(scene_actor,Vector3(0.95,0.4,0))
        "rhythm","memory":
            for i in range(5):
                var h := 0.60+0.20*i
                _mesh(scene_actor,"coin",Vector3((i-2)*0.37,0.37+h*0.5,0),Vector3(0.23,h,0.23),Color("#c5a36b").lerp(Color("#79c8d4"),i/4.0),0.45)
        "domino":
            for i in range(5):
                var piece := _mesh(scene_actor,"box",Vector3((i-2)*0.38,0.81,0),Vector3(0.26,0.95,0.55),Color("#e6d6b5"))
                piece.rotation.z = -0.11*i
        "budget","merge":
            for i in range(5):
                _mesh(scene_actor,"coin",Vector3(0,0.40+i*0.17,0),Vector3(1.25-i*0.08,0.14,1.25-i*0.08),Color("#e2b764"),0.55)
        "wordsearch","sudoku","codebreaker","sequence","select":
            _mesh(scene_actor,"box",Vector3(0,0.42,0),Vector3(1.9,0.18,1.3),Color("#603d38"))
            for side in [-1,1]:
                var page := _mesh(scene_actor,"box",Vector3(side*0.43,0.55,0),Vector3(0.83,0.10,1.18),Color("#efe2bb"))
                page.rotation.z = side*0.06
                for i in range(5):
                    _mesh(scene_actor,"box",Vector3(side*0.43,0.61,-0.43+i*0.17),Vector3(0.53,0.016,0.025),Color("#96866a"))
        _:
            for i in range(5):
                var angle := i*TAU/5.0
                _mesh(scene_actor,"gem",Vector3(cos(angle)*0.59,0.87+0.1*(i%2),sin(angle)*0.59),Vector3(0.43,0.78,0.43),Color("#79c9bd").lerp(Color("#d7bb75"),i/4.0),0.35)
    _label(scenario,"LIVING REALMS",Vector3(0,1.75,0),40)
    _label(scenario,"3D FIELD TABLE",Vector3(0,0.39,1.85),32)

func _plant(parent: Node3D, at: Vector3, growth: float) -> void:
    _mesh(parent,"coin",at+Vector3(0,0.28*growth,0),Vector3(0.065,0.56*growth,0.065),Color("#83b65f"))
    for side in [-1,1]:
        var leaf := _mesh(parent,"leaf",at+Vector3(side*0.1,0.36*growth,0),Vector3(0.25,0.11,0.13)*growth,Color("#a8c86b"))
        leaf.rotation.z = side*0.6

func _flag(parent: Node3D, at: Vector3) -> void:
    _mesh(parent,"coin",at+Vector3(0,0.38,0),Vector3(0.08,0.76,0.08),Color("#e8c879"))
    _mesh(parent,"box",at+Vector3(0.22,0.64,0),Vector3(0.45,0.28,0.05),Color("#84d4a2"))

func _actor(tile: Dictionary, field, value: String) -> void:
    var root: Node3D = tile.actor
    _clear(root)
    var index: int = tile.index
    if bool(tile.cell):
        return
    match kind:
        "farm":
            var crop: int = field.crop_stage[index]
            _mesh(root,"box",Vector3(0,0.04,0),Vector3(1,0.13,0.66),Color("#725239"))
            if crop>0 and crop<4:
                var plants := Node3D.new()
                plants.name = "GrowingPlants"
                plants.position.y = 0.10
                root.add_child(plants)
                for i in range(3):
                    _plant(plants,Vector3((i-1)*0.26,0,0),1.0)
                plants.scale.y = 0.25 if crop==1 else (0.40 if crop==2 else 1.0)
        "domino":
            if index==field.spec.items.size()-1:
                return
            var values: Array = field.spec.items[index]
            _mesh(root,"box",Vector3(0,0.10,0),Vector3(1.46,0.20,0.72),Color("#efe5cc"))
            _mesh(root,"box",Vector3(0,0.212,0),Vector3(0.035,0.015,0.62),Color("#5a5143"))
            for side in range(2):
                for pip in range(int(values[side])):
                    var x := (-0.36 if side==0 else 0.36)+(float(pip%2)-0.5)*0.19
                    var z := (float(floori(float(pip)/2.0))-1.0)*0.16
                    _mesh(root,"orb",Vector3(x,0.23,z),Vector3(0.075,0.035,0.075),Color("#24353b"))
        "route":
            if value=="Blocked":
                _mesh(root,"roof",Vector3(0,0.25,0),Vector3(0.8,0.5,0.6),Color("#8b7770"))
            elif value in ["Start","Goal"]:
                _flag(root,Vector3.ZERO)
            else:
                _mesh(root,"box",Vector3(0,0.075,0),Vector3(0.9,0.10,0.72),Color("#bca988"))
        "budget","merge":
            var number: int = int(field.board[index]) if kind=="merge" else int(field.spec.items[index])
            for i in range(clampi(number,0,5)):
                _mesh(root,"coin",Vector3(0,0.07+i*0.08,0),Vector3(0.68,0.07,0.68),Color("#d9b05c"),0.65)
        "match3":
            if not str(field.board[index]).is_empty():
                var colors := [Color("#72b5d4"),Color("#e2b662"),Color("#b58ac6")]
                _mesh(root,"gem",Vector3(0,0.32,0),Vector3(0.61,0.60,0.61),colors[absi(str(field.board[index]).hash())%3],0.38)
        "rhythm":
            var hue := Color("#8dd0cf").lerp(Color("#e9bb70"),float(index)/maxf(1.0,float(field.spec.items.size()-1)))
            _mesh(root,"coin",Vector3(0,0.14,0),Vector3(1.07,0.28,1.07),hue,0.38)
            _mesh(root,"coin",Vector3(0,0.30,0),Vector3(0.82,0.08,0.82),hue.lightened(0.25),0.45)

func sync(field) -> void:
    if not active or field.spec.is_empty():
        return
    var key := str(field.spec.type)+":"+str(field.spec.items.size())+":"+str(field.spec.get("size",0))
    if key!=layout_key or tiles.is_empty():
        layout_key = key
        _build_board(field)
    if kind=="route" and route_traveler!=null and not field.picks.is_empty():
        var at: Vector3 = tiles[int(field.picks.back())].at
        route_goal = at+Vector3(0,0.55,0)
    # State-driven animation, not time-based changes to game rules.
    var summary: String = field.status()
    if summary!=state_key:
        state_key = summary
        pulse = 0.3
    for tile in tiles:
        var index: int = tile.index
        var cell: bool = tile.cell
        var value := ""
        var status := "normal"
        var enabled: bool = not field.solved and field.preview_left<=0.0 and field.reveal_left<=0.0
        if cell:
            if kind=="wordsearch":
                value = str(field.spec.letters[index])
                status = "ready" if field.word_cells.has(index) else ("selected" if field.word_start==index else "normal")
            else:
                var n: int = field.sudoku_size
                var region := (floori(float(floori(float(index)/n))/field.sudoku_box_rows)+floori(float(index%n)/field.sudoku_box_cols))%2
                value = str(field.sudoku_grid[index]) if int(field.sudoku_grid[index])!=0 else "·"
                status = "fixed" if field.sudoku_fixed.has(index) else ("selected" if field.sudoku_selected==index else ("region" if region==1 else "normal"))
                enabled = enabled and not field.sudoku_fixed.has(index)
        else:
            value = field.tile_label(index)
            if field.picks.has(index) or field.selected_tile==index:
                status = "selected"
            if field.matched.has(index):
                status = "ready"
                enabled = false
            if kind=="farm":
                status = "growing" if field.crop_stage[index]==2 else ("ready" if field.crop_stage[index]>=3 else status)
                enabled = enabled and field.crop_stage[index]!=4
            elif kind=="route" and str(field.spec.items[index])=="Blocked":
                status = "blocked"
                enabled = false
            elif kind=="match3" and str(field.board[index]).is_empty():
                status = "cleared"
                enabled = false
            elif kind=="domino" and field.picks.has(index):
                enabled = false
            elif kind=="codebreaker" and field.code_locked:
                enabled = false
        tile.enabled = enabled
        var signature := value+"|"+status+"|"+str(enabled)
        if signature==tile.signature:
            continue
        var initialized: bool = str(tile.signature)!=""
        tile.signature = signature
        tile.pulse = 0.26 if initialized else 0.0
        var colors := {"normal":Color("#4b6a62"),"selected":Color("#a68944"),"ready":Color("#40895a"),"growing":Color("#3e768b"),"blocked":Color("#584a50"),"cleared":Color("#34464c"),"fixed":Color("#2d5245"),"region":Color("#426273")}
        var cap: MeshInstance3D = tile.cap
        cap.material_override = _material(colors[status],0.16)
        var label: Label3D = tile.label
        label.text = value.replace(": ","\n") if kind=="farm" else value
        label.modulate = Color("#ffeec3") if enabled or status=="fixed" else Color("#b7c8c5")
        label.position.y = 0.48 if cell or kind in ["codebreaker","sudoku","sequence","select","memory","pair"] else 0.91
        label.font_size = 42 if cell else (27 if value.length()>25 else (32 if value.length()>13 else 40))
        label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
        label.width = float(tile.half.x)*1.75/label.pixel_size
        tile.lift = 0.12 if status=="selected" else 0.0
        _actor(tile,field,value)

func advance_visual(field) -> void:
    if not active or kind!="farm":
        return
    for tile in tiles:
        var index: int = tile.index
        if index>=field.crop_stage.size() or field.crop_stage[index]!=2:
            continue
        var root: Node3D = tile.actor
        var plants := root.get_node_or_null("GrowingPlants") as Node3D
        if plants!=null:
            var duration := maxf(0.1,float(field.spec.get("growSeconds",1.0)))
            var progress := 1.0-clampf(field.crop_remaining[index]/duration,0.0,1.0)
            plants.scale.y = lerpf(0.40,1.0,progress)

func _process(delta: float) -> void:
    if not active:
        return
    phase += minf(delta,0.05)
    intro = maxf(0.0,intro-delta)
    view_camera.size = lerpf(8.2,8.7,intro/0.55)
    for tile in tiles:
        var node: Node3D = tile.node
        var rest: Vector3 = tile.at
        tile.pulse = maxf(0.0,float(tile.pulse)-delta)
        var lift := float(tile.lift)+sin(float(tile.pulse)/0.26*PI)*0.11
        node.position = node.position.lerp(rest+Vector3.UP*lift,minf(1.0,delta*14.0))
        if kind=="domino" and not bool(tile.cell):
            var actor: Node3D = tile.actor
            actor.rotation.x = lerpf(actor.rotation.x,-0.48 if not bool(tile.enabled) else 0.0,minf(1.0,delta*9.0))
    if is_instance_valid(route_traveler):
        route_traveler.position = route_traveler.position.lerp(route_goal,minf(1.0,delta*7.0))
        route_traveler.rotation.y += delta*0.9
    pulse = maxf(0.0,pulse-delta)
    if is_instance_valid(scene_actor):
        scene_actor.rotation.y = sin(phase*0.6)*0.24
        scene_actor.position.y = sin(phase*2.4)*0.05+pulse*0.21
        scene_actor.scale = Vector3.ONE*(1.0+pulse*0.13)
        if kind=="domino":
            scene_actor.rotation.z = sin(phase*2.4)*0.05

func pick_at(screen: Vector2) -> Dictionary:
    if not active or view_camera==null or not screen.is_finite():
        return {}
    var hit: Variant = Plane(Vector3.UP,0.30).intersects_ray(view_camera.project_ray_origin(screen),view_camera.project_ray_normal(screen))
    if not hit is Vector3:
        return {}
    var local: Vector3 = board_root.to_local(hit)
    var best := {}
    var distance := INF
    for tile in tiles:
        var at: Vector3 = tile.at
        var half: Vector2 = tile.half
        var offset := Vector2(local.x-at.x,local.z-at.z)
        if bool(tile.enabled) and absf(offset.x)<=half.x and absf(offset.y)<=half.y and offset.length_squared()<distance:
            best = tile
            distance = offset.length_squared()
    return best

func _pointer(event: InputEvent) -> void:
    if not active:
        return
    var pointer := Vector2.ZERO
    var source := ""
    if event is InputEventScreenTouch and event.pressed:
        pointer = event.position
        source = "touch"
    elif event is InputEventMouseButton and event.pressed and event.button_index==MOUSE_BUTTON_LEFT:
        pointer = event.position
        source = "mouse"
    else:
        return
    var now := Time.get_ticks_msec()
    if source!=last_input_kind and now-last_input_time<90 and pointer.distance_to(last_input_pos)<8.0:
        accept_event()
        return
    last_input_kind = source
    last_input_time = now
    last_input_pos = pointer
    var factor := minf(size.x/float(RENDER_SIZE.x),size.y/float(RENDER_SIZE.y))
    if factor<=0.0:
        return
    var offset := (size-Vector2(RENDER_SIZE)*factor)*0.5
    var screen := (pointer-offset)/factor
    if screen.x>=0 and screen.y>=0 and screen.x<RENDER_SIZE.x and screen.y<RENDER_SIZE.y:
        var tile := pick_at(screen)
        if not tile.is_empty():
            tile_pressed.emit(int(tile.index),bool(tile.cell))
    accept_event()

func snapshot() -> Dictionary:
    return {"tiles":tiles.size(),"resolution":str(RENDER_SIZE.x)+"x"+str(RENDER_SIZE.y),"active":active,"scenario":kind,"actual_meshes":stage_root.find_children("*","MeshInstance3D",true,false).size() if stage_root!=null else 0}
