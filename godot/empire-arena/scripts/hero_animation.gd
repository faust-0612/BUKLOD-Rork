## Frame-stable hero pose state for the 13 approved four-pose, eight-frame atlases.
## Keeps pose decisions separate from visuals and never changes gameplay authority.
extends RefCounted

const FRAME_COUNT := 8
const STEP_SECONDS := 0.125
const WALK_HOLD := 0.17
var history: Dictionary = {}
var impulses: Dictionary = {}

func reset() -> void:
	history.clear()
	impulses.clear()

func handle_event(event: Dictionary, now: float) -> void:
	var name: String = str(event.get("type", ""))
	var actor_id: String = str(event.get("actor", event.get("from", "")))
	if actor_id.is_empty():
		return
	if name == "skill":
		impulses[actor_id] = {"pose": "skill", "until": now + 0.55}
	elif name == "damage":
		impulses[actor_id] = {"pose": "attack", "until": now + 0.35}
	elif name == "defeat":
		impulses.erase(actor_id)
		history.erase(actor_id)

func sample(actor_id: String, position: Vector2, now: float) -> Dictionary:
	var record: Dictionary = history.get(actor_id, {})
	var previous_pos: Vector2 = record.get("pos", position)
	var moving_until: float = float(record.get("moving_until", 0.0))
	if position.distance_squared_to(previous_pos) > 0.75 * 0.75:
		moving_until = now + WALK_HOLD
	var pose: String = "walk" if now < moving_until else "idle"
	var impulse: Dictionary = impulses.get(actor_id, {})
	if now < float(impulse.get("until", 0.0)):
		pose = str(impulse.get("pose", "attack"))
	else:
		impulses.erase(actor_id)
	var pose_start: float = float(record.get("pose_start", now))
	if str(record.get("pose", "")) != pose:
		pose_start = now
	var frame: int = posmod(int(floor(maxf(0.0, now - pose_start) / STEP_SECONDS)), FRAME_COUNT)
	history[actor_id] = {"pos": position, "moving_until": moving_until,
		"pose": pose, "pose_start": pose_start}
	return {"pose": pose, "frame": frame}
