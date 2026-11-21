class_name Hero
extends CharacterBody2D
## BUKLOD generic hero (Godot 4). Lahat ng hero ay gumagamit ng script na ito;
## ang pagkakaiba nila ay nasa data (heroes/*.gd), hindi sa code.
## Slots: 0 = Skill 1, 1 = Skill 2, 2 = Ultimate. May basic attack at 1 passive.

signal hp_changed(hp: float, max_hp: float)
signal skill_cast(skill_id: String)
signal died(hero: Hero)

# Caps para walang infinite healing / invulnerability combo
const DEF_CAP := 0.75
const CDR_CAP := 0.40
const STUN_CAP := 2.0
const SHIELD_CAP_PCT := 0.5
const EVADE_CAP := 0.30      # deterministic (accumulator), hindi random
const OBJ_CAP := 0.50        # max +50% objective progress
const SUPPORT_TYPES := ["wave", "pulse_heal", "team_buff", "heal_area", "heal_target"]

@export var hero_id: String = "phan"
@export var team: String = "team_a"
@export var level: int = 1
@export var use_keyboard: bool = true   # false = touch UI ang magpapagalaw (set_move / set_aim)

var data: Dictionary = {}
var hp: float = 1.0
var max_hp: float = 1.0
var shield: float = 0.0
var dr: float = 0.0            # flat damage reduction (timed, via add_dr)
var stacks: int = 0            # passive stacks
var stun_t: float = 0.0
var regen_ps: float = 0.0
var move_input := Vector2.ZERO
var aim_dir := Vector2.RIGHT
var cooldowns: Dictionary = {}
var stats := {"speed": 0.0, "atk": 0.0, "def": 0.0, "cdr": 0.0,
	"evade": 0.0, "obj": 0.0, "resist": 0.0}

# CC immunity (susunod na control effect)
var cc_block := false
var cc_block_until := 0

# Revive zone (Ace ultimate)
var zone_pos := Vector2.ZERO
var zone_radius := 0.0
var zone_until := 0
var zone_revives := 0
var zone_revive_pct := 0.5

var _handlers: Dictionary = {}
var _auras: Dictionary = {}     # non-stacking, nare-refresh na buffs (link, banner, ...)
var _debuffs: Dictionary = {}   # negative mods na puwedeng i-cleanse
var _mod_id := 0
var _stack_timer := 0.0
var _decay_timer := 0.0
var _evade_acc := 0.0
var _passive_cd := 0.0
var _pulse_t := 0.0
var _enhance_pending := false


func _ready() -> void:
	motion_mode = CharacterBody2D.MOTION_MODE_FLOATING   # top-down, walang gravity/slope
	data = HeroDB.get_hero(hero_id)
	max_hp = float(data.hp)
	hp = max_hp
	add_to_group(team)
	add_to_group("heroes")
	_register_handlers()
	if get_node_or_null("CollisionShape2D") == null:
		var c := CollisionShape2D.new()
		var circle := CircleShape2D.new()
		circle.radius = 18.0
		c.shape = circle
		c.name = "CollisionShape2D"
		add_child(c)


# ---------- Input / movement ----------

func _physics_process(delta: float) -> void:
	for k in cooldowns.keys():
		cooldowns[k] = maxf(0.0, float(cooldowns[k]) - delta)
	stun_t = maxf(0.0, stun_t - delta)

	if use_keyboard:
		move_input = Input.get_vector("left", "right", "up", "down")
		var to_mouse := get_global_mouse_position() - global_position
		if to_mouse.length() > 4.0:
			aim_dir = to_mouse.normalized()
		if Input.is_action_just_pressed("attack"): basic_attack()
		if Input.is_action_just_pressed("skill_1"): cast_slot(0)
		if Input.is_action_just_pressed("skill_2"): cast_slot(1)
		if Input.is_action_just_pressed("ultimate"): cast_slot(2)

	if stun_t > 0.0:
		velocity = Vector2.ZERO
	else:
		velocity = move_input * float(data.speed) * (1.0 + stat("speed"))
	move_and_slide()
	if regen_ps > 0.0:
		heal(regen_ps * delta)
	_update_passive(delta)
	queue_redraw()


