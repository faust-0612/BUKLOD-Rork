## Immutable, fail-closed updater. No auth credentials, arbitrary URLs, or native code.
extends Node
signal status_changed
const CONFIG := "res://empire-ota/config.json"
const DIR := "user://empire-ota-v1"
const STATE := DIR + "/state.json"
const MAX_BYTES := 128 * 1024 * 1024
const MAX_MANIFEST := 65536
const MAX_ENTRIES := 4096
const COOLDOWN := 60.0
const PROTECTED := ["scripts/empire_ota.gd","scripts/empire_boot.gd","scripts/empire_session.gd","scripts/empire_menu.gd","scenes/EmpireBoot.tscn","scenes/EmpireMenu.tscn"]
var config: Dictionary = {}
var state: Dictionary = {"active":{},"previous":{},"pending":{},"high":0,"booting":""}
var status: String = "Starting update check"
var busy := false
var progress: float = -1.0
var checked_once := false
var mounted: Dictionary = {}
var next_check: int = 0
var request: HTTPRequest
var current_download := false
var restart_required := false
var last_progress_at: int = 0

func _ready() -> void:
 var raw: Variant = JSON.parse_string(FileAccess.get_file_as_string(CONFIG))
 if raw is Dictionary:
  config = raw
 DirAccess.make_dir_recursive_absolute(DIR)
 if FileAccess.file_exists(STATE):
  var saved: Variant = JSON.parse_string(FileAccess.get_file_as_string(STATE))
  if saved is Dictionary and saved.get("active") is Dictionary and saved.get("previous") is Dictionary and saved.get("pending") is Dictionary and saved.has("high") and saved.has("booting"):
   state = saved
   state.high = int(state.high)
 request = HTTPRequest.new()
 request.max_redirects = 0
 request.timeout = 120.0
 add_child(request)
 set_process(false)

func boot_into_menu() -> void:
 if not mount_on_boot():
  _show_recovery()
  return
 var scene: PackedScene = load("res://scenes/EmpireMenu.tscn")
 if scene == null or get_tree().change_scene_to_packed(scene) != OK:
  fail_current("Menu load failed")
  _show_recovery()
  return
 await get_tree().scene_changed
 await get_tree().process_frame
 if DisplayServer.get_name() != "headless":
  await RenderingServer.frame_post_draw
 if get_tree().current_scene == null or get_tree().current_scene.name != "EmpireMenu":
  fail_current("Menu readiness failed")
  _show_recovery()
  return
 confirm_boot()

func _show_recovery() -> void:
 var label := Label.new()
 label.text = "Update recovery saved. Close and reopen Empire."
 label.position = Vector2(48,48)
 label.add_theme_font_size_override("font_size",24)
 get_tree().root.add_child(label)
 var exit_button := Button.new()
 exit_button.text = "EXIT EMPIRE"
 exit_button.position = Vector2(48,110)
 exit_button.pressed.connect(func() -> void: get_tree().quit())
 get_tree().root.add_child(exit_button)

func _set_status(message: String, amount: float = -1.0) -> void:
 status = message
 progress = amount
 status_changed.emit()

func _save() -> bool:
 var out := FileAccess.open(STATE + ".tmp", FileAccess.WRITE)
 if out == null:
  return false
 out.store_string(JSON.stringify(state))
 out.flush()
 out.close()
 return DirAccess.rename_absolute(STATE + ".tmp", STATE) == OK

func _enabled() -> bool:
 return config.get("key","") is String and not str(config.get("key","")).is_empty() and config.get("channel","") in ["dev","staging","production"] and str(config.get("base","")).length() == 64 and config.get("runtime","") == "empire-godot-4.7.2-r1"

func _hex(s: String) -> bool:
 if s.length() != 64:
  return false
 for c in s:
  if not c in "0123456789abcdef":
   return false
 return true

func _allowed_path(p: String) -> bool:
 if p.is_empty() or p.begins_with("/") or p.contains("\\") or p.contains(":") or p in PROTECTED:
  return false
 for part in p.split("/"):
  if part.is_empty() or part == "." or part == ".." or part.begins_with("."):
   return false
 var folder := p.get_slice("/",0)
 return folder in ["scripts","scenes","art","audio","world-art","world-audio","kingdom-items","3d","data","shaders"] and p.get_extension().to_lower() in ["gd","tscn","tres","gdshader","png","webp","jpg","jpeg","wav","ogg","glb","json"]

