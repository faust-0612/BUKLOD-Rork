## Offline-only 5v5 adapter over the existing BUKLOD hero combat simulation.
## Never imports account state, writes a ledger, or settles online rewards.
extends "res://scripts/arena_simulation.gd"

const MATCH_LIMIT := 900.0
const SHOP := {"blade":{"cost":120,"bonus":7.0},"armor":{"cost":110,"bonus":0.12},"boots":{"cost":90,"bonus":0.18}}
const LANES := [0,1,1,2,2]
const DIRECTIONAL := ["beacon_mark","pigment_bolt","echo_lance","question_sigil"]
var cast_actor := ""
var cast_direction := Vector2.ZERO

func _aim_candidates(p: Dictionary, candidates: Array, direction: Vector2) -> Array:
	if direction.length_squared()<0.01:
		return candidates
	var facing := direction.normalized()
	var result := candidates.filter(func(t):
		var d: Vector2 = (t["pos"] as Vector2)-(p["pos"] as Vector2)
		return d.length_squared()<0.001 or facing.dot(d.normalized())>=0.72)
	result.sort_custom(func(a,b):
		var da: Vector2 = (a["pos"] as Vector2)-(p["pos"] as Vector2)
		var db: Vector2 = (b["pos"] as Vector2)-(p["pos"] as Vector2)
		return facing.dot(da.normalized())*8.0-da.length()>facing.dot(db.normalized())*8.0-db.length())
	return result

func aim_target(p: Dictionary, radius: float, direction: Vector2=Vector2.ZERO) -> Dictionary:
	var options := _aim_candidates(p,_enemies(p,radius),direction)
	return options.front() if not options.is_empty() else {}

func cast_aimed(id: String, slot: String, direction: Vector2, manual: bool) -> bool:
	var p := actor(id)
	if not _alive(p):
		return false
	var skill: Dictionary = config["starter"].get(p["hero"],{}).get(slot,{})
	var skill_id := str(skill.get("id",""))
	if manual and direction.length_squared()>0.01 and skill_id in DIRECTIONAL:
		cast_actor=id
		cast_direction=direction.normalized()
	var accepted := action(id,slot,direction)
	cast_actor=""
	cast_direction=Vector2.ZERO
	return accepted

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
	cast_actor=""
	cast_direction=Vector2.ZERO
	for team in ["A","B"]:
		var core := {"id":team+"-core","team":team,"kind":"tower","core":true,
			"pos":Vector2(14.0 if team=="A" else float(state["w"])-14.0,float(state["h"])*0.5),
			"hp":600.0,"max_hp":600.0,"level":1,"alive":true,"last_attack":-100000.0,"damage":18.0}
		state["towers"].append(core)
	for tower in state["towers"]:
		tower["buffs"]={}
	for p in state["players"].values():
		p["gold"] = 120
		p["gear_local"] = []
		p["lane"] = LANES[int(str(p["id"]).substr(1))]
		p["bot_retreat"]=false
		p["bot_intent"]="lane"
		p["level"] = 3 # Skill 2 is available at entry; ultimate unlocks at 6.
		p["max_hp"] = 160.0
		p["hp"] = 160.0
	return true

func _core_open(team: String) -> bool:
	return state["towers"].any(func(t):return t["team"]==team and not t.get("core",false) and not t.get("temporary",false) and not _alive(t))

func _enemies(p: Dictionary, r: float) -> Array:
	var targets := super._enemies(p,r).filter(func(t):return not t.get("core",false) or _core_open(str(t["team"])))
	if cast_actor!="" and p["id"]==cast_actor:
		return _aim_candidates(p,targets,cast_direction)
	return targets

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
		var health := float(p["hp"])/float(p["max_hp"])
		var retreat: bool = health<0.30 or (p.get("bot_retreat",false) and health<0.78)
		p["bot_retreat"]=retreat
		var enemies := _enemies(p,18.0)
		var target: Dictionary = _bot_target(p,enemies)
		p["bot_intent"]="retreat" if retreat else "engage" if not target.is_empty() else "lane"
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
		if not retreat and target.get("kind")=="tower" and float(target["hp"])>80.0:
			var support: bool=state["units"].any(func(u):return _alive(u) and u["team"]==p["team"] and u.get("library_minion",false) and _dist(u,target)<12.0)
			if not support and _dist(p,target)<11.0:
				goal=pos+(pos-(target["pos"] as Vector2)).normalized()*4.0
				target={}
				p["bot_intent"]="regroup"
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
			var direction: Vector2=(target["pos"] as Vector2)-(p["pos"] as Vector2)
			action(p["id"],"attack",direction,target["id"])
			var nearby := _enemies(p,8.0)
			var wounded: bool=_allies(p,9.0).any(func(friend):return float(friend["hp"])/float(friend["max_hp"])<0.62)
			var role := str(config["heroes"][p["hero"]]["style"])
			if (role in ["heal","guard","supply"] and wounded) or rng.randf()<0.48:
				action(p["id"],"primary",direction,target["id"])
			if int(p["level"])>=3 and (nearby.size()>=2 or wounded):
				action(p["id"],"secondary",direction,target["id"])
			if int(p["level"])>=6 and (nearby.size()>=3 or (wounded and role in ["heal","guard","supply"])):
				action(p["id"],"ultimate",direction,target["id"])
		if pos.distance_to(home)<12.0:
			for item in SHOP:
				buy(str(p["id"]),item)

func _bot_target(p: Dictionary, candidates: Array) -> Dictionary:
	if candidates.is_empty():return {}
	var best: Dictionary={}
	var score := -INF
	for t in candidates:
		var distance := _dist(p,t)
		var hp_ratio := float(t["hp"])/maxf(1.0,float(t.get("max_hp",t["hp"])))
		var value := 18.0-distance+(1.0-hp_ratio)*7.0
		if t["kind"]=="hero":value+=3.5
		elif t.get("core",false):value+=9.0
		elif t["kind"]=="tower":value+=2.0
		if value>score:
			score=value
			best=t
	return best

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
