## First offline 3D MOBA vertical slice. Existing hero identities/skills and
## approved CC0 rigs are reused; two rigs are NOT thirteen bespoke 3D heroes.
extends Node3D
const SIM = preload("res://scripts/moba_sim.gd")
const AUDIO = preload("res://scripts/arena_audio.gd")
const SCALE := 0.27
const TEAM_A := Color("#55e8cd")
const TEAM_B := Color("#ff7779")
const TICK := 0.1
var sim = SIM.new()
var audio: Node
var camera: Camera3D
var actors: Dictionary = {}
var templates: Dictionary = {}
var materials: Dictionary = {}
var floor_root: Node3D
var layer: CanvasLayer
var hud: Control
var menu: VBoxContainer
var stats: Label
var status: Label
var skills: Dictionary = {}
var choice: OptionButton
var difficulty: OptionButton
var running := false
var paused := false
var accumulator := 0.0
var event_cursor := -1
var input_dir := Vector2.ZERO
var aim_dir := Vector2.RIGHT
var joystick_index := -1
var joystick_origin := Vector2.ZERO
var joystick: Control
var knob: ColorRect
var pending: Array[String] = []
var effect_nodes: Array[Dictionary] = []
var map_display: Control
var map_texture: ImageTexture
var map_elapsed := 0.0
var last_status := ""
var result_shown := false

func _ready() -> void:
	Engine.max_fps = 60
	audio=AUDIO.new()
	add_child(audio)
	_setup_environment()
	_setup_ui()
	print("BUKLOD_MOBA_3D_SELECTION_READY")

func _setup_environment() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode=Environment.BG_COLOR
	e.background_color=Color("#142c38")
	e.ambient_light_source=Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color=Color("#c3e4e0")
	e.ambient_light_energy=0.85
	env.environment=e
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees=Vector3(-55,-35,0)
	sun.light_energy=1.35
	sun.shadow_enabled=false
	add_child(sun)
	camera=Camera3D.new()
	camera.projection=Camera3D.PROJECTION_ORTHOGONAL
	camera.size=24.0
	camera.current=true
	add_child(camera)
	camera.position=Vector3(0,28,20)
	camera.look_at(Vector3.ZERO)
	floor_root=Node3D.new()
	add_child(floor_root)

func _mat(c: Color) -> StandardMaterial3D:
	var key := c.to_html()
	if not materials.has(key):
		var m:=StandardMaterial3D.new()
		m.albedo_color=c
		m.roughness=0.85
		materials[key]=m
	return materials[key]

func _box(parent: Node3D, at: Vector3, size: Vector3, c: Color) -> MeshInstance3D:
	var node:=MeshInstance3D.new()
	var mesh:=BoxMesh.new()
	mesh.size=size
	node.mesh=mesh
	node.material_override=_mat(c)
	parent.add_child(node)
	node.position=at
	return node

func _world(p: Vector2) -> Vector3:
	return Vector3((p.x-float(sim.state["w"])*0.5)*SCALE,0,(p.y-float(sim.state["h"])*0.5)*SCALE)

func _build_map() -> void:
	var w: float=sim.state["w"]*SCALE
	var h: float=sim.state["h"]*SCALE
	_box(floor_root,Vector3(0,-0.35,0),Vector3(w,0.5,h),Color("#355a47"))
	for lane in sim.config["maps"][sim.state["map"]]["lanes"]:
		var z: float=(float(lane)-0.5)*h
		_box(floor_root,Vector3(0,-0.07,z),Vector3(w-1.0,0.12,3.7),Color("#b3a38a"))
		for x in [-w*0.25,0.0,w*0.25]:
			_box(floor_root,Vector3(x,0.001,z),Vector3(0.13,0.025,3.7),Color("#dbc5a1"))
	_box(floor_root,Vector3(0,-0.05,0),Vector3(3.0,0.13,h),Color("#39788a"))
	for team in ["A","B"]:
		var core: Dictionary=sim.actor(team+"-core")
		var p:=_world(core["pos"])
		_box(floor_root,p+Vector3(0,0.03,0),Vector3(5.0,0.2,10.0),TEAM_A.darkened(0.65) if team=="A" else TEAM_B.darkened(0.65))
	for c in sim.state["cover"]:
		var p:=_world(c["pos"])
		var radius: float=float(c["radius"])*SCALE
		var rock:=MeshInstance3D.new()
		var mesh:=CylinderMesh.new()
		mesh.top_radius=radius*0.65
		mesh.bottom_radius=radius
		mesh.height=1.5
		rock.mesh=mesh
		rock.material_override=_mat(Color("#203f38"))
		floor_root.add_child(rock)
		rock.position=p+Vector3(0,0.7,0)
		var tree:=_model("kingdom_tree")
		if tree!=null:
			var n: Node3D=tree.duplicate()
			floor_root.add_child(n)
			n.position=p
			n.scale=Vector3.ONE*1.3

