## Standalone game navigation. No user ledger or reward mutations.
extends Node
const ROUTES := {
 "arena":"res://scenes/Arena.tscn",
 "kingdom":"res://scenes/WorldPreview.tscn",
 "house":"res://scenes/WorldPreview.tscn",
 "community":"res://scenes/WorldPreview.tscn"
}
var world_id: String = "kingdom"
var transitioning := false
func _ready() -> void:
 # Android back is owned by this session; the engine default quits the process.
 get_tree().quit_on_go_back = false
func enter_world(world: String) -> void:
 if transitioning or not ROUTES.has(world):
  return
 transitioning = true
 world_id = world
 var result := get_tree().change_scene_to_file(ROUTES[world])
 if result != OK:
  transitioning = false
  push_error("EMPIRE_SCENE_LOAD_FAILED: "+world)
  get_node("/root/EmpireOta").fail_current("World readiness failed")
  return
 await get_tree().scene_changed
 await get_tree().process_frame
 var scene := get_tree().current_scene
 if scene == null:
  transitioning = false
  push_error("EMPIRE_SCENE_MISSING")
  get_node("/root/EmpireOta").fail_current("World readiness failed")
  return
 if world == "arena":
  var sim: Variant = scene.get("sim")
  if sim == null or not sim.available():
   transitioning = false
   push_error("EMPIRE_ARENA_CATALOG_FAILED")
   get_node("/root/EmpireOta").fail_current("World readiness failed")
   return
 else:
  var explorer := scene.get_node_or_null("InteractiveVisuals")
  if explorer == null or scene.get("image_texture") == null or str(scene.get("world_id")) != world:
   transitioning = false
   push_error("EMPIRE_WORLD_VISUAL_FAILED: "+world)
   get_node("/root/EmpireOta").fail_current("World readiness failed")
   return
  var avatar: Variant = explorer.get("avatar")
  if avatar == null or avatar.texture == null:
   transitioning = false
   push_error("EMPIRE_WORLD_AVATAR_FAILED: "+world)
   get_node("/root/EmpireOta").fail_current("World readiness failed")
   return
 if DisplayServer.get_name() != "headless":
  await RenderingServer.frame_post_draw
 print("BUKLOD_EMPIRE_WORLD_RENDERED: "+world)
 transitioning = false
func return_to_menu() -> void:
 if transitioning:
  return
 transitioning = true
 if get_tree().change_scene_to_file("res://scenes/EmpireMenu.tscn") != OK:
  transitioning = false
  return
 await get_tree().scene_changed
 transitioning = false
func _notification(what: int) -> void:
 if what == NOTIFICATION_WM_GO_BACK_REQUEST:
  var scene := get_tree().current_scene
  if scene != null and scene.name != "EmpireMenu":
   call_deferred("return_to_menu")
  else:
   get_tree().quit()