# Para sa mobile touch UI
func set_move(v: Vector2) -> void: move_input = v.limit_length(1.0)
func set_aim(v: Vector2) -> void:
	if v.length() > 0.1: aim_dir = v.normalized()


# ---------- Casting ----------

func cast_slot(slot: int) -> void:
	if stun_t > 0.0 or hp <= 0.0: return
	var s: Dictionary = _slot_skill(slot)
	if s.is_empty(): return
	var id: String = s.id
	if float(cooldowns.get(id, 0.0)) > 0.0: return
	var h: Callable = _handlers.get(s.type, Callable())
	if not h.is_valid():
		push_warning("Walang handler para sa skill type: %s" % s.type)
		return
	cooldowns[id] = float(s.cd) * (1.0 - stat("cdr"))
	var used := _pre_cast(s)
	var r = h.call(used)
	if r is bool and not r:          # walang valid target: ibalik ang cooldown
		cooldowns[id] = 0.0
		_enhance_pending = false
		return
	_post_cast(s)
	skill_cast.emit(id)


func basic_attack() -> void:
	var b: Dictionary = data.get("basic", {})
	if b.is_empty() or stun_t > 0.0 or float(cooldowns.get("basic", 0.0)) > 0.0: return
	cooldowns["basic"] = float(b.cd)
	if b.get("ranged", false):
		var t := first_enemy_on_line(float(b.range), float(b.get("width", 20.0)))
		if t != null:
			damage(t, float(b.dmg) * (1.0 + stat("atk")))
		return
	var origin := global_position + aim_dir * float(b.range) * 0.5
	for e in enemies_in(origin, float(b.range) * 0.6):
		damage(e, float(b.dmg) * (1.0 + stat("atk")))


func _slot_skill(slot: int) -> Dictionary:
	if slot == 2:
		return data.get("ult", {})
	var list: Array = data.get("skills", [])
	if slot < list.size():
		return list[slot]
	return {}


func cooldown_left(slot: int) -> float:
	var s := _slot_skill(slot)
	return 0.0 if s.is_empty() else float(cooldowns.get(s.id, 0.0))


# Magdagdag ng bagong skill type dito (isang linya bawat type)
func _register_handlers() -> void:
	_handlers = {
		"dash": _skill_dash,
		"strike_aoe": _skill_strike_aoe,
		"heal_area": _skill_heal_area,
		"buff_area": _skill_buff_area,
		"barrier": _skill_barrier,
		"wall": _skill_wall,
		"bastion": _skill_bastion,
		"mark_area": _skill_mark_area,
		"corridor": _skill_corridor,
		"shield_target": _skill_shield_target,
		"intercept_rush": _skill_intercept_rush,
		"charge_strike": _skill_charge_strike,
		"team_buff": _skill_team_buff,
		"wave": _skill_wave,
		"pulse_heal": _skill_pulse_heal,
		"heal_target": _skill_heal_target,
		"dash_to_ally": _skill_dash_to_ally,
		"triage_zone": _skill_triage_zone,
	}


# ---------- Skill handlers (generic) ----------

func _skill_dash(s: Dictionary) -> void:
	if s.get("through", false):
		global_position += aim_dir * float(s.dist)   # dumadaan sa maliliit na hadlang
	else:
		move_and_collide(aim_dir * float(s.dist))
	if s.has("speed_buff"):
		apply_mod("speed", float(s.speed_buff), float(s.speed_dur))


