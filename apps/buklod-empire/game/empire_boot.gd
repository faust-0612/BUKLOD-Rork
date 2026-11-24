## Immutable bootstrap delegates to persistent autoload; scene swap must not
## free the coroutine before it records engine readiness.
extends Node
func _ready() -> void:
 get_node("/root/EmpireOta").call_deferred("boot_into_menu")