func _model(id: String) -> Node3D:
	if templates.has(id):
		return templates[id]
	var folder := "res://3d/kaykit/" if id.begins_with("rig_") else "res://3d/kenney/"
	var bytes:=FileAccess.get_file_as_bytes(folder+id+".glb")
	if bytes.is_empty() or bytes.size()>5000000:
		return null
	var doc:=GLTFDocument.new()
	var state:=GLTFState.new()
	if doc.append_from_buffer(bytes,folder,state)!=OK:
		return null
	var node: Node=doc.generate_scene(state)
	if not node is Node3D:
		if node!=null:node.free()
		return null
	templates[id]=node
	return node

func _label(parent: Control, value: String, size: int) -> Label:
	var l:=Label.new()
	l.text=value
	l.add_theme_font_size_override("font_size",size)
	parent.add_child(l)
	return l

func _button(parent: Control, name: String, cb: Callable, size: Vector2=Vector2(100,48)) -> Button:
	var b:=Button.new()
	b.text=name
	b.custom_minimum_size=size
	b.pressed.connect(cb)
	parent.add_child(b)
	return b

func _setup_ui() -> void:
	layer=CanvasLayer.new()
	add_child(layer)
	hud=Control.new()
	hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	hud.mouse_filter=Control.MOUSE_FILTER_IGNORE
	layer.add_child(hud)
	menu=VBoxContainer.new()
	menu.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	menu.offset_left=-270;menu.offset_right=270;menu.offset_top=-220;menu.offset_bottom=220
	menu.add_theme_constant_override("separation",16)
	hud.add_child(menu)
	_label(menu,"BUKLOD EMPIRE • GENESIS RIFT",34)
	_label(menu,"5 vs 5 OFFLINE PRACTICE • 3 lanes",22)
	_label(menu,"Original hero kits • shared prototype 3D rigs",18)
	choice=OptionButton.new()
	menu.add_child(choice)
	for id in sim.config.get("heroes",{}):
		choice.add_item(str(sim.config["heroes"][id]["name"])+" / "+str(sim.config["heroes"][id]["role"]))
		choice.set_item_metadata(choice.item_count-1,id)
	difficulty=OptionButton.new()
	for d in ["easy","normal","hard"]:difficulty.add_item(d.capitalize())
	difficulty.select(1)
	menu.add_child(difficulty)
	_button(menu,"START 5v5 BATTLE",_start_selected,Vector2(420,62))
	_button(menu,"BACK TO CLASSIC ARENA",func():get_tree().change_scene_to_file("res://scenes/Arena.tscn"))
	stats=Label.new()
	stats.add_theme_font_size_override("font_size",19)
	stats.position=Vector2(18,12)
	hud.add_child(stats)
	stats.hide()
	status=Label.new()
	status.add_theme_font_size_override("font_size",17)
	status.position=Vector2(18,46)
	hud.add_child(status)
	status.hide()

func _start_selected() -> void:
	if choice.item_count==0:
		return
	start_match(str(choice.get_item_metadata(choice.selected)),["easy","normal","hard"][difficulty.selected])

func start_match(hero: String, level: String="normal") -> bool:
	if running or not sim.start(hero,level):
		return false
	_build_map()
	menu.hide()
	stats.show()
	status.show()
	_make_controls()
	running=true
	_sync_actors(1.0)
	print("BUKLOD_MOBA_3D_MATCH_STARTED "+hero+" players="+str(sim.state["players"].size()))
	return true

