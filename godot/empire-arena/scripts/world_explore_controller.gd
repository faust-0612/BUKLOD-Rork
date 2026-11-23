## Owner-approved 13-character Arena atlases animate inside Kingdom/Community/House.
## Pure local-preview navigation. No inventory, property, XP, BP or backend mutation.
extends Node2D

const HERO_IDS := ["phan", "quin", "van", "christian", "lhen", "ace", "ellusur",
    "jawo", "mitch", "niel", "angel", "vhen", "trudice"]
const FIELD := Rect2(55, 135, 1170, 450)
const WALK_SPEED := 245.0
const HERO_FRAME_SECONDS := 0.125
const STATION_HIT_RADIUS := 75.0
const ARRIVAL_RADIUS := 15.0
const INTERACTION_COOLDOWN := 0.55

var avatar_position := Vector2(640, 460)
var avatar_target := Vector2(640, 460)
var active_station := -1
var pending_station := -1
var pending_house := false
var pending_community := false
var local_visits := 0
var elapsed := 0.0
var next_interaction_time := 0.0
var avatar: Sprite2D
var resident_actors: Array[Sprite2D] = []
var displayed_world := ""
var active_touch := -1
var art_cache: Dictionary = {}
var interaction_label := "TAP GROUND TO MOVE • OFFLINE PREVIEW"

func _ready() -> void:
    set_process_unhandled_input(true)
    set_process(true)
    call_deferred("_setup_visuals")

func _world() -> String:
    var parent_world: String = str(get_parent().get("world_id"))
    if parent_world in ["kingdom", "house", "community"]:
        return parent_world
    return "kingdom"

func _atlas(hero_id: String) -> Texture2D:
    if art_cache.has(hero_id):
        return art_cache[hero_id]
    if not HERO_IDS.has(hero_id) or art_cache.size() >= 14:
        return null
    var path := "res://art/fullbody/" + hero_id + "_idle.png"
    var source: PackedByteArray = FileAccess.get_file_as_bytes(path)
    if source.is_empty():
        return null
    var bitmap := Image.new()
    if bitmap.load_png_from_buffer(source) != OK or bitmap.is_empty():
        return null
    if bitmap.get_width() % 4 != 0 or bitmap.get_height() % 2 != 0:
        return null
    var texture := ImageTexture.create_from_image(bitmap)
    art_cache[hero_id] = texture
    return texture

func _sprite(hero_id: String, at: Vector2, size_factor: float) -> Sprite2D:
    var sprite := Sprite2D.new()
    sprite.texture = _atlas(hero_id)
    if sprite.texture != null:
        sprite.hframes = 4
        sprite.vframes = 2
    sprite.frame = 0
    sprite.position = at
    sprite.scale = Vector2.ONE * size_factor
    sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
    add_child(sprite)
    return sprite

func _station(index: int) -> Vector2:
    return Vector2(150 + (index % 7) * 160, 270 + floori(float(index) / 7.0) * 190)

func _setup_visuals() -> void:
    displayed_world = _world()
    avatar = _sprite("phan", avatar_position, 0.36)
    if displayed_world == "kingdom":
        for i in range(HERO_IDS.size()):
            resident_actors.append(_sprite(HERO_IDS[i], _station(i), 0.27))
    elif displayed_world == "community":
        for i in range(6):
            resident_actors.append(_sprite(HERO_IDS[(i + 1) % HERO_IDS.size()],
                Vector2(170 + (i % 3) * 440, 305 + floori(float(i) / 3.0) * 205), 0.29))
    else:
        resident_actors.append(_sprite("quin", Vector2(850, 430), 0.32))

func move_to(point: Vector2) -> bool:
    if not FIELD.has_point(point):
        return false
    avatar_target = Vector2(
        clampf(point.x, FIELD.position.x, FIELD.end.x),
        clampf(point.y, FIELD.position.y, FIELD.end.y))
    pending_station = -1
    pending_house = false
    pending_community = false
    if displayed_world == "kingdom":
        for i in range(HERO_IDS.size()):
            if point.distance_to(_station(i)) < STATION_HIT_RADIUS:
                pending_station = i
                avatar_target = _station(i) + Vector2(0, 46)
                interaction_label = "WALKING TO " + HERO_IDS[i].to_upper()
                break
    elif displayed_world == "house" and point.distance_to(Vector2(640, 505)) < 145.0:
        pending_house = true
        avatar_target = Vector2(640, 543)
        interaction_label = "WALK TO THE HOUSE TO BUILD"
    elif displayed_world == "community":
        pending_community = true
        interaction_label = "EXPLORING COMMUNITY"
    if pending_station < 0 and not pending_house and not pending_community:
        active_station = -1
        interaction_label = "EXPLORING • TAP A LOCATION TO INTERACT"
    queue_redraw()
    return true

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventScreenTouch:
        if event.pressed and move_to(event.position):
            active_touch = event.index
            get_viewport().set_input_as_handled()
        elif not event.pressed and active_touch == event.index:
            active_touch = -1
    elif event is InputEventScreenDrag and event.index == active_touch:
        # Dragging changes the walking destination, not the construction stage.
        move_to(event.position)
        get_viewport().set_input_as_handled()
    elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
        if move_to(event.position):
            get_viewport().set_input_as_handled()

