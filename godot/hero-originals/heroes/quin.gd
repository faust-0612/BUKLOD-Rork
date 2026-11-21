extends RefCounted
## QUIN: Horizon Wayfinder (Ranger / Scout / Pathfinder)
## Canonical kit: 1 passive, 2 active, 1 ultimate. Placeholder pa ang numbers (initial tuning).
## Ang "Horizon Shot" sa concept poster ay hindi canonical kaya wala rito.

const DATA := {
	"name": "Quin",
	"title": "The Wayfinder",
	"role": "Ranger/Scout",
	"element": "Air/Light",
	"hp": 850,
	"speed": 240,

	# Bow: hit sa unang kalaban sa linya ng aim
	"basic": {"dmg": 55, "range": 520.0, "cd": 0.7, "ranged": true, "width": 18.0},

	# Trail Sense: pag nakapinsala ng kalaban, reveal ng galaw, traps, objectives sa loob ng 4s (8s internal CD)
	"passive": {
		"id": "trail_sense", "type": "reveal_on_hit",
		"radius": 500.0, "dur": 4.0, "cd": 8.0
	},

	"skills": [
		# S1 Route Dash: dumadaan sa maliliit na hadlang, +30% speed 3s
		{"id": "route_dash", "type": "dash", "cd": 8,
		 "dist": 220.0, "through": true, "speed_buff": 0.30, "speed_dur": 3.0},
		# S2 Beacon Mark: reveal at +15% damage taken sa loob ng 5s
		{"id": "beacon_mark", "type": "mark_area", "cd": 12,
		 "cast_range": 450.0, "radius": 120.0, "dur": 5.0, "dmg_taken": 0.15},
	],

	# Ultimate Horizon Corridor: team speed +50%, wide reveal, +15% evasion sa 8s
	"ult": {"id": "horizon_corridor", "type": "corridor", "cd": 90,
		"dur": 8.0, "radius": 500.0, "reveal_radius": 900.0,
		"speed": 0.50, "evade": 0.15},

	# Suit progression (Lv 1-4, 5-8, 9-12, 13-16, 17-20), pangalan mula sa concept poster
	"suits": [
		"Scout Suit", "Explorer Suit", "Ranger Suit", "Wayfinder Suit", "Genesis Suit"
	],
}