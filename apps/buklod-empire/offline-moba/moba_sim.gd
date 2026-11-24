## Offline-only 5v5 adapter over the existing BUKLOD hero combat simulation.
## Never imports account state, writes a ledger, or settles online rewards.
extends "res://scripts/arena_simulation.gd"

const MATCH_LIMIT := 900.0
const SHOP := {"blade":{"cost":120,"bonus":7.0},"armor":{"cost":110,"bonus":0.12},"boots":{"cost":90,"bonus":0.18}}
const LANES := [0,1,1,2,2]

func start(hero: String, difficulty: String = "normal", seed: int = 20261124) -> bool:
	if not begin("classic_conquest",hero,"genesis_rift",false,"ace",difficulty,seed):
		return false
	# Classic MOBA is a separate practice ruleset; retain legacy Arena unchanged.
	state["units"].clear()
	state["buildings"].clear()
	state["nodes"].clear()
	state["hard_deadline"] = MATCH_LIMIT + 10000.0
	state["library_next_wave"] = 3.0
	state["library_wave_index"] = 0
	for team in ["A","B"]:
		var core := {"id":team+"-core","team":team,"kind":"tower","core":true,
			"pos":Vector2(14.0 if team=="A" else float(state["w"])-14.0,float(state["h"])*0.5),
			"hp":600.0,"max_hp":600.0,"level":1,"alive":true,"last_attack":-100000.0,"damage":18.0}
		state["towers"].append(core)
	for p in state["players"].values():
		p["gold"] = 120
		p["gear_local"] = []
		p["lane"] = LANES[int(str(p["id"]).substr(1))]
		p["level"] = 3 # Skill 2 is available at entry; ultimate unlocks at 6.
		p["max_hp"] = 160.0
		p["hp"] = 160.0
	return true

func _core_open(team: String) -> bool:
	return state["towers"].any(func(t):return t["team"]==team and not t.get("core",false) and not t.get("temporary",false) and not _alive(t))

func _enemies(p: Dictionary, r: float) -> Array:
	return super._enemies(p,r).filter(func(t):return not t.get("core",false) or _core_open(str(t["team"])))

func _hit(p: Dictionary, target: Dictionary, damage: float) -> bool:
	if state["status"]!="active":
		return false
	if target.get("core",false) and not _core_open(str(target["team"])):
		return false
	var alive_before := _alive(target)
	var gear: Array = p.get("gear_local",[])
	if "blade" in gear:
		damage += float(SHOP.blade.bonus)
	if "armor" in target.get("gear_local",[]):
		damage *= 1.0-float(SHOP.armor.bonus)
	var hit := super._hit(p,target,damage)
	if hit and alive_before and not _alive(target):
		if p.get("kind")=="hero":
			p["gold"] = mini(9999,int(p.get("gold",0))+(75 if target.get("kind")=="hero" else 45 if target.get("kind")=="tower" else 22))
		if target.get("core",false) and state["status"]=="active":
			_finish(str(p["team"]),"core_destroyed")
	return hit

func _finish(winner: String, reason: String) -> void:
	if state["status"]!="active":
		return
	state["status"]="finished" if winner!="" else "void"
	state["winner"]=winner
	_log("moba_result",{"winner":winner,"reason":reason})

func _move(p: Dictionary, delta: Vector2, speed: float) -> bool:
	# Preserve existing collision and skill implementation. Boots only affect
	# ordinary movement, not dashes/teleports.
	if speed < 10.0 and "boots" in p.get("gear_local",[]):
		speed *= 1.0+float(SHOP.boots.bonus)
	return super._move(p,delta,speed)

func buy(id: String, item: String) -> bool:
	var p := actor(id)
	if state["status"]!="active" or not _alive(p) or p.get("kind")!="hero" or not SHOP.has(item):
		return false
	if item in p["gear_local"] or p["gear_local"].size()>=3:
		return false
	if (p["pos"] as Vector2).distance_to(p["spawn"] as Vector2)>12.0:
		return false
	var price := int(SHOP[item]["cost"])
	if int(p["gold"])<price:
		return false
	p["gold"]-=price
	p["gear_local"].append(item)
	_log("moba_purchase",{"actor":id,"item":item})
	return true

