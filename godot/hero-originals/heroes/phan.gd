extends RefCounted
## PHAN: Earthforge Vanguard (Bruiser / Builder / Protector)
## Canonical kit: 1 passive, 2 active, 1 ultimate. Placeholder pa ang numbers (initial tuning).
## Cooldown targets: S1 8-12s, S2 12-18s, Ult 90-120s.

const DATA := {
	"name": "Phan",
	"title": "The Groundsmith",
	"role": "Bruiser/Builder",
	"element": "Earth",
	"hp": 1200,
	"speed": 200,

	"basic": {"dmg": 40, "range": 90, "cd": 0.8},

	# Land's Resolve: stacking DEF at HP regen habang nasa allied objective/structure
	"passive": {
		"id": "lands_resolve", "type": "objective_stacks",
		"max_stacks": 5, "def_per": 0.04, "regen_per": 4.0,
		"gain_every": 1.0, "decay_after": 3.0, "radius": 250.0
	},

	"skills": [
		# S1 Groundbreaker: area damage, slow 40% 2s, DEF -10% 4s
		{"id": "groundbreaker", "type": "strike_aoe", "cd": 8,
		 "dmg": 110, "radius": 140.0, "offset": 80.0,
		 "slow": 0.4, "slow_dur": 2.0, "def_down": 0.10, "def_dur": 4.0},
		# S2 Foundation Wall: harang 5s, HP = % ng max HP ni Phan
		{"id": "foundation_wall", "type": "wall", "cd": 12,
		 "dur": 5.0, "hp_pct": 0.25, "cast_range": 300.0},
	],

	# Ultimate Bayanihan Bastion: shield 20% max HP, 30% DR, regen, knockback sa gilid
	"ult": {"id": "bayanihan_bastion", "type": "bastion", "cd": 90,
		"dur": 8.0, "radius": 320.0, "shield_pct": 0.20, "dr": 0.30,
		"regen": 30.0, "knock": 120.0},

	# Suit progression (Lv 1-4, 5-8, 9-12, 13-16, 17-20), pangalan mula sa concept poster
	"suits": [
		"Starter Suit", "Evolved Suit", "Identity Suit", "Impact Suit", "Legacy Suit"
	],
}