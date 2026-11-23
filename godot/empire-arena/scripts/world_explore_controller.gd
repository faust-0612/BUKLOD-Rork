## BUKLOD Genesis native Godot world visuals, DEV sandbox only.
## Uses EXISTING 13 owner-supplied Arena sprite atlases; does not mint BP, property or inventory.
extends Node2D

const HERO_IDS := ["phan", "quin", "van", "christian", "lhen", "ace", "ellusur",
    "jawo", "mitch", "niel", "angel", "vhen", "trudice"]
const FIELD := Rect2(55, 135, 1170, 450)
const WALK_SPEED := 245.0
const HERO_FRAME_SECONDS := 0.125
const STATION_HIT_RADIUS := 75.0

var avatar_position := Vector2(640, 460)
var avatar_target := Vector2(640, 460)
var active_station := -1
var local_visits := 0
var elapsed := 0.0
var avatar: Sprite2D
var resident_actors: Array[Sprite2D] = []
var displayed_world := ""

func _ready() -> void:
    set_process_input(true)
    set_process(true)
    call_deferred("_setup_visuals")

func _world() -> String:
    var parent_world: String = str(get_parent().get("world_id"))
    if parent_world in ["kingdom", "house", "community"]:
        return parent_world
    return "kingdom"

func _atlas(hero_id: String) -> Texture2D:
    # Original offline Arena atlases are packed by build-empire-godot-pack.mjs.
    var filename := "res://art/fullbody/" + hero_id + "_idle.png"
    # Original PNG bytes are preserved inside the signed ZIP main pack.
    # Image.load_from_file is editor-oriented and warns that export may lose art.
    var original_png: PackedByteArray = FileAccess.get_file_as_bytes(filename)
    if original_png.is_empty():
        return null
    var img: Image = Image.new()
    if img.load_png_from_buffer(original_png) != OK or img.is_empty():
        return null
    if img.get_width() < 1024 or img.get_height() < 768:
        return null
    return ImageTexture.create_from_image(img)

func _sprite(hero_id: String, at: Vector2, size_factor: float) -> Sprite2D:
    var s := Sprite2D.new()
    s.texture = _atlas(hero_id)
    s.hframes = 4
    s.vframes = 2
    s.frame = 0
    s.position = at
    s.scale = Vector2.ONE * size_factor
    add_child(s)
    return s

func _station(index: int) -> Vector2:
    return Vector2(150 + (index % 7) * 160, 270 + (index / 7) * 190)

func _setup_visuals() -> void:
    displayed_world = _world()
    avatar = _sprite("phan", avatar_position, 0.28)
    if displayed_world == "kingdom":
        # No generic triangular heroes: each visual is the actual canonical character.
        for i in range(HERO_IDS.size()):
            resident_actors.append(_sprite(HERO_IDS[i], _station(i), 0.23))
    elif displayed_world == "community":
        for i in range(6):
            var where := Vector2(170 + (i % 3) * 440, 305 + (i / 3) * 205)
            resident_actors.append(_sprite(HERO_IDS[(i + 1) % HERO_IDS.size()], where, 0.23))
    else:
        resident_actors.append(_sprite("quin", Vector2(850, 430), 0.29))

func move_to(touch_position: Vector2) -> bool:
    if not FIELD.has_point(touch_position):
        return false
    avatar_target = Vector2(
        clampf(touch_position.x, FIELD.position.x, FIELD.end.x),
        clampf(touch_position.y, FIELD.position.y, FIELD.end.y))
    active_station = -1
    if displayed_world == "kingdom":
        for i in range(HERO_IDS.size()):
            if avatar_target.distance_to(_station(i)) < STATION_HIT_RADIUS:
                active_station = i
                avatar_target = _station(i) + Vector2(0, 48)
                local_visits += 1
                break
    elif displayed_world == "house":
        if avatar_target.distance_to(Vector2(640, 505)) < 145:
            # This is a visual DEV construction sequence, NOT actual player property.
            get_parent().advance_preview_stage()
            local_visits += 1
    return true

func _input(event: InputEvent) -> void:
    var point := Vector2(-1, -1)
    if event is InputEventScreenTouch and event.pressed:
        point = event.position
    elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
        point = event.position
    if move_to(point):
        get_viewport().set_input_as_handled()

func _process(delta: float) -> void:
    var dt := minf(delta, 0.05)
    elapsed += dt
    avatar_position = avatar_position.move_toward(avatar_target, WALK_SPEED * dt)
    if avatar != null:
        avatar.position = avatar_position
        avatar.frame = int(elapsed / HERO_FRAME_SECONDS) % 8
    for i in range(resident_actors.size()):
        resident_actors[i].frame = (int(elapsed / HERO_FRAME_SECONDS) + i) % 8
    queue_redraw()

func _draw() -> void:
    if displayed_world == "":
        return
    var pulse := 4.0 * sin(elapsed * 2.5)
    # The panorama, construction geometry and world audio remain in the parent.
    draw_arc(avatar_target + Vector2(0, 15), 20 + pulse, 0, TAU,
        32, Color(0.58, 1.0, 0.77, 0.66), 2.0)
    draw_circle(avatar_position + Vector2(0, 45), 21, Color(0.01, 0.05, 0.08, 0.40))
    if displayed_world == "kingdom":
        for i in range(HERO_IDS.size()):
            var spot := _station(i)
            draw_arc(spot + Vector2(0, 54), 33 + 2.0 * sin(elapsed * 1.7 + i),
                0, TAU, 28, Color("#ffe0aa") if i == active_station else Color("#83dfbd"), 1.6)
            draw_string(ThemeDB.fallback_font, spot + Vector2(-38, 83),
                HERO_IDS[i].to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color.WHITE)
    elif displayed_world == "house":
        # Local building feedback, no fictional house ownership or rewards.
        var stage: int = int(get_parent().get("preview_stage"))
        for i in range(12):
            var sparkle := Vector2(420 + i * 40, 355 + sin(elapsed * 1.8 + i) * 22)
            draw_circle(sparkle, 1.5 + float(stage) * 0.4,
                Color(1.0, 0.89, 0.63, 0.18 + float(stage) * 0.06))
    var label := "TAP TO EXPLORE  •  OFFLINE DEV — NO BP / ACCOUNT CHANGES"
    if active_station >= 0:
        label = "VISITING " + HERO_IDS[active_station].to_upper() + "  •  LOCAL DEV ONLY"
    draw_rect(Rect2(365, 574, 580, 29), Color(0.02, 0.09, 0.16, 0.75))
    draw_string(ThemeDB.fallback_font, Vector2(380, 596), label,
        HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color("#fff2d4"))

func get_dev_snapshot() -> Dictionary:
    return {
        "world": displayed_world,
        "position": avatar_position,
        "station": active_station,
        "visits": local_visits,
        "server_settlement": false
    }
