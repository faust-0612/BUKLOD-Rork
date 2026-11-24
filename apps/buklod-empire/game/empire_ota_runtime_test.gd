extends SceneTree
var ota: Node
func _initialize() -> void:
 call_deferred("_run")
func expect(ok: bool, message: String) -> bool:
 if not ok:
  push_error("EMPIRE_OTA_TEST_FAILED: "+message)
  quit(1)
  return false
 return true
func envelope(name: String) -> Dictionary:
 return JSON.parse_string(FileAccess.get_file_as_string("res://fixtures/"+name+".json"))
func stage(name: String, zip_name: String = "") -> bool:
 var copy := "user://empire-ota-v1/fixture.part"
 DirAccess.remove_absolute(copy)
 var source := "res://fixtures/"+(zip_name if not zip_name.is_empty() else name)+".zip"
 if DirAccess.copy_absolute(source,copy) != OK:
  return false
 return ota.stage_verified(envelope(name),copy)
func _run() -> void:
 ota = load("res://scripts/empire_ota.gd").new()
 root.add_child(ota)
 await process_frame
 var args := OS.get_cmdline_user_args()
 var phase := str(args[0]) if not args.is_empty() else ""
 if phase == "stage":
  if not expect(ota.validate_envelope(envelope("tampered")).is_empty(),"tampered signature"): return
  if not expect(ota.validate_envelope(envelope("wrong-channel")).is_empty(),"wrong channel"): return
  if not expect(ota.validate_envelope(envelope("wrong-runtime")).is_empty(),"wrong runtime"): return
  if not expect(not stage("protected"),"protected loader path accepted"): return
  if not expect(not stage("v1","v2"),"wrong pack bytes accepted"): return
  if not expect(stage("v1"),"signed delta rejected"): return
  if not expect(not stage("v1"),"replay accepted"): return
  if not expect(FileAccess.get_file_as_string("res://data/ota_fixture.json")=="embedded","mounted before cold launch"): return
 elif phase == "activate":
  if not expect(ota.mount_on_boot(),"valid delta mount"): return
  if not expect(FileAccess.get_file_as_string("res://data/ota_fixture.json")=="updated-v1","actual overlay resource not loaded"): return
  ota.confirm_boot()
  if not expect(ota.state.booting=="" and ota.state.pending.is_empty(),"activation receipt missing"): return
  if not expect(stage("v2"),"stage v2"): return
 elif phase == "interrupt":
  if not expect(ota.mount_on_boot(),"v2 mount"): return
  if not expect(FileAccess.get_file_as_string("res://data/ota_fixture.json")=="updated-v2","v2 content not loaded"): return
  # Exit before confirmation to emulate process interruption.
 elif phase == "recover":
  if not expect(ota.mount_on_boot(),"recovery mount"): return
  if not expect(FileAccess.get_file_as_string("res://data/ota_fixture.json")=="updated-v1","previous content not restored"): return
  ota.confirm_boot()
  if not expect(not stage("v2"),"replay after rollback"): return
  if not expect(stage("v3"),"stage newer v3"): return
 elif phase == "rollback":
  if not expect(ota.mount_on_boot(),"v3 mount"): return
  ota.confirm_boot()
  if not expect(FileAccess.get_file_as_string("res://data/ota_fixture.json")=="updated-v3","v3 content not loaded"): return
  ota.rollback()
 elif phase == "verify-rollback":
  if not expect(ota.mount_on_boot(),"explicit rollback mount"): return
  if not expect(FileAccess.get_file_as_string("res://data/ota_fixture.json")=="updated-v1","explicit rollback did not restore previous"): return
  ota.confirm_boot()
 else:
  expect(false,"unknown phase")
  return
 print("BUKLOD_EMPIRE_OTA_RUNTIME_TEST_PASS "+phase)
 quit(0)
