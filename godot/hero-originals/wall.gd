class_name Wall
extends StaticBody2D
## Foundation Wall: humaharang sa galaw, may sariling HP, nawawala pagkatapos ng `life`.

var team := "team_a"
var hp := 300.0
var life := 5.0

const SIZE := Vector2(160.0, 24.0)


func _ready() -> void:
	add_to_group("wall_" + team)
	var c := CollisionShape2D.new()
	var r := RectangleShape2D.new()
	r.size = SIZE
	c.shape = r
	add_child(c)
	get_tree().create_timer(life).timeout.connect(queue_free)


func take_damage(amount: float, _source: Node = null) -> void:
	hp -= amount
	queue_redraw()
	if hp <= 0.0:
		queue_free()


func _draw() -> void:
	draw_rect(Rect2(-SIZE / 2.0, SIZE), Color(0.55, 0.38, 0.2))
	draw_rect(Rect2(-SIZE / 2.0, SIZE), Color(1, 1, 1, 0.6), false, 2.0)