func _arrive() -> void:
    if elapsed < next_interaction_time:
        return
    if pending_station >= 0:
        if active_station != pending_station:
            local_visits += 1
        active_station = pending_station
        interaction_label = "VISITING " + HERO_IDS[active_station].to_upper() + " • PREVIEW ACTIVITY"
        pending_station = -1
        get_parent().world_interaction("navigation", interaction_label)
    elif pending_house:
        # A distant tap never grants an instant build stage; completion requires arrival.
        pending_house = false
        local_visits += 1
        get_parent().advance_preview_stage()
        interaction_label = "HOUSE BUILD STAGE PREVIEW COMPLETE"
        get_parent().world_interaction("build_complete", interaction_label)
    elif pending_community:
        pending_community = false
        local_visits += 1
        interaction_label = "COMMUNITY VISIT • LOCAL PREVIEW ONLY"
        get_parent().world_interaction("claim", interaction_label)
    next_interaction_time = elapsed + INTERACTION_COOLDOWN

func _process(delta: float) -> void:
    var dt: float = minf(delta, 0.05)
    elapsed += dt
    var before := avatar_position
    avatar_position = avatar_position.move_toward(avatar_target, WALK_SPEED * dt)
    var walking: bool = before.distance_squared_to(avatar_position) > 0.04
    if avatar != null:
        avatar.position = avatar_position
        avatar.frame = int(elapsed / HERO_FRAME_SECONDS) % 8 if walking else 0
        if walking and absf(avatar_target.x - avatar_position.x) > 1.0:
            avatar.flip_h = avatar_target.x < avatar_position.x
    for i in range(resident_actors.size()):
        resident_actors[i].frame = (int(elapsed / HERO_FRAME_SECONDS * 0.7) + i) % 8
    if avatar_position.distance_to(avatar_target) <= ARRIVAL_RADIUS:
        if pending_station >= 0 or pending_house or pending_community:
            _arrive()
    queue_redraw()

func _draw() -> void:
    if displayed_world == "":
        return
    var pulse: float = 4.0 * sin(elapsed * 2.5)
    draw_arc(avatar_target + Vector2(0, 15), 17 + pulse, 0, TAU,
        32, Color(0.58, 1.0, 0.77, 0.72), 2.0)
    draw_circle(avatar_position + Vector2(0, 44), 20, Color(0.01, 0.05, 0.08, 0.38))
    if displayed_world == "kingdom":
        for i in range(HERO_IDS.size()):
            var spot := _station(i)
            draw_arc(spot + Vector2(0, 52), 38 + 2.5 * sin(elapsed * 1.8 + i),
                0, TAU, 30,
                Color("#ffe0aa") if i == active_station else Color("#83dfbd"), 2.2)
            draw_string(ThemeDB.fallback_font, spot + Vector2(-37, 89),
                HERO_IDS[i].to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color.WHITE)
    elif displayed_world == "house":
        var stage: int = int(get_parent().get("preview_stage"))
        for i in range(12):
            var sparkle := Vector2(420 + i * 40, 355 + sin(elapsed * 1.8 + i) * 22)
            draw_circle(sparkle, 1.4 + float(stage) * 0.55,
                Color(1.0, 0.89, 0.63, 0.18 + float(stage) * 0.06))
    var label := interaction_label + " • NO BP / PROPERTY CHANGES"
    draw_rect(Rect2(300, 572, 710, 32), Color(0.02, 0.09, 0.16, 0.81))
    draw_string(ThemeDB.fallback_font, Vector2(314, 595), label,
        HORIZONTAL_ALIGNMENT_LEFT, 670, 16, Color("#fff2d4"))

func get_dev_snapshot() -> Dictionary:
    return {
        "world": displayed_world, "position": avatar_position, "station": active_station,
        "pending_station": pending_station, "pending_house": pending_house,
        "visits": local_visits, "server_settlement": false
    }