func _make_controls() -> void:
	var right:=VBoxContainer.new()
	right.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	right.offset_left=-335;right.offset_right=-20;right.offset_top=-222;right.offset_bottom=-20
	hud.add_child(right)
	var row:=HBoxContainer.new()
	right.add_child(row)
	for cmd in ["primary","secondary","ultimate"]:
		skills[cmd]=_button(row,cmd.to_upper(),func():_queue(cmd),Vector2(100,70))
	_button(right,"ATTACK",func():_queue("attack"),Vector2(310,74))
	var shop:=HBoxContainer.new()
	right.add_child(shop)
	for item in ["blade","armor","boots"]:
		_button(shop,item.capitalize(),func():_buy(item),Vector2(100,48))
	var top:=HBoxContainer.new()
	top.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	top.offset_left=-260;top.offset_right=-16;top.offset_top=10
	hud.add_child(top)
	_button(top,"PAUSE",func():paused=not paused;input_dir=Vector2.ZERO;pending.clear();_notice("Paused" if paused else "Resumed"))
	_button(top,"EXIT",func():get_node("/root/EmpireSession").return_to_menu())
	joystick=Control.new()
	joystick.mouse_filter=Control.MOUSE_FILTER_IGNORE
	joystick.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	joystick.offset_left=24;joystick.offset_right=204;joystick.offset_top=-200;joystick.offset_bottom=-20
	hud.add_child(joystick)
	var background:=ColorRect.new()
	background.color=Color(0.08,0.20,0.27,0.65)
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter=Control.MOUSE_FILTER_IGNORE
	joystick.add_child(background)
	knob=ColorRect.new()
	knob.color=Color("#87d9d2")
	knob.size=Vector2(42,42)
	knob.position=Vector2(69,69)
	knob.mouse_filter=Control.MOUSE_FILTER_IGNORE
	joystick.add_child(knob)
	map_display=TextureRect.new()
	map_display.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	map_display.position=Vector2(18,84)
	map_display.size=Vector2(192,120)
	map_display.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
	map_display.mouse_filter=Control.MOUSE_FILTER_IGNORE
	hud.add_child(map_display)
	map_texture=ImageTexture.create_from_image(Image.create(96,60,false,Image.FORMAT_RGB8))
	map_display.texture=map_texture

func _notice(message: String) -> void:
	last_status=message
	status.text=message

func _buy(item: String) -> void:
	if not paused and sim.buy("A0",item):
		_notice(item.capitalize()+" purchased • match only")
	else:
		_notice("Shop requires home base, gold and an unused item")

func _queue(cmd: String) -> void:
	if running and not paused and sim.state["status"]=="active" and pending.size()<4 and not cmd in pending:
		pending.append(cmd)

func _input(event: InputEvent) -> void:
	if not running or paused or sim.state["status"]!="active" or joystick==null:
		return
	if event is InputEventScreenTouch:
		if event.pressed and joystick_index==-1 and joystick.get_global_rect().has_point(event.position):
			joystick_index=event.index
			joystick_origin=joystick.get_global_rect().get_center()
			_joystick(event.position)
			get_viewport().set_input_as_handled()
		elif not event.pressed and event.index==joystick_index:
			joystick_index=-1
			input_dir=Vector2.ZERO
			knob.position=Vector2(69,69)
			get_viewport().set_input_as_handled()
	elif event is InputEventScreenDrag and event.index==joystick_index:
		_joystick(event.position)
		get_viewport().set_input_as_handled()

func _joystick(point: Vector2) -> void:
	input_dir=((point-joystick_origin)/70.0).limit_length(1.0)
	knob.position=Vector2(69,69)+input_dir*60.0

func _notification(what: int) -> void:
	if what==NOTIFICATION_APPLICATION_FOCUS_OUT or what==NOTIFICATION_APPLICATION_PAUSED:
		input_dir=Vector2.ZERO
		joystick_index=-1
		pending.clear()
		if running:paused=true

func _command(cmd: String) -> bool:
	var p: Dictionary=sim.actor("A0")
	if not sim._alive(p):
		return false
	var enemies: Array=sim._enemies(p,12.0)
	var target: Dictionary=enemies.front() if not enemies.is_empty() else {}
	var direction:=aim_dir
	if not target.is_empty():
		direction=(target["pos"] as Vector2)-(p["pos"] as Vector2)
	if sim.action("A0",cmd,direction,str(target.get("id",""))):
		audio.play_command(str(p["hero"]),cmd,sim.config["starter"].get(p["hero"],{}))
		_play(actors.get("A0",{}),"Attack")
		_flash(_world(p["pos"]),TEAM_A,1.1 if cmd=="attack" else 2.0)
		print("BUKLOD_MOBA_COMMAND_ACCEPTED "+cmd)
		return true
	_notice("Out of range, cooldown, level or mana")
	return false

func _physics_process(delta: float) -> void:
	if not running or paused or sim.state["status"]!="active":
		return
	accumulator+=minf(delta,0.2)
	var steps:=0
	while accumulator>=TICK and steps<3:
		accumulator-=TICK
		steps+=1
		var keyboard:=Input.get_vector("ui_left","ui_right","ui_up","ui_down")
		var direction:=input_dir if input_dir.length()>0.08 else keyboard
		if direction.length()>0.08:
			aim_dir=direction.normalized()
			sim.action("A0","move",direction)
		if not pending.is_empty():
			_command(pending.pop_front())
		sim.advance()
		_read_events()
		if sim.state["status"]!="active":
			break
	if steps>0:
		_sync_actors(minf(1.0,delta*9.0))
		_update_hud()

