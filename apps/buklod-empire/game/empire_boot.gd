## Immutable bootstrap, loads no gameplay resource before verified mount.
extends Node
func _ready() -> void:
 call_deferred("_start")
func _start() -> void:
 var ota := get_node("/root/EmpireOta")
 if not ota.mount_on_boot():
  var label := Label.new()
  label.text = "Update recovery saved. Close and reopen Empire."
  label.position = Vector2(48,48)
  label.add_theme_font_size_override("font_size",24)
  add_child(label)
  var exit_button := Button.new()
  exit_button.text = "EXIT EMPIRE"
  exit_button.position = Vector2(48,110)
  exit_button.pressed.connect(func() -> void: get_tree().quit())
  add_child(exit_button)
  return
 var scene: PackedScene = load("res://scenes/EmpireMenu.tscn")
 if scene == null or get_tree().change_scene_to_packed(scene) != OK:
  ota.fail_current("Menu load failed")
  return
 await get_tree().scene_changed
 await get_tree().process_frame
 if DisplayServer.get_name() != "headless":
  await RenderingServer.frame_post_draw
 if get_tree().current_scene == null or get_tree().current_scene.name != "EmpireMenu":
  ota.fail_current("Menu readiness failed")
  return
 ota.confirm_boot()
