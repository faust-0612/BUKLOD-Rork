extends RefCounted
## CHRISTIAN: Crimson Marshal (Fighter / Commander / Rally Leader). Placeholder pa ang numbers.

const DATA := {
	"name": "Christian",
	"title": "The Crimson Marshal",
	"role": "Fighter/Commander",
	"element": "Valor/Fire",
	"hp": 1050,
	"speed": 210,

	"basic": {"dmg": 60, "range": 100.0, "cd": 0.8},

	# Command Presence: +25% objective progress ng kalapit na kakampi at 1% HP/s sa rally area
	"passive": {
		"id": "command_presence", "type": "aura",
		"radius": 350.0, "obj": 0.25, "regen_pct": 0.01
	},

	"skills": [
		# S1 Banner Rush: charge, damage, knock-up 0.6s, rally banner (+25% speed, 4s)
		{"id": "banner_rush", "type": "charge_strike", "cd": 8,
		 "cast_range": 350.0, "dmg": 100, "radius": 130.0, "knockup": 0.6,
		 "banner_radius": 300.0, "banner_speed": 0.25, "banner_dur": 4.0},
		# S2 Rally Formation: +20% attack, 15% damage reduction, control resistance, 6s
		{"id": "rally_formation", "type": "team_buff", "cd": 12,
		 "radius": 350.0, "dur": 6.0, "atk": 0.20, "dr": 0.15, "resist": 0.30},
	],

	# Ultimate Stand United: +35% damage, 25% DR, immunity sa susunod na control effect, hanggang +50% objective progress, 8s
	"ult": {"id": "stand_united", "type": "team_buff", "cd": 90,
		"radius": 500.0, "dur": 8.0, "atk": 0.35, "dr": 0.25, "cc_block": true, "obj": 0.50},

	"suits": ["Starter Suit", "Evolved Suit", "Identity Suit", "Impact Suit", "Legacy Suit"],
}