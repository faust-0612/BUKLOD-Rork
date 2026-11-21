extends RefCounted
## ACE: Triage Grandmaster (Medic / Tactician). Special hero (Circle Rank 5).
## Placeholder pa ang numbers. Ang rank unlock gating ay HINDI nasa code na ito.

const DATA := {
	"name": "Ace",
	"title": "The Triage Grandmaster",
	"role": "Medic/Tactician",
	"element": "Life/Heal",
	"hp": 900,
	"speed": 210,
	"unlock_rank": 5,

	"basic": {"dmg": 35, "range": 380.0, "cd": 0.8, "ranged": true, "width": 20.0},

	# Critical Care: ang kakampi na na-heal o na-rescue ni Ace ay may 10-20% DEF/DR sa loob ng 4s (scales sa level)
	"passive": {
		"id": "critical_care", "type": "critical_care",
		"dr_min": 0.10, "dr_max": 0.20, "dur": 4.0
	},

	"skills": [
		# S1 Field Patch: instant heal sa target na kakampi + regen 5s
		{"id": "field_patch", "type": "heal_target", "cd": 8,
		 "cast_range": 400.0, "heal": 120, "regen_ps": 15.0, "regen_dur": 5.0},
		# S2 Knight Step: dash sa kakampi, tanggal ng 1 control effect, heal, +30% speed 3s
		{"id": "knight_step", "type": "dash_to_ally", "cd": 12,
		 "cast_range": 450.0, "heal": 80, "speed": 0.30, "speed_dur": 3.0},
	],

	# Ultimate Checkmate Rescue: Triage Zone 10s, tuloy-tuloy na heal, 20% max HP shield,
	# auto-revive ng unang downed na kakampi sa area (50% HP)
	"ult": {"id": "checkmate_rescue", "type": "triage_zone", "cd": 90,
		"radius": 350.0, "dur": 10.0, "heal_ps": 40, "shield_pct": 0.20,
		"revives": 1, "revive_pct": 0.5},

	"suits": ["Triage Suit", "Rescue Suit", "Command Suit", "Grandmaster Suit", "Checkmate Suit"],
}