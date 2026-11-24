extends SceneTree
func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var manifest = JSON.parse_string(FileAccess.get_file_as_string("res://data/standalone_media_manifest.json"))
	if not (manifest is Dictionary) or manifest.get("server_settlement", true):
		push_error("Unsafe standalone authority"); quit(1); return
	for record in manifest.get("assets", []):
		var bytes := FileAccess.get_file_as_bytes("res://" + str(record["path"]))
		if bytes.size() != int(record["bytes"]):
			push_error("Missing raw media: " + str(record["path"])); quit(2); return
	var hub = load("res://scenes/EmpireHub.tscn").instantiate()
	root.add_child(hub)
	await process_frame
	current_scene = hub
	hub.open_world("arena", "res://scenes/Arena.tscn")
	await scene_changed
	await process_frame
	var arena = current_scene
	if not arena.sim.available():
		push_error("Arena simulation unavailable"); quit(3); return
	arena._exit()
	await scene_changed
	await process_frame
	current_scene.open_world("kingdom", "res://scenes/WorldPreview.tscn")
	await scene_changed
	await process_frame
	if current_scene.world_id != "kingdom" or current_scene.image_texture == null:
		push_error("Kingdom scene or artwork unavailable"); quit(4); return
	change_scene_to_file("res://scenes/PremiumWorld3D.tscn")
	await scene_changed
	await process_frame
	var snap: Dictionary = current_scene.get_dev_snapshot()
	if snap.get("world") != "kingdom" or int(snap.get("models", 0)) < 8 or not snap.get("rigged_available", false) or snap.get("server_settlement", true):
		push_error("Kingdom 3D runtime failed"); quit(5); return
	current_scene.queue_free()
	await process_frame
	await process_frame
	print("BUKLOD_EMPIRE_STANDALONE_SMOKE_PASS: hub, canonical combat, Kingdom and raw 3D assets")
	quit(0)