func _skill_strike_aoe(s: Dictionary) -> void:
	var origin := global_position + aim_dir * float(s.get("offset", 0.0))
	for e in enemies_in(origin, float(s.radius)):
		damage(e, float(s.get("dmg", 0.0)) * (1.0 + stat("atk")))
		if s.has("slow"): mod(e, "speed", -float(s.slow), float(s.slow_dur))
		if s.has("def_down"): mod(e, "def", -float(s.def_down), float(s.def_dur))
		if s.has("stun") and e.has_method("apply_stun"): e.apply_stun(float(s.stun))
		if s.has("knock"): _push(e, (e.global_position - origin).normalized() * float(s.knock))


func _skill_heal_area(s: Dictionary) -> void:
	for a in allies_in(global_position, float(s.radius)):
		give_heal(a, float(s.heal))


func _skill_buff_area(s: Dictionary) -> void:
	for a in allies_in(global_position, float(s.radius)):
		mod(a, s.stat, float(s.value), float(s.dur))


func _skill_barrier(s: Dictionary) -> void:
	for a in allies_in(global_position, float(s.radius)):
		if a.has_method("add_shield"): a.add_shield(float(s.value), float(s.dur))


# Team buff: iisang handler para sa maraming ultimate/rally skills.
# Mga key (lahat optional): atk, speed, evade, cdr, obj, resist, dr, shield_pct, heal,
# cleanse (bool), cc_block (bool)
func _skill_team_buff(s: Dictionary) -> void:
	var dur := float(s.dur)
	for a in allies_in(global_position, float(s.radius)):
		for k in ["atk", "speed", "evade", "cdr", "obj", "resist"]:
			if s.has(k): mod(a, k, float(s[k]), dur)
		if s.has("dr") and a.has_method("add_dr"): a.add_dr(float(s.dr), dur)
		if s.has("shield_pct") and a.has_method("add_shield"):
			a.add_shield(a.max_hp * float(s.shield_pct), dur)
		if s.get("cleanse", false) and a.has_method("cleanse"): a.cleanse(99)
		if s.get("cc_block", false) and a.has_method("grant_cc_block"): a.grant_cc_block(dur)
		if s.has("heal"): give_heal(a, float(s.heal))


# ---------- Phan ----------

func _skill_wall(s: Dictionary) -> void:
	var w := Wall.new()
	w.team = team
	w.hp = max_hp * float(s.hp_pct)
	w.life = float(s.dur)
	w.rotation = aim_dir.angle() + PI / 2.0
	get_parent().add_child(w)
	w.global_position = aim_point(float(s.cast_range))


func _skill_bastion(s: Dictionary) -> void:
	var pos := global_position
	var radius := float(s.radius)
	for a in allies_in(pos, radius):
		if a.has_method("add_shield"):
			a.add_shield(a.max_hp * float(s.shield_pct), float(s.dur))
			a.add_dr(float(s.dr), float(s.dur))
	for e in enemies_in(pos, radius):   # knockback sa gilid lang
		if e.has_method("apply_mod") and e.global_position.distance_to(pos) >= radius * 0.6:
			_push(e, (e.global_position - pos).normalized() * float(s.knock))
	for i in int(s.dur):                # continuous regen bawat segundo
		await get_tree().create_timer(1.0).timeout
		for a in allies_in(pos, radius):
			if a.has_method("heal"): a.heal(float(s.regen))


# ---------- Quin ----------

func _skill_mark_area(s: Dictionary) -> void:
	var center := aim_point(float(s.cast_range))
	var now := Time.get_ticks_msec()
	for e in enemies_in(center, float(s.radius)):
		reveal(e, float(s.dur))
		# hindi nagi-stack ang mark: refresh lang kung active pa
		if e.has_meta("marked_until") and now < int(e.get_meta("marked_until")):
			e.set_meta("marked_until", now + int(float(s.dur) * 1000.0))
			continue
		e.set_meta("marked_until", now + int(float(s.dur) * 1000.0))
		mod(e, "def", -float(s.dmg_taken), float(s.dur))   # +damage taken


func _skill_corridor(s: Dictionary) -> void:
	var pos := global_position
	_reveal_around(pos, float(s.reveal_radius), float(s.dur))
	for a in allies_in(pos, float(s.radius)):
		mod(a, "speed", float(s.speed), float(s.dur))
		mod(a, "evade", float(s.evade), float(s.dur))