## Signature is over the exact UTF-8 payload bytes, not reserialized JSON.
func validate_envelope(envelope: Dictionary) -> Dictionary:
 if not _enabled() or not envelope.get("payload") is String or not envelope.get("signature") is String:
  return {}
 var bytes := Marshalls.base64_to_raw(envelope.payload)
 var sig := Marshalls.base64_to_raw(envelope.signature)
 if bytes.is_empty() or bytes.size() > MAX_MANIFEST or sig.size() < 128 or sig.size() > 1024:
  return {}
 var key := CryptoKey.new()
 if key.load_from_string(str(config.key),true) != OK:
  return {}
 var hash := HashingContext.new()
 hash.start(HashingContext.HASH_SHA256)
 hash.update(bytes)
 if not Crypto.new().verify(HashingContext.HASH_SHA256,hash.finish(),sig,key):
  return {}
 var data: Variant = JSON.parse_string(bytes.get_string_from_utf8())
 if not data is Dictionary:
  return {}
 if data.get("schema") != 1 or data.get("package") != "org.mzbministry.buklod.empire" or data.get("channel") != config.channel or data.get("runtime") != config.runtime or data.get("base") != config.base:
  return {}
 var sequence: Variant = data.get("sequence",0)
 var size: Variant = data.get("bytes",0)
 if not (sequence is int or sequence is float) or not (size is int or size is float):
  return {}
 if sequence != floor(float(sequence)) or sequence < 1 or sequence > 2147483647 or size != floor(float(size)) or size < 22 or size > MAX_BYTES:
  return {}
 if not data.get("sha256") is String or not _hex(data.sha256):
  return {}
 return data

func _pack_path(data: Dictionary) -> String:
 return DIR + "/" + str(data.sha256) + ".zip"

func _verify_pack(path: String, data: Dictionary) -> bool:
 if not FileAccess.file_exists(path):
  return false
 var f := FileAccess.open(path,FileAccess.READ)
 if f == null:
  return false
 var size := f.get_length()
 f.close()
 if size != int(data.bytes) or FileAccess.get_sha256(path) != data.sha256:
  return false
 var zip := ZIPReader.new()
 if zip.open(path) != OK:
  return false
 var files := zip.get_files()
 var seen: Dictionary = {}
 if files.is_empty() or files.size() > MAX_ENTRIES:
  zip.close()
  return false
 for p in files:
  if not _allowed_path(p) or seen.has(p):
   zip.close()
   return false
  seen[p] = true
 zip.close()
 return true

func _record_valid(envelope: Dictionary) -> Dictionary:
 var data := validate_envelope(envelope)
 if data.is_empty() or not _verify_pack(_pack_path(data),data):
  return {}
 return data

func _remove_unreferenced() -> void:
 var keep: Dictionary = {}
 for slot in ["active","previous","pending"]:
  var record: Dictionary = validate_envelope(state[slot])
  if not record.is_empty():
   keep[str(record.sha256)+".zip"] = true
 var directory := DirAccess.open(DIR)
 if directory == null:
  return
 for f in directory.get_files():
  if f.ends_with(".zip") and _hex(f.trim_suffix(".zip")) and not keep.has(f):
   directory.remove(f)

## One cumulative overlay against immutable APK baseline. Never mount two deltas.
func mount_on_boot() -> bool:
 if state.booting != "":
  if state.booting == "active":
   state.active = state.previous
   state.previous = {}
  state.pending = {}
  state.booting = ""
  if not _save():
   return false
  _set_status("Recovered from interrupted update")
 var slot := "pending" if not state.pending.is_empty() else "active"
 var envelope: Dictionary = state[slot]
 if envelope.is_empty():
  _set_status("APK content active" if _enabled() else "APK content • update channel not configured")
  return true
 var data := _record_valid(envelope)
 if data.is_empty():
  if slot == "active":
   state.active = state.previous
   state.previous = {}
  state.pending = {}
  if not _save():
   return false
  return mount_on_boot()
 state.booting = slot
 if not _save():
  return false
 if not ProjectSettings.load_resource_pack(_pack_path(data),true):
  fail_current("Content mount failed")
  return false
 mounted = data
 _set_status("Content v" + str(int(data.sequence)) + " verifying")
 print("BUKLOD_EMPIRE_OTA_MOUNTED "+str(int(data.sequence)))
 return true

func confirm_boot() -> void:
 if state.booting == "pending":
  state.previous = state.active
  state.active = state.pending
  state.pending = {}
 if state.booting != "":
  state.booting = ""
  if not _save():
   _set_status("Update receipt could not be saved")
   return
 if not mounted.is_empty():
  _set_status("Content v"+str(int(mounted.sequence))+" active")
  print("BUKLOD_EMPIRE_OTA_READY "+str(int(mounted.sequence)))
 _remove_unreferenced()

