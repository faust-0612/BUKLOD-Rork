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
	if not check(sim.actor("A1")["pos"]!=sim.actor("A1")["spawn"],"bot movement"):return
	for i in range(4):sim._hit(p,core,300.0)
	if not check(sim.state["status"]=="finished" and sim.state["winner"]=="A","core victory"):return
	var world: Node=load("res://scenes/Moba3D.tscn").instantiate()
	root.add_child(world)
	await process_frame
	if not check(world.start_match("van","easy"),"3D scene start"):return
	for i in range(35):await process_frame
	if not check(world.actors.size()>=18,"3D hero/tower nodes"):return
	if not check(world.templates.has("rig_knight") and world.templates.has("rig_mage"),"both real rigs loaded"):return
	print("BUKLOD_OFFLINE_MOBA_RUNTIME_PASS")
	quit(0)
