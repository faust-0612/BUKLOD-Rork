## BUKLOD Library character-event SFX for embedded Arena offline practice.
## Exact 70 cue identities from CC0 recordings and original BUKLOD SFX; no TTS/network.
## Holds a capped player pool and drops excess sounds during heavy combat.
extends Node

const MAX_PLAYERS := 10
const CACHE_CAP := 24
const SOUND_GAP_MS := 110

var sound_enabled := true
var volume_db := -8.0
var _players: Array[AudioStreamPlayer] = []
var _stream_cache: Dictionary = {}
var _last_sound_ms: Dictionary = {}

func _ready() -> void:
  for i in range(MAX_PLAYERS):
    var channel := AudioStreamPlayer.new()
    channel.volume_db = volume_db
    channel.bus = "Master"
    add_child(channel)
    _players.append(channel)

func _normalize_hero(id: String) -> String:
  return "elesur" if id == "ellusur" else id

func _stream(name: String) -> AudioStream:
  if not name.is_valid_identifier() or name.length() > 65:
    return null
  if _stream_cache.has(name):
    return _stream_cache[name]
  var path := "res://audio/sfx/" + name + ".wav"
  var raw: PackedByteArray = FileAccess.get_file_as_bytes(path)
  if raw.is_empty():
    return null
  var s: AudioStream = AudioStreamWAV.load_from_buffer(raw)
  if s == null:
    return null
  if _stream_cache.size() >= CACHE_CAP:
    _stream_cache.erase(_stream_cache.keys().front())
  _stream_cache[name] = s
  return s

func play_cue(name: String, priority := false) -> bool:
  if not sound_enabled:
    return false
  var now := Time.get_ticks_msec()
  if not priority and now - int(_last_sound_ms.get(name, -50000)) < SOUND_GAP_MS:
    return false
  var s := _stream(name)
  if s == null:
    return false
  for channel in _players:
    if not channel.playing:
      channel.stream = s
      channel.volume_db = volume_db
      channel.play()
      _last_sound_ms[name] = now
      return true
  return false

func play_command(hero: String, command: String, kit: Dictionary) -> bool:
  var id := _normalize_hero(hero)
  if command == "attack":
    return play_cue(id + "_basic")
  if command not in ["primary", "secondary", "ultimate"]:
    return false
  var skill: Dictionary = kit.get(command, {})
  var skill_id: String = str(skill.get("id", ""))
  if skill_id.is_empty():
    return false
  var played := play_cue(id + "_" + skill_id)
  if command == "ultimate" and played:
    play_cue(id + "_signature", true)
  return played

func play_match_event(event: Dictionary) -> void:
  match str(event.get("type", "")):
    "library_minion_wave":
      play_cue("wave_spawn")
    "village_level_up", "level_up":
      play_cue("villager_levelup")
    "construction_complete", "seal_damage", "tower_destroyed":
      play_cue("structure_destroyed")
    "tower_attack":
      play_cue("tower_shot")
    "revive":
      play_cue("revive")

func stop_all() -> void:
  for channel in _players:
    channel.stop()
