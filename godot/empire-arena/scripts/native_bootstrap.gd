## Trusted APK autoload. Never override startup project path or scene.
## Native bridge supplies only canonical, SHA-256 checked private content.
extends Node

var world: String = "arena"
var token: String = ""
var receipt_path: String = ""
var content_path: String = ""
var pack: String = "embedded"
var rejected: bool = false

func _ready() -> void:
	call_deferred("_boot")

func _receipt(state: String, reason: String = "") -> void:
	var record := {"token": token, "state": state, "world": world, "pack": pack, "reason": reason, "public3d": FileAccess.file_exists("res://data/3d_manifest.json")}
	print("BUKLOD_NATIVE_BOOTSTRAP " + JSON.stringify(record))
	if receipt_path.is_empty() or token.is_empty():
		return
	var temp := receipt_path + ".tmp"
	var handle := FileAccess.open(temp, FileAccess.WRITE)
	if handle == null:
		return
	handle.store_string(JSON.stringify(record))
	handle.close()
	DirAccess.rename_absolute(temp, receipt_path)

func _fail(reason: String) -> void:
	_receipt("failed", reason)
	var message := Label.new()
	message.text = "BUKLOD Genesis — " + reason + "\nBack to BUKLOD to retry."
	message.position = Vector2(48, 56)
	message.add_theme_font_size_override("font_size", 24)
	get_tree().root.add_child(message)
	var back := Button.new()
	back.text = "BACK TO BUKLOD"
	back.position = Vector2(48, 160)
	back.pressed.connect(func() -> void: get_tree().quit(1))
	get_tree().root.add_child(back)

func _boot() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--buklod-world="):
			var candidate: String = arg.trim_prefix("--buklod-world=")
			if candidate in ["arena", "kingdom", "community", "house"]:
				world = candidate
		elif arg.begins_with("--buklod-launch-token="):
			token = arg.trim_prefix("--buklod-launch-token=")
		elif arg.begins_with("--buklod-receipt="):
			receipt_path = arg.trim_prefix("--buklod-receipt=")
		elif arg.begins_with("--buklod-content="):
			content_path = arg.trim_prefix("--buklod-content=")
		elif arg == "--buklod-content-rejected":
			rejected = true
	_receipt("booting")
	if rejected:
		_fail("Verified content path rejected")
		return
	if not content_path.is_empty():
		var filename := content_path.get_file()
		if not filename.ends_with(".zip") or filename.length() != 68 or not content_path.get_base_dir().ends_with("/buklod-genesis-approved-packs"):
			_fail("Invalid private content location")
			return
		# This API mounts an already verified runtime resource pack. It does not
		# alter Godot's startup CLI restrictions or reload project settings.
		if not ProjectSettings.load_resource_pack(content_path, true):
			_fail("Verified content mount failed")
			return
		pack = filename.trim_suffix(".zip")
	_receipt("mounted")
	var scene_path := "res://scenes/Arena.tscn" if world == "arena" else "res://scenes/WorldPreview.tscn"
	var scene: PackedScene = ResourceLoader.load(scene_path, "PackedScene", ResourceLoader.CACHE_MODE_IGNORE_DEEP)
	if scene == null or get_tree().change_scene_to_packed(scene) != OK:
		_fail("Scene load failed")
		return
	await get_tree().scene_changed
	await get_tree().process_frame
	await get_tree().process_frame
	var current := get_tree().current_scene
	if current == null or current.scene_file_path != scene_path:
		_fail("Unexpected scene")
		return
	if world == "arena":
		var simulation: Variant = current.get("sim")
		if simulation == null or not simulation.available():
			_fail("Arena catalog unavailable")
			return
	else:
		var explorer := current.get_node_or_null("InteractiveVisuals")
		if explorer == null or str(current.get("world_id")) != world or current.get("image_texture") == null:
			_fail("World visuals unavailable")
			return
		var avatar: Variant = explorer.get("avatar")
		if avatar == null or avatar.texture == null:
			_fail("World character unavailable")
			return
	# Real Android frame, not startActivity() or a desktop parser check.
	if DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw
	_receipt("ready")
