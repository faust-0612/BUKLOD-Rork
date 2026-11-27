# Creature source animation audit — 2026-11-28

Actual GLB JSON chunks inspected from the pinned repository source objects (not Unity-import evidence). All nine below contain one skin. Keep original creature identities and use matching real art, not arbitrary recolored substitutes.

| Source file | Idle / locomotion | Attack | Hit | Death | Disposition |
|---|---|---|---|---|---|
| Enemies/Snake.glb | Snake_Idle / Snake_Walk | Snake_Attack | absent | absent | EmeraldSerpent candidate; obtain compatible authored hit/death or retarget to verified skeleton before binding |
| Monsters/quaternius-green-blob.glb | Idle / Walk | Bite_Front | HitRecieve | Death | supplemental candidate; identity review |
| Monsters/quaternius-demon.glb | Flying_Idle only | absent | absent | absent | hold for compatible full rig motions |
| Monsters/quaternius-yeti.glb | Idle / Walk | Bite_Front | HitRecieve | Death | supplemental candidate; identity review |
| Monsters/quaternius-orc.glb | Idle / Walk / Run | Punch, Weapon | HitReact | Death | supplemental candidate; identity review |
| Monsters/quaternius-orc-skull.glb | Idle / Walk / Run | Punch, Weapon | HitReact | Death | supplemental candidate; identity review |
| Monsters/quaternius-alien.glb | Idle / Walk / Run | Punch, Weapon | HitReact | Death | supplemental candidate; identity review |
| Monsters/quaternius-mushroom-king.glb | Idle / Walk / Run | Punch, Weapon | HitReact | Death | supplemental candidate; identity review |
| Monsters/quaternius-blue-demon.glb | Idle / Walk / Run | Punch, Weapon | HitReact | Death | supplemental candidate; identity review |

Snake animation names in GLB use the prefix SnakeArmature|. Seven sources have the required named action categories but that does not prove rig compatibility, target identity, correct Unity import or successful runtime playback. Existing deer and wolf bindings remain unchanged. No fake motion, no production approval.
