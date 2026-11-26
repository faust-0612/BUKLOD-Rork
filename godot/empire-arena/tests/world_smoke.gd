## Godot headless checks for the same packed project (no server connection).
extends SceneTree
func _initialize() -> void:
	call_deferred("_run")
func _run() -> void:
	var script = load("res://scripts/world_preview.gd")
	if script == null:
		quit(1)
		return
	var world: Node2D = script.new()
	root.add_child(world)
	if world.preview_level != 1 or world.preview_stage != 0:
		quit(2)
		return
	world.change_preview_level(20)
	if world.preview_level != 10:
		quit(3)
		return
	world.change_preview_level(-50)
	if world.preview_level != 1:
		quit(4)
		return
	world.advance_preview_stage()
	if world.preview_stage != 1:
		quit(5)
		return
	for name in ["kingdom", "community", "house"]:
		var picture: Image = Image.load_from_file("res://world-art/" + name + ".webp")
		if picture == null or picture.is_empty():
			push_error("BUKLOD_WORLD_ASSET_FAIL: " + name)
			quit(6)
			return
	for name in ["navigation", "build_start", "build_complete", "claim"]:
		var clip: AudioStreamWAV = AudioStreamWAV.load_from_file("res://world-audio/" + name + ".wav")
		if clip == null:
			push_error("BUKLOD_WORLD_SOUND_FAIL: " + name)
			quit(7)
			return
	print("BUKLOD_GENESIS_GODOT_WORLDS_PASS: kingdom / community / house / level-substage / existing media")
	# Allow queued audio work to settle before teardown.
	await create_timer(0.2).timeout
	for player in [world.audio, world.ambient_player]:
		if is_instance_valid(player):
			player.stop()
			player.stream = null
	await create_timer(0.2).timeout
	world.free()
	await process_frame
	await process_frame
	print("WORLD_RESOURCE_TEARDOWN_COMPLETE")
	quit(0)
