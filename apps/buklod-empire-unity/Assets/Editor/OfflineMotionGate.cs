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
                            foreach(float fraction in new[]{0f,.5f,.99f}){
                                for(int i=0;i<transforms.Length;i++){transforms[i].localPosition=pos[i];transforms[i].localRotation=rot[i];transforms[i].localScale=scale[i];}
                                clip.SampleAnimation(root,clip.length*fraction);
                                foreach(var skin in skins){
                                    mesh.Clear();skin.BakeMesh(mesh);
                                    if(mesh.vertexCount!=skin.sharedMesh.vertexCount||mesh.vertexCount==0||!Finite(mesh.bounds.center)||!Finite(mesh.bounds.size)||mesh.bounds.size.sqrMagnitude<=.000001f)
                                        throw new BuildFailedException("Invalid sampled deformation "+h.id+"/"+name);
                                }
                            }
                            count++;
                        }
                    }finally{UnityEngine.Object.DestroyImmediate(mesh);}
                }finally{UnityEngine.Object.DestroyImmediate(instance);}
            }
            if(count!=13*CandidateReviewComposer.HeroClips.Length)throw new BuildFailedException("Incomplete hero motion verification.");
            Debug.Log("BUKLOD_OFFLINE_MOTION_GATE_PASS: "+count+" original clips; 3 sampled poses each. Visual likeness and device acceptance still required.");
        }
    }
}