# ---------- Van ----------

func _skill_shield_target(s: Dictionary) -> void:
	var t := ally_at_aim(float(s.cast_range), true)
	if t != null and t.has_method("add_shield"):
		t.add_shield(max_hp * float(s.shield_pct), float(s.dur))


func _skill_intercept_rush(s: Dictionary) -> void:
	move_and_collide(aim_point(float(s.cast_range)) - global_position)
	for e in enemies_in(global_position, float(s.radius)):
		if e.has_method("apply_taunt"):
			e.apply_taunt(self, float(s.taunt_dur), float(s.dmg_down))
		if s.has("knock"):
			_push(e, (e.global_position - global_position).normalized() * float(s.knock))


# ---------- Christian ----------

func _skill_charge_strike(s: Dictionary) -> void:
	move_and_collide(aim_point(float(s.cast_range)) - global_position)
	var pos := global_position
	for e in enemies_in(pos, float(s.radius)):
		damage(e, float(s.dmg) * (1.0 + stat("atk")))
		if e.has_method("apply_stun"): e.apply_stun(float(s.knockup))   # knock-up
	# Rally banner: speed buff sa kakampi na nasa loob ng banner area
	for i in int(float(s.banner_dur) * 2.0):
		for a in allies_in(pos, float(s.banner_radius)):
			if a.has_method("set_aura"):
				a.set_aura("banner", "speed", float(s.banner_speed), 0.6)
		await get_tree().create_timer(0.5).timeout


# ---------- Lhen ----------

func _skill_wave(s: Dictionary) -> void:
	var length := float(s.length)
	var width := float(s.width)
	for a in _in_line(allies_in(global_position, length + width), length, width):
		if a != self: give_heal(a, float(s.heal))
	for e in _in_line(_enemy_nodes(), length, width):
		damage(e, float(s.dmg) * (1.0 + stat("atk")))
		if s.has("slow"): mod(e, "speed", -float(s.slow), float(s.slow_dur))


func _skill_pulse_heal(s: Dictionary) -> void:
	var radius := float(s.radius)
	for a in allies_in(global_position, radius):
		if a.has_method("cleanse"): a.cleanse(int(s.get("cleanse", 0)))
		if a.has_method("add_regen"):
			a.add_regen(float(s.heal_ps) * float(s.get("regen_strength", 0.0)), float(s.dur))
	for i in int(s.dur):
		for a in allies_in(global_position, radius):
			give_heal(a, float(s.heal_ps))
		await get_tree().create_timer(1.0).timeout


# ---------- Ace ----------

func _skill_heal_target(s: Dictionary) -> void:
	var t := ally_at_aim(float(s.cast_range), true)
	if t == null: return
	give_heal(t, float(s.heal))
	if t.has_method("add_regen"): t.add_regen(float(s.regen_ps), float(s.regen_dur))


func _skill_dash_to_ally(s: Dictionary) -> bool:
	var t := ally_at_aim(float(s.cast_range), false)
	if t == null: return false
	var to := t.global_position - global_position
	if to.length() > 28.0:
		move_and_collide(to - to.normalized() * 28.0)
	if t.has_method("cleanse"): t.cleanse(1, true)   # 1 control effect
	give_heal(t, float(s.heal))
	mod(t, "speed", float(s.speed), float(s.speed_dur))
	return true


func _skill_triage_zone(s: Dictionary) -> void:
	var pos := global_position
	var radius := float(s.radius)
	var dur := float(s.dur)
	zone_pos = pos
	zone_radius = radius
	zone_until = Time.get_ticks_msec() + int(dur * 1000.0)
	zone_revives = int(s.revives)
	zone_revive_pct = float(s.revive_pct)
	for a in allies_in(pos, radius):
		if a.has_method("add_shield"): a.add_shield(a.max_hp * float(s.shield_pct), dur)
	for i in int(dur):
		for a in allies_in(pos, radius):
			give_heal(a, float(s.heal_ps))
		await get_tree().create_timer(1.0).timeout