func fail_current(reason: String) -> void:
 if state.booting == "active" or (state.booting == "" and not state.active.is_empty()):
  state.active = state.previous
  state.previous = {}
 state.pending = {}
 state.booting = ""
 restart_required = true
 _save()
 _set_status(reason + " • reopen Empire to recover")

func rollback() -> void:
 if busy or restart_required or state.active.is_empty():
  return
 state.active = state.previous
 state.previous = {}
 state.pending = {}
 state.booting = ""
 if _save():
  restart_required = true
  _set_status("Rollback saved • close and reopen Empire")

## Used by network download and isolated signed-fixture tests. No external paths exposed.
func stage_verified(envelope: Dictionary, path: String) -> bool:
 var data := validate_envelope(envelope)
 if data.is_empty() or int(data.sequence) <= int(state.high) or not _verify_pack(path,data):
  return false
 var dest := _pack_path(data)
 if path != dest:
  if FileAccess.file_exists(dest):
   if not _verify_pack(dest,data):
    return false
   DirAccess.remove_absolute(path)
  elif DirAccess.rename_absolute(path,dest) != OK:
   return false
 var before := state.duplicate(true)
 state.pending = envelope
 state.high = int(data.sequence)
 if not _save():
  state = before
  return false
 _remove_unreferenced()
 restart_required = true
 _set_status("Content v"+str(int(data.sequence))+" downloaded • next launch")
 return true

func check_once() -> void:
 if checked_once:
  return
 checked_once = true
 if _enabled():
  await get_tree().create_timer(2.0).timeout
  if get_tree().current_scene != null and get_tree().current_scene.name == "EmpireMenu":
   await check_update()

func _origin() -> String:
 # Fixed existing MAIN project; read-only public release path. No arbitrary manifest URLs.
 return "https://yhanxndaqbmuzbdqlblu.supabase.co/storage/v1/object/public/empire-updates/"+str(config.channel)+"/"

func _process(_delta: float) -> void:
 if current_download and Time.get_ticks_msec() - last_progress_at >= 250:
  last_progress_at = Time.get_ticks_msec()
  var total := request.get_body_size()
  var bytes := request.get_downloaded_bytes()
  _set_status("Downloading game content • "+str(int(bytes/1024))+" KB",clampf(float(bytes)/float(total),0.0,1.0) if total > 0 else -1.0)

func check_update() -> void:
 if busy:
  return
 if restart_required:
  _set_status("Update or rollback saved • close and reopen Empire")
  return
 if not _enabled():
  _set_status("Update channel not configured")
  return
 if Time.get_ticks_msec() < next_check:
  _set_status("Update check cooling down • retry shortly")
  return
 if not state.pending.is_empty():
  _set_status("Downloaded update • close and reopen Empire")
  return
 busy = true
 next_check = Time.get_ticks_msec() + int(COOLDOWN*1000)
 _set_status("Checking signed update manifest")
 request.download_file = ""
 request.body_size_limit = MAX_MANIFEST
 if request.request(_origin()+"manifest.json",["Accept: application/json","Cache-Control: no-cache"]) != OK:
  busy = false
  _set_status("Update check unavailable")
  return
 var result: Array = await request.request_completed
 if result[0] != HTTPRequest.RESULT_SUCCESS or result[1] != 200:
  busy = false
  _set_status("No update available or connection interrupted")
  return
 var envelope: Variant = JSON.parse_string(result[3].get_string_from_utf8())
 var data: Dictionary = validate_envelope(envelope) if envelope is Dictionary else {}
 if data.is_empty():
  busy = false
  _set_status("Update rejected • signature or compatibility")
  return
 if int(data.sequence) <= int(state.high):
  busy = false
  _set_status("No newer compatible update")
  return
 var temp := DIR+"/download.part"
 var downloaded := false
 for attempt in range(2):
  DirAccess.remove_absolute(temp)
  request.download_file = temp
  request.body_size_limit = int(data.bytes)
  current_download = true
  set_process(true)
  var started := request.request(_origin()+str(data.sha256)+".zip",["Accept: application/zip"])
  if started == OK:
   var response: Array = await request.request_completed
   downloaded = response[0] == HTTPRequest.RESULT_SUCCESS and response[1] == 200
  current_download = false
  set_process(false)
  if downloaded:
   break
  if attempt == 0:
   await get_tree().create_timer(2.0).timeout
 request.download_file = ""
 busy = false
 if not downloaded or not stage_verified(envelope,temp):
  DirAccess.remove_absolute(temp)
  _set_status("Download incomplete or invalid • existing content kept")