func _make_actor(p: Dictionary) -> Dictionary:
	var node:=Node3D.new()
	add_child(node)
	var team_color:=TEAM_A if p["team"]=="A" else TEAM_B
	var model: Node3D
	var kind:=str(p["kind"])
	if kind=="hero":
		var identity:=str(p["hero"])
		var role:=str(sim.config["heroes"][identity]["role"])
		var rig: Node3D=_model("rig_mage" if role in ["support","controller","disruptor","logistician","rally"] else "rig_knight")
		if rig!=null:
			model=rig.duplicate()
			node.add_child(model)
			model.scale=Vector3.ONE*0.8
	elif kind=="tower":
		var tower:=_model("arena_crystal" if p.get("core",false) else "arena_tower")
		if tower!=null:
			model=tower.duplicate()
			node.add_child(model)
			model.scale=Vector3.ONE*(2.0 if p.get("core",false) else 1.4)
	if model==null:
		model=_box(node,Vector3(0,0.4,0),Vector3(0.55,0.8,0.55),team_color)
	var ring:=MeshInstance3D.new()
	var disk:=CylinderMesh.new()
	disk.top_radius=0.65 if kind=="hero" else 0.4
	disk.bottom_radius=disk.top_radius
	disk.height=0.03
	ring.mesh=disk
	ring.material_override=_mat(team_color)
	node.add_child(ring)
	var name_tag:=Label3D.new()
	name_tag.billboard=BaseMaterial3D.BILLBOARD_ENABLED
	name_tag.font_size=36
	name_tag.outline_size=8
	name_tag.modulate=team_color
	name_tag.position=Vector3(0,2.1 if kind=="hero" else 2.6 if kind=="tower" else 1.0,0)
	node.add_child(name_tag)
	node.position=_world(p["pos"])
	var record: Dictionary={"node":node,"label":name_tag,"model":model,"animation":"","target":node.position,"attack_until":0}
	_play(record,"Idle")
	return record

func _play(record: Dictionary, desired: String) -> void:
	if record.is_empty():
		return
	if desired=="Attack":
		record["attack_until"]=Time.get_ticks_msec()+350
	elif Time.get_ticks_msec()<int(record.get("attack_until",0)):
		return
	if record.get("animation")==desired:
		return
	for n in record["model"].find_children("*","AnimationPlayer",true,false):
		var player: AnimationPlayer=n
		for clip in player.get_animation_list():
			if desired.to_lower() in str(clip).to_lower():
				player.play(clip,0.15)
				record["animation"]=desired
				return

func _sync_actors(weight: float) -> void:
	var seen: Dictionary={}
	for group in [sim.state["players"].values(),sim.state["towers"],sim.state["units"]]:
		for p in group:
			var id:=str(p["id"])
			if not sim._alive(p):
				if actors.has(id):actors[id]["node"].hide()
				continue
			seen[id]=true
			if not actors.has(id):
				actors[id]=_make_actor(p)
			var a: Dictionary=actors[id]
			var n: Node3D=a["node"]
			n.show()
			var next:=_world(p["pos"])
			var motion:=next-n.position
			if motion.length_squared()>0.001:
				a["target"]=next
				if weight>=1.0:n.position=next
				if p["kind"]=="hero":
					a["model"].rotation.y=atan2(motion.x,motion.z)
					_play(a,"Walk")
			elif p["kind"]=="hero":
				_play(a,"Idle")
			var name:=str(p.get("hero","CORE" if p.get("core",false) else p["kind"])).to_upper()
			a["label"].text=name+"  "+str(int(p["hp"]))+"/"+str(int(p.get("max_hp",p["hp"])))
	for id in actors.keys():
		if not seen.has(id) and sim.actor(str(id)).is_empty():
			actors[id]["node"].queue_free()
			actors.erase(id)

func _flash(at: Vector3, c: Color, size: float) -> void:
	if effect_nodes.size()>=20:return
	var n:=MeshInstance3D.new()
	var ring:=TorusMesh.new()
	ring.inner_radius=size*0.65
	ring.outer_radius=size
	n.mesh=ring
	n.material_override=_mat(c)
	add_child(n)
	n.position=at+Vector3(0,0.13,0)
	effect_nodes.append({"node":n,"life":0.42})

