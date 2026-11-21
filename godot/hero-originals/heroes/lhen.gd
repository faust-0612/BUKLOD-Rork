extends RefCounted
## LHEN: Harmony Weaver (Healer / Sonic Support). Placeholder pa ang numbers.

const DATA := {
	"name": "Lhen",
	"title": "The Harmony Weaver",
	"role": "Healer/Sonic Support",
	"element": "Sound/Harmony",
	"hp": 900,
	"speed": 220,

	"basic": {"dmg": 40, "range": 400.0, "cd": 0.8, "ranged": true, "width": 22.0},

	# Harmony Weaver: stacks mula sa heal/buff at pagiging malapit sa kakampi.
	# Sa max stacks, ang susunod na support skill ay enhanced (mas malakas na heal, mas mahabang buff, mas malawak na area)
	"passive": {
		"id": "harmony_weaver", "type": "harmony_stacks",
		"max_stacks": 5, "near_radius": 300.0, "near_every": 2.0,
		"enhance": {"heal": 0.40, "dur": 0.50, "area": 0.25}
	},

	"skills": [
		# S1 Resonance Wave: sonic wave pasulong; heal sa kakampi, damage + 20% slow (2.5s) sa kalaban
		{"id": "resonance_wave", "type": "wave", "cd": 8,
		 "length": 420.0, "width": 70.0, "heal": 90, "dmg": 70, "slow": 0.20, "slow_dur": 2.5},
		# S2 Restorative Beat: pulse sa paligid ni Lhen, tuloy-tuloy na heal 4s, tanggal ng 1 debuff, regen (40% strength)
		{"id": "restorative_beat", "type": "pulse_heal", "cd": 12,
		 "radius": 260.0, "dur": 4.0, "heal_ps": 45, "cleanse": 1, "regen_strength": 0.4},
	],

	# Ultimate Symphony of Buklod: wide heal, 20% max HP shield 8s, cleanse, +15% damage at +15% speed
	"ult": {"id": "symphony_of_buklod", "type": "team_buff", "cd": 90,
		"radius": 550.0, "dur": 8.0, "heal": 350, "shield_pct": 0.20, "cleanse": true,
		"atk": 0.15, "speed": 0.15},

	"suits": ["Starter Suit", "Evolved Suit", "Identity Suit", "Impact Suit", "Legacy Suit"],
}