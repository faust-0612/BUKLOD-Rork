# Phan 3D asset contract

Canonical visual reference: the approved Phan progression strip supplied by the product owner (farmer-to-CEO progression).

## Required delivery

Place the optimized web model at:

`public/characters/phan/phan.glb`

The model must use one reusable humanoid skeleton/rig for Phan. Level progression must be represented by modular outfit/accessory/appearance variants rather than duplicating the rig and animation set for every level.

## Required animation clip names

- `Idle`
- `Walk`
- `Wave`
- `Celebrate`
- `LevelUp`
- `LookAround`
- `Pose`

Additional clips are allowed, but the names above are the stable application contract.

## Level appearance contract

The application resolves an appearance key as `phan-level-N`, where `N` starts at 1. Character level remains character-specific: switching to Phan must continue to obey the existing BUKLOD rule that a newly selected character starts at Level 1.

Do not encode Circle Rank rules into the GLB. Rank/unlock/level rules remain application data and the renderer only displays the resolved appearance.

## Web performance requirements

- GLB/GLTF 2.0
- compressed geometry where supported
- compressed web textures
- one shared skeleton
- no duplicate animation tracks per outfit
- lazy-load the model only when the character viewport is visible
- pause animation when off-screen/backgrounded
- use static/current layered art as the failure/unsupported-browser fallback
- never load every level outfit at startup if variants can be streamed/lazily attached

The existing layered BUKLOD character must remain visible until the real GLB finishes loading, and must remain the fallback when WebGL/model loading fails.