# ---------- Passives ----------

func _update_passive(delta: float) -> void:
	_passive_cd = maxf(0.0, _passive_cd - delta)
	var p: Dictionary = data.get("passive", {})
	match p.get("type", ""):
		"objective_stacks": _passive_objective_stacks(p, delta)   # Phan
		"link", "aura": _passive_pulse(p, delta)                  # Van, Christian
		"harmony_stacks": _passive_harmony(p, delta)              # Lhen
	# reveal_on_hit (Quin) at critical_care (Ace) ay nasa damage() / give_heal()


func _passive_objective_stacks(p: Dictionary, delta: float) -> void:
	var near := false
	for n in get_tree().get_nodes_in_group("objective_" + team):
		if n.global_position.distance_to(global_position) <= float(p.radius):
			near = true
			break
	if near:
		_decay_timer = 0.0
		_stack_timer += delta
		if _stack_timer >= float(p.gain_every):
			_stack_timer = 0.0
			stacks = mini(stacks + 1, int(p.max_stacks))
	else:
		_decay_timer += delta
		if _decay_timer >= float(p.decay_after):
			_decay_timer = 0.0
			stacks = maxi(stacks - 1, 0)
	if stacks > 0:
		heal(float(p.regen_per) * stacks * delta)


func _passive_pulse(p: Dictionary, delta: float) -> void:
	_pulse_t += delta
	if _pulse_t < 0.25: return
	var dt := _pulse_t
	_pulse_t = 0.0
	var group := allies_in(global_position, float(p.radius))
	if p.type == "link":
		# Relay Warden: kapag may kakampi sa malapit, pareho silang may DR at shared regen
		var near := group.filter(func(a): return a != self)
		if near.is_empty(): return
		var val := lerpf(float(p.dr_min), float(p.dr_max), clampf(float(level - 1) / 19.0, 0.0, 1.0))
		for a in group:
			if not a.has_method("set_aura"): continue
			a.set_aura("link", "def", val, 0.6)
			a.heal(float(p.regen) * dt)
	else:
		# Command Presence: objective progress at 1% HP/s sa loob ng rally area
		for a in group:
			if not a.has_method("set_aura"): continue
			a.set_aura("command", "obj", float(p.obj), 0.6)
			a.heal(a.max_hp * float(p.regen_pct) * dt)


func _passive_harmony(p: Dictionary, delta: float) -> void:
	_stack_timer += delta
	if _stack_timer < float(p.near_every): return
	_stack_timer = 0.0
	var near := allies_in(global_position, float(p.near_radius)).filter(func(a): return a != self)
	if not near.is_empty():
		stacks = mini(stacks + 1, int(p.max_stacks))


# Lhen: kapag max stacks, ang susunod na support skill ay enhanced
func _pre_cast(s: Dictionary) -> Dictionary:
	_enhance_pending = false
	var p: Dictionary = data.get("passive", {})
	if p.get("type", "") != "harmony_stacks" or not SUPPORT_TYPES.has(s.type): return s
	if stacks < int(p.max_stacks): return s
	_enhance_pending = true
	var e: Dictionary = p.enhance
	var c: Dictionary = s.duplicate(true)
	for k in ["heal", "heal_ps"]:
		if c.has(k): c[k] = float(c[k]) * (1.0 + float(e.heal))
	if c.has("dur"): c["dur"] = float(c["dur"]) * (1.0 + float(e.dur))
	for k in ["radius", "length"]:
		if c.has(k): c[k] = float(c[k]) * (1.0 + float(e.area))
	return c


func _post_cast(s: Dictionary) -> void:
	var p: Dictionary = data.get("passive", {})
	if p.get("type", "") != "harmony_stacks" or not SUPPORT_TYPES.has(s.type): return
	if _enhance_pending:
		stacks = 0
		_enhance_pending = false
	else:
		stacks = mini(stacks + 1, int(p.max_stacks))


