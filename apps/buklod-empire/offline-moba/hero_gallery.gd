extends SceneTree
var world: Node3D
var camera: Camera3D
var shot_dir: String
func _initialize() -> void:
	call_deferred("_run")
func _run() -> void:
	root.size=Vector2i(1600,900)
	world=Node3D.new()
	root.add_child(world)
	var environment:=WorldEnvironment.new()
	var env:=Environment.new()
	env.background_mode=Environment.BG_COLOR
	env.background_color=Color("#111c2d")
	env.ambient_light_source=Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color=Color("#d7e5f7")
	env.ambient_light_energy=0.85
	environment.environment=env
	world.add_child(environment)
	for i in range(2):
		var light:=DirectionalLight3D.new()
		light.rotation_degrees=Vector3(-35,-28,0) if i==0 else Vector3(-40,145,0)
		light.light_energy=1.35 if i==0 else 0.68
		light.light_color=Color("#fff2d3") if i==0 else Color("#8bd6ff")
		world.add_child(light)
	camera=Camera3D.new()
	camera.projection=Camera3D.PROJECTION_ORTHOGONAL
	camera.size=13.4
	camera.current=true
	world.add_child(camera)
	camera.position=Vector3(0,7.0,17)
	camera.look_at(Vector3(0,1.7,0))
	var manifest: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://3d/buklod_heroes/manifest.json"))
	var models: Array[Node3D]=[]
	for i in range(manifest["heroes"].size()):
		var record: Dictionary=manifest["heroes"][i]
		var id: String=record["id"]
		var doc:=GLTFDocument.new()
		var state:=GLTFState.new()
		var bytes:=FileAccess.get_file_as_bytes("res://3d/buklod_heroes/"+id+".glb")
		if doc.append_from_buffer(bytes,"res://3d/buklod_heroes/",state)!=OK:
			push_error("HERO_GALLERY_IMPORT_FAILED "+id)
			quit(1)
			return
		var model: Node3D=doc.generate_scene(state)
		world.add_child(model)
		model.position=Vector3((float(i%7)-3.0)*2.05,0,-2.8 if i<7 else 2.6)
		model.rotation.y=0.14 if i%2==0 else -0.14
		models.append(model)
		var label:=Label3D.new()
		label.text=id.to_upper()
		label.font_size=48
		label.pixel_size=0.005
		label.outline_size=10
		label.modulate=Color("#f5dca2")
		label.billboard=BaseMaterial3D.BILLBOARD_ENABLED
		model.add_child(label)
		label.position=Vector3(0,-0.18,0.5)
		var pedestal:=MeshInstance3D.new()
		var cylinder:=CylinderMesh.new()
		cylinder.top_radius=0.67
		cylinder.bottom_radius=0.74
		cylinder.height=0.12
		pedestal.mesh=cylinder
		var material:=StandardMaterial3D.new()
		material.albedo_color=Color("#33475f")
		material.metallic=0.35
		pedestal.material_override=material
		model.add_child(pedestal)
		pedestal.position.y=-0.06
		var players:=model.find_children("*","AnimationPlayer",true,false)
		if not players.is_empty():
			players[0].play("Idle")
	for i in range(10):
		await process_frame
	await RenderingServer.frame_post_draw
	var png:=root.get_texture().get_image()
	if png==null or png.is_empty() or png.save_png("user://hero-roster.png")!=OK:
		push_error("HERO_GALLERY_SCREENSHOT_FAILED")
		quit(1)
		return
	var path:=ProjectSettings.globalize_path("user://hero-roster.png")
	print("BUKLOD_HERO_GALLERY_PNG "+path)
	quit(0)
