extends SceneTree
const SIM=preload("res://scripts/moba_sim.gd")
func _initialize() -> void:
	call_deferred("_run")
func check(ok: bool, label: String) -> bool:
	if not ok:
		push_error("MOBA_TEST_FAILED "+label)
		quit(1)
	return ok
func _run() -> void:
	var sim=SIM.new()
	if not check(sim.start("phan","normal"),"start"):return
	if not check(sim.state["players"].size()==10,"5v5 roster"):return
	if not check(sim.config["maps"][sim.state["map"]]["lanes"].size()==3,"canonical map ID resolved"):return
	if not check(sim.state["library_wave_index"]==0,"wave cursor initialized"):return
	if not check(sim.state["towers"].size()==8,"6 towers and 2 cores"):return
	var p: Dictionary=sim.actor("A0")
	var enemy: Dictionary=sim.actor("B0")
	var first: Vector2=p["pos"]
	if not check(sim.buy("A0","blade"),"shop purchase"):return
	if not check(not sim.buy("A0","blade"),"duplicate shop"):return
	if not check(sim.action("A0","move",Vector2.RIGHT),"move"):return
	if not check(p["pos"]!=first,"position changed"):return
	p["pos"]=Vector2(100,110)
	enemy["pos"]=Vector2(102,110)
	var before: float=enemy["hp"]
	if not check(sim.action("A0","attack",Vector2.RIGHT,"B0"),"basic attack"):return
	if not check(enemy["hp"]<before,"actual damage"):return
	if not check(not sim.action("A0","attack",Vector2.RIGHT,"B0"),"cooldown"):return
	if not check(not sim.action("A0","ultimate",Vector2.RIGHT,"B0"),"ultimate locked"):return
	var core: Dictionary=sim.actor("B-core")
	var hp: float=core["hp"]
	if not check(not sim._hit(p,core,300.0) and core["hp"]==hp,"core protected"):return
	sim._hit(p,sim.actor("B-tower-0"),300.0)
	sim._hit(p,sim.actor("B-tower-0"),300.0)
	if not check(sim._core_open("B"),"tower gate"):return
	for i in range(45):sim.advance()
	if not check(sim.state["units"].size()>0,"minion waves"):return
	for id in ["A1","A2","A3","A4","B1","B2","B3","B4"]:
		if not check(sim.actor(id)["pos"]!=sim.actor(id)["spawn"],"bot leaves spawn "+id):return
	var finish_sim=SIM.new()
	if not check(finish_sim.start("phan","normal"),"fresh victory scenario"):return
	var attacker: Dictionary=finish_sim.actor("A0")
	var final_core: Dictionary=finish_sim.actor("B-core")
	for i in range(2):
		finish_sim._hit(attacker,finish_sim.actor("B-tower-0"),300.0)
	for i in range(2):
		if not check(finish_sim._hit(attacker,final_core,300.0),"valid core damage"):return
	if not check(finish_sim.state["status"]=="finished" and finish_sim.state["winner"]=="A","core victory"):return
	if not check(not finish_sim._hit(attacker,finish_sim.actor("B1"),20.0),"no damage after result"):return
	var aim_sim=SIM.new()
	if not check(aim_sim.start("niel"),"aim scenario"):return
	var caster: Dictionary=aim_sim.actor("A0")
	caster["pos"]=Vector2(100,100)
	var east: Dictionary=aim_sim.actor("B0")
	var west: Dictionary=aim_sim.actor("B1")
	east["pos"]=Vector2(108,100)
	west["pos"]=Vector2(96,100)
	var old_east: float=east["hp"]
	var old_west: float=west["hp"]
	if not check(aim_sim.cast_aimed("A0","primary",Vector2.RIGHT,true),"directional cast"):return
	if not check(east["hp"]<old_east and west["hp"]==old_west,"manual aim hits intended side"):return
	var world: Node=load("res://scenes/Moba3D.tscn").instantiate()
	root.add_child(world)
	await process_frame
	if not check(world.start_match("van","easy"),"3D scene start"):return
	for i in range(35):await process_frame
	if not check(world.actors.size()>=18,"3D hero/tower nodes"):return
	var manifest=JSON.parse_string(FileAccess.get_file_as_string("res://3d/buklod_heroes/manifest.json"))
	if not check(manifest is Dictionary and manifest["heroes"].size()==13,"hero manifest"):return
	var hashes: Dictionary={}
	for record in manifest["heroes"]:
		var id: String=record["id"]
		var model: Node3D=world._hero_model(id)
		if not check(model!=null,"load independent model "+id):return
		var actual=model.find_children("*","Skeleton3D",true,false)
		if not check(actual.size()==1 and actual[0].get_bone_count()>=16,"independent skeleton "+id):return
		var players=model.find_children("*","AnimationPlayer",true,false)
		if not check(players.size()>0,"animation player "+id):return
		for clip in record["clips"]:
			if not check(players[0].has_animation(clip),"clip "+id+" "+str(clip)):return
			var animation: Animation=players[0].get_animation(clip)
			var moving_tracks:=0
			for track in range(animation.get_track_count()):
				if animation.track_get_key_count(track)<2:continue
				var initial: Variant=animation.track_get_key_value(track,0)
				for key in range(1,animation.track_get_key_count(track)):
					if animation.track_get_key_value(track,key)!=initial:
						moving_tracks+=1
						break
			# glTF import strips constant joint tracks. Validate actual changing
			# tracks, not the number of static channels in the authored file.
			if not check(moving_tracks>=1 and animation.length>0.20,"moving skeletal tracks "+id+" "+str(clip)+" "+str(moving_tracks)):return
			print("BUKLOD_HERO_CLIP "+id+" "+str(clip)+" moving="+str(moving_tracks))
		hashes[record["meshHash"]]=true
		var bytes=FileAccess.get_file_as_bytes("res://3d/buklod_heroes/"+id+".glb")
		var hash:=HashingContext.new()
		hash.start(HashingContext.HASH_SHA256)
		hash.update(bytes)
		if not check(hash.finish().hex_encode()==record["sha256"],"model hash "+id):return
		print("BUKLOD_HERO_RUNTIME_VERIFIED "+id)
	if not check(hashes.size()==13 and world.hero_models.size()==13,"13 unique model geometries"):return
	if not check(not world.templates.has("rig_knight") and not world.templates.has("rig_mage"),"no generic shared hero rig loaded"):return
	if not check(world.terrain_count>=25,"dressed battlefield"):return
	if not check(world.HERO_STYLE.size()==13,"distinct hero presentation profiles"):return
	if not check(world.aim_indicator!=null,"aim indicator present"):return
	print("BUKLOD_OFFLINE_MOBA_RUNTIME_PASS")
	quit(0)