# Trail Sense (Quin): pag nakapinsala ng kalaban, ire-reveal ang paligid
func _on_dealt_damage(_target: Node) -> void:
	var p: Dictionary = data.get("passive", {})
	if p.get("type", "") != "reveal_on_hit" or _passive_cd > 0.0: return
	_passive_cd = float(p.cd)
	_reveal_around(global_position, float(p.radius), float(p.dur))


# ---------- Stats / damage ----------

func stat(n: String) -> float:
	var v := float(stats.get(n, 0.0)) + aura_sum(n)
	match n:
		"speed": return clampf(v, -0.6, 0.5)
		"atk": return clampf(v, -0.5, 0.6)
		"cdr": return clampf(v, 0.0, CDR_CAP)
		"evade": return clampf(v, 0.0, EVADE_CAP)
		"obj": return clampf(v, 0.0, OBJ_CAP)
		"resist": return clampf(v, 0.0, 0.5)
	return v


func objective_rate() -> float:   # gamitin ng objective code: progress *= objective_rate()
	return 1.0 + stat("obj")


func total_def() -> float:
	var p: Dictionary = data.get("passive", {})
	var extra := 0.0
	if p.get("type", "") == "objective_stacks":
		extra = stacks * float(p.def_per)
	return clampf(float(stats.def) + aura_sum("def") + dr + extra, -0.5, DEF_CAP)


func take_damage(amount: float, _source: Node = null) -> void:
	if hp <= 0.0: return
	var ev := stat("evade")
	if ev > 0.0:
		_evade_acc += ev
		if _evade_acc >= 1.0:
			_evade_acc -= 1.0
			return   # na-evade ang hit
	amount *= (1.0 - total_def())
	var absorbed := minf(shield, amount)
	shield -= absorbed
	hp -= amount - absorbed
	hp_changed.emit(hp, max_hp)
	if hp <= 0.0:
		if _try_revive(): return
		died.emit(self)
		queue_free()


func _try_revive() -> bool:
	var now := Time.get_ticks_msec()
	for h in get_tree().get_nodes_in_group("heroes"):
		if h == self or h.team != team: continue
		if h.zone_revives > 0 and now < h.zone_until \
				and h.zone_pos.distance_to(global_position) <= h.zone_radius:
			h.zone_revives -= 1
			hp = max_hp * h.zone_revive_pct
			shield = 0.0
			hp_changed.emit(hp, max_hp)
			return true
	return false


func heal(amount: float) -> void:
	hp = minf(hp + amount, max_hp)
	hp_changed.emit(hp, max_hp)


# Heal na may passive hook (Ace: Critical Care)
func give_heal(target: Node, amount: float) -> void:
	if not target.has_method("heal"): return
	target.heal(amount)
	var p: Dictionary = data.get("passive", {})
	if p.get("type", "") == "critical_care" and target != self and target.has_method("set_aura"):
		var val := lerpf(float(p.dr_min), float(p.dr_max), clampf(float(level - 1) / 19.0, 0.0, 1.0))
		target.set_aura("critical_care", "def", val, float(p.dur))


func add_shield(amount: float, dur: float) -> void:
	var room := max_hp * SHIELD_CAP_PCT - shield
	var granted := clampf(amount, 0.0, maxf(room, 0.0))
	shield += granted
	get_tree().create_timer(dur).timeout.connect(_remove_shield.bind(granted))


func _remove_shield(amount: float) -> void:
	shield = maxf(0.0, shield - amount)


func add_dr(value: float, dur: float) -> void:
	dr += value
	get_tree().create_timer(dur).timeout.connect(_remove_dr.bind(value))


func _remove_dr(value: float) -> void:
	dr -= value


func add_regen(value: float, dur: float) -> void:
	regen_ps += value
	get_tree().create_timer(dur).timeout.connect(_remove_regen.bind(value))


