## Invoke with Godot 4.7.2: godot --headless --path godot/empire-arena -s res://tests/premium_smoke.gd
extends SceneTree

func _initialize() -> void:
	call_deferred("_verify")

func _verify() -> void:
	var animator = load("res://scripts/hero_animation.gd").new()
	var at := Vector2(10, 20)
	var idle: Dictionary = animator.sample("A0", at, 1.0)
	if idle["pose"] != "idle":
		push_error("Hero must start idle")
		quit(1)
		return
	var walking: Dictionary = animator.sample("A0", at + Vector2(5, 0), 1.02)
	if walking["pose"] != "walk":
		push_error("Movement must enter walk pose")
		quit(2)
		return
	animator.handle_event({"type": "skill", "actor": "A0"}, 1.1)
	if animator.sample("A0", at, 1.2)["pose"] != "skill":
		push_error("Skill event must override walk animation")
		quit(3)
		return
	var settled: Dictionary = animator.sample("A0", at, 2.0)
	if settled["pose"] != "idle" or int(settled["frame"]) < 0 or int(settled["frame"]) >= 8:
		push_error("Idle state and atlas frame must recover safely")
		quit(4)
		return
	var fx = load("res://scripts/arena_effects.gd").new()
	get_root().add_child(fx)
	fx.play_event("skill", Vector2.ZERO)
	if fx.active.size() != 1:
		push_error("Impact shader sprite must instantiate")
		quit(5)
		return
	for i in range(80):
		fx.play_event("damage", Vector2(i, 0))
	if fx.active.size() > fx.LIMIT:
		push_error("Combat effects exceed cap")
		quit(6)
		return
	fx.clear()
	if not fx.active.is_empty():
		push_error("Arena effect cleanup failed")
		quit(7)
		return
	print("BUKLOD_GODOT_PREMIUM_SMOKE_PASS: animations / GPU impact shader / effect cap")
	quit(0)
