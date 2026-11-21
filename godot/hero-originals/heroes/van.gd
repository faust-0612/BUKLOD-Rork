extends RefCounted
## VAN: Relay Warden (Tank / Bodyguard / Defender). Placeholder pa ang numbers.
## Susunod sa canonical kit: 1 passive, 2 active, 1 ultimate (walang "Relay Beacon" mula sa lumang poster).

const DATA := {
	"name": "Van",
	"title": "The Relay Warden",
	"role": "Tank/Bodyguard",
	"element": "Energy/Signal",
	"hp": 1300,
	"speed": 210,

	"basic": {"dmg": 35, "range": 80.0, "cd": 0.9},

	# Protective Link: kapag may kakampi sa malapit, pareho silang may DR (8-15%, scales sa level) at shared HP regen
	"passive": {
		"id": "protective_link", "type": "link",
		"radius": 300.0, "dr_min": 0.08, "dr_max": 0.15, "regen": 3.0
	},

	"skills": [
		# S1 Signal Shield: durable shield sa kakampi o sarili, 5s (HP scale)
		{"id": "signal_shield", "type": "shield_target", "cd": 8,
		 "cast_range": 350.0, "shield_pct": 0.20, "dur": 5.0},
		# S2 Intercept Rush: dash, taunt 2.5s, -30% damage ng kalaban laban sa ibang kakampi, may knockback
		{"id": "intercept_rush", "type": "intercept_rush", "cd": 12,
		 "cast_range": 350.0, "radius": 160.0, "taunt_dur": 2.5, "dmg_down": 0.30, "knock": 60.0},
	],

	# Ultimate Command Network: shared shield (30% max HP), cleanse CC, -35% damage taken, 10s
	"ult": {"id": "command_network", "type": "team_buff", "cd": 90,
		"radius": 450.0, "dur": 10.0, "shield_pct": 0.30, "cleanse": true, "dr": 0.35},

	"suits": ["Dispatch Suit", "Relay Suit", "Warden Suit", "Command Suit", "Sentinel Suit"],
}