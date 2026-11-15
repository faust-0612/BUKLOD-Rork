extends RefCounted
## Canonical 13 positions from BuklodKingdomMapPremium.tsx. Never mutate IDs.
const STATIONS: Array[Dictionary] = [
    {"id":"phan-enterprise-builder","name":"Phan","x":110,"y":660,"color":"#d9a52f"},
    {"id":"vhen-farm-to-market","name":"Vhen","x":265,"y":745,"color":"#75a841"},
    {"id":"jawo-forest-trail","name":"Jawo","x":170,"y":475,"color":"#3d8758"},
    {"id":"trudice-playground-memory","name":"Trudice","x":355,"y":375,"color":"#bc6fb1"},
    {"id":"mitch-restore-mural","name":"Mitch","x":505,"y":545,"color":"#bf6d50"},
    {"id":"christian-civic-leadership","name":"Christian","x":580,"y":285,"color":"#4b69a0"},
    {"id":"ace-rescue-grid","name":"Ace","x":720,"y":430,"color":"#397b9c"},
    {"id":"van-living-city-dispatch","name":"Van","x":825,"y":260,"color":"#327c91"},
    {"id":"lhen-rhythm-journey","name":"Lhen","x":970,"y":350,"color":"#8b4b91"},
    {"id":"angel-kingdom-treasury","name":"Angel","x":910,"y":620,"color":"#a36c24"},
    {"id":"niel-mission-trail","name":"Niel","x":690,"y":710,"color":"#55744d"},
    {"id":"elesur-village-builder","name":"ELESUR","x":1040,"y":710,"color":"#54766f"},
    {"id":"quin-discovery-expedition","name":"Quin","x":1045,"y":135,"color":"#5268a4"}
]
const ROADS: Array[Vector2i] = [
    Vector2i(0,1),Vector2i(1,2),Vector2i(2,3),Vector2i(3,4),
    Vector2i(4,5),Vector2i(5,6),Vector2i(6,7),Vector2i(7,8),
    Vector2i(8,9),Vector2i(9,10),Vector2i(10,11),
    Vector2i(11,8),Vector2i(8,12)
]
static func project(s: Dictionary) -> Vector3:
    return Vector3((float(s["x"])-600.0)/28.0, 0.0, (float(s["y"])-450.0)/28.0)