func _bots() -> void:
	# Existing advance calls this every 0.4 s. Lane-aware targets and a
	# defensive retreat replace the old all-bots-chase-A0 behavior.
	var delay: float = {"easy":0.8,"normal":0.6,"hard":0.4}[state["difficulty"]]
	for p in state["players"].values():
		if p["id"]=="A0" or not _alive(p):
			continue
		var pos: Vector2 = p["pos"]
		var home: Vector2 = p["spawn"]
		var retreat: bool = float(p["hp"])/float(p["max_hp"])<0.30
		var enemies := _enemies(p,14.0)
		var target: Dictionary = enemies.front() if not enemies.is_empty() else {}
		var enemy_team := _other(str(p["team"]))
		var lane: int = int(p["lane"])
		var lane_y: float = float(state["h"])*float(config["maps"][state["map"]]["lanes"][lane])
		var goal := Vector2(float(state["w"])-14.0 if p["team"]=="A" else 14.0,lane_y)
		if absf(pos.y-lane_y)>4.0 and absf(pos.x-home.x)<24.0:
			goal=Vector2(pos.x,lane_y)
		if retreat:
			goal=home
		elif not target.is_empty():
			goal=target["pos"]
		elif _core_open(enemy_team) and not _alive(actor(enemy_team+"-tower-"+str(lane))):
			goal=actor(enemy_team+"-core")["pos"]
		var offset := goal-pos
		var basic: Dictionary = config["starter"].get(p["hero"],{}).get("basic",{})
		var reach := float(basic.get("range",5.5))
		# A lane waypoint is not a combat target. Using attack range to stop at
		# the waypoint stranded ranged heroes a few units from their spawn lane.
		var arrival: float = maxf(1.5,reach*0.82) if not target.is_empty() and not retreat else 1.0
		for i in range(4):
			var step_offset: Vector2 = goal-(p["pos"] as Vector2)
			if step_offset.length()<=arrival:
				break
			if not _move(p,step_offset,6.0):
				if not _move(p,step_offset.rotated(0.85),6.0):
					_move(p,step_offset.rotated(-0.85),6.0)
		if retreat:
			if pos.distance_to(home)<12.0:
				p["hp"]=minf(float(p["max_hp"]),float(p["hp"])+3.0)
			continue
		if float(state["time"])-float(p["bot_at"])<delay:
			continue
		p["bot_at"]=state["time"]
		if not target.is_empty():
			action(p["id"],"attack",offset,target["id"])
			if rng.randf()<0.48:
				action(p["id"],"primary",offset,target["id"])
			if int(p["level"])>=6 and rng.randf()<0.12:
				action(p["id"],"ultimate",offset,target["id"])
		if pos.distance_to(home)<12.0:
			for item in SHOP:
				buy(str(p["id"]),item)

func advance() -> void:
	if state.is_empty() or state["status"]!="active":
		return
	super.advance()
	if state["status"]!="active":
		return
	var now: float = state["time"]
	for p in state["players"].values():
		if not _alive(p):
			continue
		# Match-only passive income and experience; never persistent BP.
		if int(state["tick"])%10==0:
			p["gold"]=mini(9999,int(p["gold"])+2)
			_xp(p,3.0)
		if (p["pos"] as Vector2).distance_to(p["spawn"] as Vector2)<10.0:
			p["hp"]=minf(float(p["max_hp"]),float(p["hp"])+0.8)
			p["mana"]=minf(float(p["max_mana"]),float(p["mana"])+0.8)
	if now>=MATCH_LIMIT:
		var a: float = float(actor("A-core")["hp"])
		var b: float = float(actor("B-core")["hp"])
		_finish("A" if a>b else "B" if b>a else "","time_limit")