func _remove_regen(value: float) -> void:
	regen_ps = maxf(0.0, regen_ps - value)


func apply_mod(stat_name: String, value: float, dur: float) -> void:
	stats[stat_name] = float(stats.get(stat_name, 0.0)) + value
	var id := _mod_id
	_mod_id += 1
	if value < 0.0:
		_debuffs[id] = {"stat": stat_name, "value": value}
	get_tree().create_timer(dur).timeout.connect(_end_mod.bind(stat_name, value, id))


func _end_mod(stat_name: String, value: float, id: int) -> void:
	if value < 0.0:
		if not _debuffs.has(id): return   # na-cleanse na
		_debuffs.erase(id)
	stats[stat_name] = float(stats.get(stat_name, 0.0)) - value


# Non-stacking buff na nire-refresh (link, banner, command presence, critical care)
func set_aura(key: String, stat_name: String, value: float, dur: float) -> void:
	_auras[key] = {"stat": stat_name, "value": value,
		"until": Time.get_ticks_msec() + int(dur * 1000.0)}


func aura_sum(stat_name: String) -> float:
	var now := Time.get_ticks_msec()
	var total := 0.0
	for k in _auras.keys():
		var a: Dictionary = _auras[k]
		if now >= int(a.until):
			_auras.erase(k)
			continue
		if a.stat == stat_name:
			total += float(a.value)
	return total


# Tanggalin ang control effects / debuffs. cc_only = stun at slow lang.
func cleanse(count: int = 99, cc_only: bool = false) -> int:
	var removed := 0
	if stun_t > 0.0 and removed < count:
		stun_t = 0.0
		removed += 1
	for id in _debuffs.keys():
		if removed >= count: break
		var d: Dictionary = _debuffs[id]
		if cc_only and d.stat != "speed": continue
		stats[d.stat] = float(stats[d.stat]) - float(d.value)
		_debuffs.erase(id)
		removed += 1
	return removed


func grant_cc_block(dur: float) -> void:
	cc_block = true
	cc_block_until = Time.get_ticks_msec() + int(dur * 1000.0)


func apply_stun(dur: float) -> void:
	if cc_block and Time.get_ticks_msec() < cc_block_until:
		cc_block = false   # na-absorb ang susunod na control effect
		return
	dur *= (1.0 - stat("resist"))
	stun_t = maxf(stun_t, minf(dur, STUN_CAP))


# Taunt (Van): ang kalaban ay mas mahina ang damage laban sa iba kaysa sa taunter
func apply_taunt(by: Node, dur: float, dmg_down: float) -> void:
	set_meta("taunt_by", by)
	set_meta("taunt_until", Time.get_ticks_msec() + int(dur * 1000.0))
	set_meta("taunt_down", dmg_down)


func taunt_target() -> Node:   # para sa enemy AI: kung may valid na taunter, siya dapat ang target
	var by = get_meta("taunt_by", null)
	if Time.get_ticks_msec() < int(get_meta("taunt_until", 0)) and is_instance_valid(by):
		return by
	return null


# ---------- Targeting helpers ----------

func _enemy_team() -> String:
	return "team_b" if team == "team_a" else "team_a"


func allies_in(origin: Vector2, radius: float) -> Array:
	return _in_group_range(team, origin, radius)


func enemies_in(origin: Vector2, radius: float) -> Array:
	var t := _enemy_team()
	return _in_group_range(t, origin, radius) + _in_group_range("wall_" + t, origin, radius)


func _in_group_range(group: String, origin: Vector2, radius: float) -> Array:
	return get_tree().get_nodes_in_group(group).filter(
		func(n): return is_instance_valid(n) and n.global_position.distance_to(origin) <= radius)


func _enemy_nodes() -> Array:
	var t := _enemy_team()
	return (get_tree().get_nodes_in_group(t) + get_tree().get_nodes_in_group("wall_" + t)).filter(
		func(n): return is_instance_valid(n))


