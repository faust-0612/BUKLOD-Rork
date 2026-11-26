# Image-to-3D reconstruction pilot — DEV review only
This branch isolates the Phan Earthforge Vanguard reconstruction benchmark from both Unity integration and production. Do not use ReferenceIndex's civilian Phan sprite as an arena reconstruction input. The owner-library hero sheet front/back/portrait crops are retained outside this repository; front image SHA-256 d0c850bbd490364470c4bd17448ba16b43e9efb693088ac54fef46e83922070b. Never upload private art to a hosted service without consent.

Preferred route: official Microsoft TRELLIS.2 (24 GB NVIDIA VRAM, local cached checkpoint). Free-GPU fallback: official TripoSR commit 107cefdc244c39106fa830359024f6a2f1c78871, vertex-color GLB, review only. Use a user-controlled free GPU notebook or existing CUDA computer, no paid API. A separate downloadable notebook and source-art ZIP have been prepared but are not committed here. Neither upstream inference nor UniRig has run; current environment has CPU-only PyTorch and cannot download weights.

Run the independent GLB review gate with Python, numpy and trimesh:
`python -m unittest -v test_review_candidate`
`python review_candidate.py /path/to/candidate.glb`
Structural success does not imply likeness, PBR quality, skeleton correctness, animation, licensing, Unity runtime or Android approval. Never generate a production receipt from this gate. Three fixture tests passed locally before commit; no game source, scene, asset catalog or production configuration changed. Next: actual GPU reconstruction, compare front/back/face and silhouette, then rig and retarget canonical skills, then actual Unity visual and device acceptance. Scale beyond Phan only after benchmark approval. No purchased assets or generation API.
