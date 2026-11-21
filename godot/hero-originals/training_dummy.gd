extends Node2D
## Pangsubok ng skills. Ilagay sa scene bilang Node2D. Walang apply_mod kaya hindi tinatablan ng slow/DEF debuff.

@export var team := "team_b"
var max_hp := 3000.0
var hp := 3000.0


func _ready() -> void:
	add_to_group(team)


func take_damage(amount: float, _source: Node = null) -> void:
	hp -= amount
	if hp <= 0.0:
		hp = max_hp   # respawn agad para tuloy ang testing
	queue_redraw()


func _draw() -> void:
	draw_circle(Vector2.ZERO, 20.0, Color(0.9, 0.3, 0.3))
	var ratio := clampf(hp / max_hp, 0.0, 1.0)
	draw_rect(Rect2(-24, -34, 48, 6), Color(0.2, 0.2, 0.2))
	draw_rect(Rect2(-24, -34, 48 * ratio, 6), Color(0.3, 0.9, 0.3))