## Session-scoped practice progression. Never a BUKLOD Points ledger.
extends RefCounted
const DIFFICULTIES := ["Easy","Normal","Hard","Expert"]
const MAX_LEVEL := 9007199254740990
var levels: Dictionary = {}
var total_rounds := 0
var practice_score := 0
var difficulty := 1
var quick_play := true
var active_key := ""
var active_level := 0
var active_difficulty := 1
var settled := false

func level_for(game_id: String, tier: int) -> int:
    return mini(MAX_LEVEL,int(levels.get(game_id+":"+str(tier),0))+1)

func begin(game_id: String) -> void:
    active_difficulty = difficulty
    active_key = game_id+":"+str(active_difficulty)
    active_level = level_for(game_id,active_difficulty)
    settled = false

func complete_round() -> int:
    if active_key.is_empty() or settled:
        return 0
    settled = true
    levels[active_key] = active_level
    total_rounds = mini(MAX_LEVEL,total_rounds+1)
    var score := 2 if active_difficulty >= 2 else 1
    practice_score = mini(MAX_LEVEL,practice_score+score)
    return score

func abandon() -> void:
    active_key = ""
    active_level = 0
    settled = true

func milestone() -> String:
    if total_rounds < 5:
        return "Explorer"
    if total_rounds < 15:
        return "Pathfinder"
    if total_rounds < 30:
        return "Realm Guardian"
    return "Master Explorer • Cycle "+str(floori(float(total_rounds-30)/10.0)+1)

func prepare(base: Dictionary, level: int, tier: int, objective: int) -> Dictionary:
    var data := base.duplicate(true)
    var step := maxi(0,level-1)
    var seed_value := int(step%104729)*31+tier*101+objective*7
    var items: Array = data.get("items",[])
    var kind := str(data.get("type",""))
    if kind == "sudoku":
        var profile: Dictionary = data.tiers[tier]
        var templates: Array = profile.templates
        var template: Dictionary = templates[(step+objective*5)%templates.size()]
        var n := int(profile.size)
        var shift := int((step / int(templates.size()) + objective)%n)
        data.size = n
        data.boxRows = profile.boxRows
        data.boxCols = profile.boxCols
        data.clues = []
        data.items = []
        for i in range(n):
            data.items.append(i+1)
        data.items.append(0)
        for v in template.clues:
            data.clues.append(0 if int(v)==0 else (int(v)-1+shift)%n+1)
        data.erase("tiers")
        return data
    # Keep authored first Normal encounter intact for legacy tests.
    if level == 1 and tier == 1:
        return data
    match kind:
        "budget":
            var count := 4+tier
            var needed := 2 if tier <= 1 else 3
            var values: Array = []
            for i in range(count):
                values.append(2+((seed_value+i*11+i*i*3)% (9+tier*4)))
            var goal := 0
            for i in range(needed):
                goal += int(values[i])
            data.items = values
            data.limit = needed
            data.goal = goal
            data.prompt = "Allocate exactly %d units using %d bundles." % [goal,needed]
        "memory","rhythm":
            var length := mini(9,3+tier+mini(3,floori(float(step)/3.0)))
            var answer: Array = []
            for i in range(length):
                answer.append((seed_value+i*7+i*i*3)%items.size())
            data.answer = answer
            if kind == "memory":
                data.previewSeconds = [5.0,3.5,2.8,2.0][tier]
                data.prompt = "Remember and repeat %d symbols." % length
            else:
                data.beatSeconds = [1.2,0.95,0.78,0.65][tier]
                data.timingWindow = [0.38,0.28,0.22,0.17][tier]
        "pair":
            var pairs := mini(4,2+floori(float(tier+1)/2.0))
            var symbols := ["Leaf","Star","Stone","Bloom"]
            var cards: Array = []
            for i in range(pairs):
                var item := str(symbols[(seed_value+i)%symbols.size()])
                cards.append(item)
                cards.append(item)
            var rng := RandomNumberGenerator.new()
            rng.seed = seed_value+1
            for i in range(cards.size()-1,0,-1):
                var j := rng.randi_range(0,i)
                var old: Variant = cards[i]
                cards[i] = cards[j]
                cards[j] = old
            data.items = cards
            data.prompt = "Find %d hidden matching pairs." % pairs
        "farm":
            var crops := ["Corn","Rice","Bean","Carrot","Wheat","Herbs"]
            var count := 2+tier
            data.items = []
            for i in range(count):
                data.items.append(crops[(seed_value+i)%crops.size()])
            data.goal = count
            data.growSeconds = 1.5+float(tier)*0.65
        "merge":
            var unit := 1 << mini(12,tier+int(step%5))
            data.items = [unit,unit,unit*2,0,0,0,0,0,0]
            data.goal = unit*4
            data.prompt = "Merge equal adjacent tiers to create %d." % int(data.goal)
        "match3":
            # Relabel and rotate the proven-solvable board; no free initial match.
            var labels: Array = []
            for value in items:
                if not labels.has(value):
                    labels.append(value)
            if labels.size() == 3:
                for i in range(items.size()):
                    data.items[i] = labels[(labels.find(items[i])+seed_value)%3]
        "route":
            # Choose among known-valid paths on the 3x3 grid.
            var paths := [[0,1,2,5,8],[0,3,6,7,8],[0,1,4,7,8],[0,3,4,5,8]]
            var path: Array = paths[seed_value%paths.size()]
            data.items = []
            for i in range(9):
                data.items.append("Start" if i == 0 else ("Goal" if i == 8 else ("Path" if path.has(i) else "Blocked")))
        "select","sequence":
            # Preserve authored semantics; remap choice positions in field engine.
            pass
    return data