func _read_events() -> void:
	for e in sim.state["events"]:
		if int(e["id"])<=event_cursor:continue
		event_cursor=int(e["id"])
		audio.play_match_event(e)
		if e["type"]=="damage" and e.has("pos"):
			_flash(_world(e["pos"]),Color("#ffba73"),0.42)
			_play(actors.get(str(e.get("from","")),{}),"Attack")

func _process(delta: float) -> void:
	if not running:return
	for record in actors.values():
		var actor_node: Node3D=record["node"]
		if actor_node.visible:
			actor_node.position=actor_node.position.lerp(record["target"],minf(1.0,delta*14.0))
	var p: Dictionary=sim.actor("A0")
	var target:=_world(p["pos"])
	camera.position=camera.position.lerp(target+Vector3(0,28,20),minf(1.0,delta*6.0))
	camera.look_at(camera.position-Vector3(0,28,20))
	for fx in effect_nodes.duplicate():
		fx["life"]-=delta
		if fx["life"]<=0.0:
			fx["node"].queue_free()
			effect_nodes.erase(fx)
		else:
			fx["node"].scale=Vector3.ONE*(1.0+(0.42-fx["life"])*2.0)
	map_elapsed+=delta
	if map_elapsed>=0.35:
		map_elapsed=0.0
		_update_map()
	if sim.state["status"]!="active" and not result_shown:
		result_shown=true
		_notice("VICTORY" if sim.state["winner"]=="A" else "DEFEAT" if sim.state["winner"]=="B" else "DRAW")
		_show_result()

func _update_hud() -> void:
	var p: Dictionary=sim.actor("A0")
	stats.text="%s  L%d  HP %d/%d  MP %d  GOLD %d   |   %02d:%02d   |   %d : %d"%[str(p["hero"]).to_upper(),int(p["level"]),int(p["hp"]),int(p["max_hp"]),int(p["mana"]),int(p["gold"]),int(sim.state["time"])/60,int(sim.state["time"])%60,int(sim.actor("A-core")["hp"]),int(sim.actor("B-core")["hp"])]
	for cmd in skills:
		var button: Button=skills[cmd]
		var required:=6 if cmd=="ultimate" else 3 if cmd=="secondary" else 1
		var seconds:=float(sim.config["starter"].get(p["hero"],{}).get(cmd,{}).get("cd",6000))/1000.0
		var left:=maxf(0.0,seconds-(float(sim.state["time"])-float(p["cooldowns"][cmd])))
		button.text=cmd.to_upper()+("\nL"+str(required) if int(p["level"])<required else "\n"+str(ceili(left))+"s" if left>0.0 else "")
		button.disabled=int(p["level"])<required or left>0.0 or not sim._alive(p)
	if not sim._alive(p):status.text="Respawn in "+str(ceili(maxf(0.0,float(p["respawn_at"])-float(sim.state["time"]))))

func _update_map() -> void:
	var image:=Image.create(96,60,false,Image.FORMAT_RGB8)
	image.fill(Color("#142e33"))
	for lane in sim.config["maps"][sim.state["map"]]["lanes"]:
		image.fill_rect(Rect2i(0,int(float(lane)*59.0),96,1),Color("#8b9683"))
	for group in [sim.state["players"].values(),sim.state["towers"]]:
		for p in group:
			if not sim._alive(p):continue
			var pos: Vector2=p["pos"]
			var x:=clampi(int(pos.x/float(sim.state["w"])*95.0),0,93)
			var y:=clampi(int(pos.y/float(sim.state["h"])*59.0),0,57)
			image.fill_rect(Rect2i(x,y,3,3),Color.WHITE if p["id"]=="A0" else TEAM_A if p["team"]=="A" else TEAM_B)
	map_texture.update(image)

func _show_result() -> void:
	var panel:=VBoxContainer.new()
	panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	panel.offset_left=-220;panel.offset_right=220;panel.offset_top=-100
	hud.add_child(panel)
	var p: Dictionary=sim.actor("A0")
	_label(panel,last_status+" • OFFLINE",36)
	_label(panel,"Kills %d  Deaths %d  Level %d"%[int(p["kills"]),int(p["deaths"]),int(p["level"])],22)
	_label(panel,"No account points or rewards were granted.",18)
	_button(panel,"RETURN TO EMPIRE",func():get_node("/root/EmpireSession").return_to_menu())

func _exit_tree() -> void:
	for n in templates.values():
		if is_instance_valid(n):n.free()
