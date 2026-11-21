## Direct native Godot hero contract, bound to the owner's 13-hero design
## and six ORIGINAL .gd identity files. No React Native conversion or ranked trust.
extends RefCounted

const ORIGINAL := {
	"phan": preload("res://hero-originals/heroes/phan.gd"),
	"quin": preload("res://hero-originals/heroes/quin.gd"),
	"van": preload("res://hero-originals/heroes/van.gd"),
	"christian": preload("res://hero-originals/heroes/christian.gd"),
	"lhen": preload("res://hero-originals/heroes/lhen.gd"),
	"ace": preload("res://hero-originals/heroes/ace.gd")
}
const EXTRA_HEROES := ["ellusur", "jawo", "mitch", "niel", "angel", "vhen", "trudice"]
const HERO_SOURCE := "res://data/owner-13-hero-design-v1.json"
const SKILL_KEYS := {"primary": "s1", "secondary": "s2", "ultimate": "ultimate"}
const COOLDOWN_MS := {"primary": 9000, "secondary": 15000, "ultimate": 100000}
const SPECIAL_IDS := {
	"ellusur": ["guiding_path", "seed_sanctuary", "beacon_of_service"],
	"jawo": ["vine_riff", "echo_skip", "canopy_crescendo"],
	"mitch": ["pigment_bolt", "mosaic_wall", "living_canvas"],
	"niel": ["echo_lance", "conviction_dash", "call_of_the_dawn"],
	"angel": ["ledger_shield", "balance_field", "equal_measure"],
	"vhen": ["seed_turret", "irrigation_snare", "harvest_engine"],
	"trudice": ["question_sigil", "turning_page", "grand_lesson"]
}

var approved: Dictionary = {}

func _init() -> void:
	var file := FileAccess.open(HERO_SOURCE, FileAccess.READ)
	if file == null:
		push_error("Missing user-approved BUKLOD 13-hero identity contract")
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY or not parsed.has("heroes"):
		push_error("Invalid BUKLOD owner hero contract")
		return
	for hero in parsed["heroes"]:
		if typeof(hero) != TYPE_DICTIONARY or not hero.has("id"):
			continue
		var key: String = str(hero["id"])
		if not approved.has(key):
			approved[key] = hero

func available() -> bool:
	if approved.size() != 13 or ORIGINAL.size() != 6 or SPECIAL_IDS.size() != 7:
		return false
	for hero in EXTRA_HEROES:
		if not approved.has(hero) or not SPECIAL_IDS.has(hero):
			return false
		var design: Dictionary = approved[hero]
		if not design.has("passive"):
			return false
		for key in ["s1", "s2", "ultimate"]:
			if not design.has(key) or str(design[key]).is_empty():
				return false
	for key in ORIGINAL:
		if not approved.has(key):
			return false
		var info: Dictionary = ORIGINAL[key].DATA
		if info["skills"].size() != 2 or not info.has("ult") or not info.has("passive"):
			return false
	return true

func skill(hero: String, slot: String) -> Dictionary:
	if not SKILL_KEYS.has(slot) or not approved.has(hero):
		return {}
	if ORIGINAL.has(hero):
		# Use the ORIGINAL Godot skill definitions directly, including approved
		# identity and cooldown. Only match HP/damage remain normalized.
		var original: Dictionary = ORIGINAL[hero].DATA
		var record: Dictionary = original["ult"] if slot == "ultimate" else original["skills"][0 if slot == "primary" else 1]
		return {"id": str(record["id"]), "cd": int(round(float(record["cd"]) * 1000.0)),
			"identity": str(approved[hero]["identity"])}
	var ids: Array = SPECIAL_IDS.get(hero, [])
	if ids.size() != 3:
		return {}
	var index: int = ["primary", "secondary", "ultimate"].find(slot)
	var description: String = str(approved[hero][SKILL_KEYS[slot]])
	var readable: String = description.get_slice(":", 0).to_snake_case().replace(" ", "_")
	if readable != str(ids[index]):
		# Prevent disconnected placeholder skills with the wrong visual identity.
		push_error("Hero skill name changed without matching Godot action: " + hero + "/" + slot)
		return {}
	return {"id": str(ids[index]), "cd": int(COOLDOWN_MS[slot]),
		"identity": str(approved[hero]["identity"])}

func display(hero: String) -> Dictionary:
	return approved.get(hero, {})
