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
	# Test actual imported resources inside the exported PCK, not raw source files.
	# Every resource is directly preloaded by WorldPreview for export inclusion.
	for name in ["kingdom", "community", "house"]:
		var picture: Texture2D = world.WORLD_ART[name] as Texture2D
		if picture == null or picture.get_width() < 2 or picture.get_height() < 2:
			push_error("BUKLOD_WORLD_ASSET_FAIL: " + name)
			quit(6)
			return
	for name in ["navigation", "build_start", "build_complete", "claim"]:
		var clip: AudioStream = world.WORLD_AUDIO[name] as AudioStream
		if clip == null or clip.get_length() <= 0.0:
			push_error("BUKLOD_WORLD_SOUND_FAIL: " + name)
			quit(7)
			return
	# Do not quit while test-owned audio, nodes and resources are still referenced.
	# Godot 4.7 reports an ERROR on such premature shutdown even when checks passed.
	if world.audio != null:
		world.audio.stop()
	root.remove_child(world)
	world.free()
	script = null
	print("BUKLOD_GENESIS_GODOT_WORLDS_PASS: kingdom / community / house / level-substage / existing media")
	call_deferred("quit", 0)
