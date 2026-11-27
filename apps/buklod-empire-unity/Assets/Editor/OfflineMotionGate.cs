using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Verify real imported prefab animation curves and sampled skinned geometry
    // before native compilation. No quality downgrade, no production approval.
    internal static class OfflineMotionGate {
        static bool Finite(float n)=>!float.IsNaN(n)&&!float.IsInfinity(n);
        static bool Finite(Vector3 v)=>Finite(v.x)&&Finite(v.y)&&Finite(v.z);
        internal static void Validate(BattleVisualCatalog catalog){
            catalog.ValidateOfflineReview();int count=0;
            foreach(var h in catalog.heroes){
                var instance=UnityEngine.Object.Instantiate(h.prefab);
                try{
                    var animator=instance.GetComponentInChildren<Animator>(true);
                    if(!animator)throw new BuildFailedException("Missing hero animator "+h.id);
                    var wearables=instance.GetComponent<ReviewEquipmentVisual>();
                    if(!wearables||wearables.mounts==null||wearables.mounts.Length!=7||wearables.mounts.Any(m=>m==null||!m.basePlate||!m.advancedTrim||m.basePlate.activeSelf||m.advancedTrim.activeSelf))throw new BuildFailedException("Missing or pre-unlocked wearable mount "+h.id);
                    var slots=wearables.mounts.GroupBy(m=>m.slot).ToDictionary(x=>x.Key,x=>x.Count());
                    if(slots.Count!=5||!slots.TryGetValue("armor",out var armorCount)||armorCount!=2||!slots.TryGetValue("boots",out var bootCount)||bootCount!=2||!new[]{"weapon","shield","jewel"}.All(x=>slots.TryGetValue(x,out var n)&&n==1))throw new BuildFailedException("Incomplete wearable slots "+h.id);
                    foreach(var mount in wearables.mounts)foreach(var obj in new[]{mount.basePlate,mount.advancedTrim}){
                        var filter=obj.GetComponent<MeshFilter>();var renderer=obj.GetComponent<MeshRenderer>();
                        if(!filter||!filter.sharedMesh||filter.sharedMesh.vertexCount!=136||filter.sharedMesh.subMeshCount!=2||!renderer||renderer.sharedMaterials.Length!=2||renderer.sharedMaterials.Any(m=>!m)||obj.GetComponent<Collider>())throw new BuildFailedException("Invalid wearable geometry "+h.id);
                    }
                    var trail=instance.GetComponent<ReviewWeaponTrail>();if(!trail||!trail.Hand||trail.Hand.name!="Hand_R"||!ReviewWeaponTrail.Finite(trail.Anchor)||trail.Anchor.sqrMagnitude<.0025f)throw new BuildFailedException("Missing rig-linked weapon anchor "+h.id);
                    var root=animator.gameObject;
                    var skins=root.GetComponentsInChildren<SkinnedMeshRenderer>(true).Where(s=>s.sharedMesh&&s.transform.name!="Mobile LOD1").ToArray();
                    if(skins.Length==0)throw new BuildFailedException("Missing hero deformation mesh "+h.id);
                    var transforms=root.GetComponentsInChildren<Transform>(true);
                    var pos=transforms.Select(t=>t.localPosition).ToArray();
                    var rot=transforms.Select(t=>t.localRotation).ToArray();
                    var scale=transforms.Select(t=>t.localScale).ToArray();
                    var mesh=new Mesh();
                    try{
                        foreach(var name in CandidateReviewComposer.HeroClips){
                            var clips=animator.runtimeAnimatorController.animationClips.Where(c=>c&&c.name==name).Distinct().ToArray();
                            if(clips.Length!=1||!Finite(clips[0].length)||clips[0].length<=0)throw new BuildFailedException("Missing unique motion "+h.id+"/"+name);
                            var clip=clips[0];var bindings=AnimationUtility.GetCurveBindings(clip);
                            if(!bindings.Any(b=>b.type==typeof(Transform)))throw new BuildFailedException("Missing rig curves "+h.id+"/"+name);
                            foreach(var binding in bindings.Where(b=>b.type==typeof(Transform)))
                                if(!string.IsNullOrEmpty(binding.path)&&!root.transform.Find(binding.path))throw new BuildFailedException("Unbound motion "+h.id+"/"+name+"/"+binding.path);
                            var hair=transforms.SingleOrDefault(x=>x.name=="ReviewHair");
                            if(hair&&(name=="Idle"||name=="Walk"||name=="Run")){
                                string path=AnimationUtility.CalculateTransformPath(hair,root.transform);
                                if(!bindings.Any(x=>x.path==path&&x.propertyName.StartsWith("m_LocalRotation",StringComparison.Ordinal)))throw new BuildFailedException("Missing secondary hair motion "+h.id+"/"+name);
                            }
                            Vector3? firstTip=null;float tipTravel=0;
                            foreach(float fraction in new[]{0f,.25f,.5f,.75f,.99f}){
                                for(int i=0;i<transforms.Length;i++){transforms[i].localPosition=pos[i];transforms[i].localRotation=rot[i];transforms[i].localScale=scale[i];}
                                clip.SampleAnimation(root,clip.length*fraction);
                                if(name=="Attack"){var tip=trail.Hand.TransformPoint(trail.Anchor);if(!ReviewWeaponTrail.Finite(tip))throw new BuildFailedException("Non-finite weapon trace "+h.id);if(firstTip.HasValue)tipTravel=Mathf.Max(tipTravel,Vector3.Distance(firstTip.Value,tip));else firstTip=tip;}
                                foreach(var skin in skins){
                                    mesh.Clear();skin.BakeMesh(mesh);mesh.RecalculateBounds();
                                    if(mesh.vertexCount!=skin.sharedMesh.vertexCount||mesh.vertexCount==0||!Finite(mesh.bounds.center)||!Finite(mesh.bounds.size)||mesh.bounds.size.sqrMagnitude<=.000001f)
                                        throw new BuildFailedException("Invalid sampled deformation "+h.id+"/"+name);
                                }
                            }
                            if(name=="Attack"&&tipTravel<.01f)throw new BuildFailedException("Static weapon anchor during attack "+h.id);
                            count++;
                        }
                    }finally{UnityEngine.Object.DestroyImmediate(mesh);}
                }finally{UnityEngine.Object.DestroyImmediate(instance);}
            }
            if(count!=13*CandidateReviewComposer.HeroClips.Length)throw new BuildFailedException("Incomplete hero motion verification.");
            Debug.Log("BUKLOD_OFFLINE_MOTION_GATE_PASS: "+count+" original clips; 5 sampled poses each; rig-linked attack anchors checked. Visual likeness and device acceptance still required.");
        }
    }
}
