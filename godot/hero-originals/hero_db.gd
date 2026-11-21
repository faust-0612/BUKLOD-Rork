extends Node
## Autoload: Project Settings > Globals > Autoload > pangalan: HeroDB
## Dito nirerehistro ang bawat hero. Isang linya lang bawat bagong hero.

const Phan := preload("res://heroes/phan.gd")
const Quin := preload("res://heroes/quin.gd")

var heroes: Dictionary = {}


func _ready() -> void:
	heroes["phan"] = Phan.DATA
	heroes["quin"] = Quin.DATA
	# heroes["van"] = preload("res://heroes/van.gd").DATA   # susunod


func get_hero(id: String) -> Dictionary:
	assert(heroes.has(id), "Hindi rehistrado ang hero: " + id)
	return heroes[id]