# Mga node na nasa harap (rectangle sa direksyon ng aim)
func _in_line(nodes: Array, length: float, width: float) -> Array:
	return nodes.filter(func(n):
		if not is_instance_valid(n): return false
		var rel: Vector2 = n.global_position - global_position
		var along := rel.dot(aim_dir)
		return along >= 0.0 and along <= length and absf(rel.cross(aim_dir)) <= width)


# Unang kalaban sa linya ng aim (para sa ranged basic attack)
func first_enemy_on_line(max_range: float, width: float) -> Node2D:
	var best: Node2D = null
	var best_along := INF
	for e in _in_line(_enemy_nodes(), max_range, width):
		var along: float = (e.global_position - global_position).dot(aim_dir)
		if along < best_along:
			best_along = along
			best = e
	return best


# Kakampi na pinakamalapit sa aim point (sa loob ng max_range ng caster)
func ally_at_aim(max_range: float, include_self: bool) -> Node2D:
	var point := aim_point(max_range)
	var best: Node2D = null
	var best_d := INF
	for a in allies_in(global_position, max_range):
		if a == self and not include_self: continue
		var d: float = a.global_position.distance_to(point)
		if d < best_d:
			best_d = d
			best = a
	return best


func damage(target: Node, amount: float) -> void:
	if not target.has_method("take_damage"): return
	if Time.get_ticks_msec() < int(get_meta("taunt_until", 0)):
		if get_meta("taunt_by", null) != target:
			amount *= 1.0 - float(get_meta("taunt_down", 0.0))
	target.take_damage(amount, self)
	_on_dealt_damage(target)


func mod(target: Node, stat_name: String, value: float, dur: float) -> void:
	if target.has_method("apply_mod"): target.apply_mod(stat_name, value, dur)


func reveal(target: Node, dur: float) -> void:
	target.set_meta("revealed_until", Time.get_ticks_msec() + int(dur * 1000.0))


# Gamitin ng UI/minimap/fog: kung true, ipakita ang target sa team ni Quin
static func is_revealed(target: Node) -> bool:
	return target.has_meta("revealed_until") \
		and Time.get_ticks_msec() < int(target.get_meta("revealed_until"))


func _reveal_around(origin: Vector2, radius: float, dur: float) -> void:
	for e in enemies_in(origin, radius):
		reveal(e, dur)
	# kalabang objectives at traps (ilagay sa groups na objective_<team> / trap_<team>)
	for g in ["objective_" + _enemy_team(), "trap_" + _enemy_team()]:
		for n in _in_group_range(g, origin, radius):
			reveal(n, dur)


func _push(target: Node2D, offset: Vector2) -> void:
	if target is CharacterBody2D:
		(target as CharacterBody2D).move_and_collide(offset)
	elif target.has_method("apply_mod"):
		target.global_position += offset


func aim_point(max_range: float) -> Vector2:
	var raw := get_global_mouse_position() if use_keyboard else global_position + aim_dir * max_range
	return global_position + (raw - global_position).limit_length(max_range)


# ---------- Suit progression (Lv 1-20) ----------

func suit_tier() -> int:   # 0 Starter, 1 Evolved, 2 Identity, 3 Impact, 4 Legacy
	return clampi(floori(float(level - 1) / 4.0), 0, 4)


func suit_name() -> String:
	var suits: Array = data.get("suits", [])
	return suits[suit_tier()] if suit_tier() < suits.size() else ""


# Prototype visual lang (palitan ng sprite/skin kada suit_tier)
func _draw() -> void:
	var col := Color(0.2, 0.8, 0.4) if team == "team_a" else Color(0.9, 0.3, 0.3)
	draw_circle(Vector2.ZERO, 18.0, col)
	draw_line(Vector2.ZERO, aim_dir * 28.0, Color.WHITE, 3.0)
	if shield > 0.0:
		draw_arc(Vector2.ZERO, 24.0, 0.0, TAU, 32, Color(0.5, 0.8, 1.0), 3.0)