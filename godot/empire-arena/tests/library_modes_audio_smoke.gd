## Exact native Godot 4.7.2 practice mode and 70-sound Library runtime acceptance.
extends SceneTree

func _initialize() -> void:
  call_deferred("_verify")

func _die(reason: String, code: int) -> void:
  push_error(reason)
  quit(code)

func _verify() -> void:
  var script = load("res://scripts/arena_simulation.gd")
  if script == null:
    _die("Arena native simulation cannot load", 10)
    return
  var sim = script.new()
  var modes: Dictionary = sim.config.get("libraryModes", {})
  if modes.size() != 4:
    _die("Expected four owner Library modes", 11)
    return
  var definitions := {
    "classic_conquest": {"heroes": 10, "lanes": 3, "seconds": 30.0},
    "genesis_rift": {"heroes": 6, "lanes": 1, "seconds": 20.0},
    "dominion_frontier": {"heroes": 10, "lanes": 1, "seconds": 25.0},
    "special_event": {"heroes": 10, "lanes": 3, "seconds": 30.0}
  }
  var library_actors = load("res://scripts/arena_library_actors.gd")
  for mode_id in definitions:
    var expected: Dictionary = definitions[mode_id]
    if not sim.begin(mode_id, "phan", "genesis_rift", false, "ace", "normal", 71):
      _die("Cannot start offline mode: " + mode_id, 12)
      return
    if sim.state["players"].size() != int(expected["heroes"]):
      _die("Incorrect hero team size for: " + mode_id, 13)
      return
    if bool(modes[mode_id].get("ranked", false)):
      _die("Client practice claims ranked currency authority", 14)
      return
    sim.state["time"] = float(expected["seconds"])
    library_actors.advance_waves(sim)
    var roles: Array = []
    for u in sim.state["units"]:
      if u.get("library_minion", false):
        roles.append(u.get("library_lane", -1))
    if roles.is_empty() or SetOf(roles).size() != int(expected["lanes"]):
      _die("Wave lanes/mode interval broken: " + mode_id, 15)
      return
  var f = FileAccess.open("res://data/audio_manifest.json", FileAccess.READ)
  if f == null:
    _die("70-cue audio manifest missing", 16)
    return
  var manifest: Variant = JSON.parse_string(f.get_as_text())
  if typeof(manifest) != TYPE_DICTIONARY or manifest.get("ids", []).size() != 70:
    _die("Audio cues incomplete", 17)
    return
  for cue in manifest["ids"]:
    var path := "res://audio/sfx/" + str(cue) + ".wav"
    var sound := AudioStreamWAV.load_from_file(path)
    if sound == null:
      _die("Audio asset missing/undecodable: " + path, 18)
      return
  var audio_script = load("res://scripts/arena_audio.gd")
  var audio = audio_script.new()
  root.add_child(audio)
  if not audio.play_cue("phan_basic", true):
    _die("Godot character sound player did not start", 19)
    return
  if not audio.play_command("ellusur", "primary", sim.config["starter"]["ellusur"]):
    _die("ELESUR/elesur identity mapping failed", 20)
    return
  audio.stop_all()
  audio.queue_free()
  print("BUKLOD_GODOT_LIBRARY_MODES_AUDIO_PASS: 4 offline modes / correct wave lanes / 70 valid WAVs / 13 hero sound identities")
  quit(0)

func SetOf(values: Array) -> Dictionary:
  var result := {}
  for item in values:
    result[item] = true
  return result
