extends SceneTree

func _initialize() -> void:
	call_deferred("_verify")

func _verify() -> void:
	var heroes: Array[String] = ["phan", "quin", "van", "christian", "lhen", "ace",
		"ellusur", "jawo", "mitch", "niel", "angel", "vhen", "trudice"]
	var variants: Array[String] = ["idle", "walk", "attack", "skill"]
	var count: int = 0
	for hero in heroes:
		for pose in variants:
			var path: String = "res://art/fullbody/" + hero + "_" + pose + ".webp"
			if not FileAccess.file_exists(path):
				push_error("Missing approved native pose " + path)
				quit(2)
				return
			var image: Image = Image.load_from_file(path)
			if image == null or image.is_empty():
				push_error("Cannot decode native hero artwork " + path)
				quit(3)
				return
			count += 1
		var sprite_path: String = "res://art/sprite/" + hero + ".webp"
		var sprite: Image = Image.load_from_file(sprite_path)
		if sprite == null or sprite.is_empty():
			push_error("Cannot decode native sprite " + sprite_path)
			quit(4)
			return
		count += 1
	for map_name in ["genesis_rift", "aurora_foundry", "verdant_fracture"]:
		var backdrop: Image = Image.load_from_file("res://art/scene/" + map_name + ".png")
		if backdrop == null or backdrop.is_empty():
			push_error("Missing or invalid approved map " + map_name)
			quit(5)
			return
		count += 1
	if count != 68:
		push_error("Approved art source count mismatch")
		quit(6)
		return
	print("BUKLOD_GODOT_ART_PASS: decoded 52 poses, 13 actor sprites, 3 actual map backgrounds")
	quit(0)
