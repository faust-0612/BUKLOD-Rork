using System;
using System.Linq;
using UnityEditor.Build;
using UnityEngine;
namespace Buklod.Empire.Editor {
    internal static class ReviewWeaponTrailComposer {
        internal static void Attach(GameObject root,string hero,bool requireDerived=false){
            var hands=root.GetComponentsInChildren<Transform>(true).Where(t=>ReviewWeaponTrail.IsRightHand(t.name)).ToArray();
            if(hands.Length!=1)throw new BuildFailedException("Weapon trail hand binding mismatch: "+hero);
            var hand=hands[0];Vector3 far=Vector3.zero;float best=.0025f;bool derived=false;
            // Full-detail mesh only; use bind-space weighted vertices so the anchor follows
            // the imported rig and its coordinate conversion rather than assuming axes.
            foreach(var skin in root.GetComponentsInChildren<SkinnedMeshRenderer>(true).Where(s=>!s.name.StartsWith("Private LOD ",StringComparison.Ordinal)&&s.name!="Mobile LOD1")){
                var mesh=skin.sharedMesh;if(!mesh||!mesh.isReadable)continue;
                int bone=Array.IndexOf(skin.bones,hand);if(bone<0||bone>=mesh.bindposes.Length)continue;
                var vertices=mesh.vertices;var weights=mesh.boneWeights;if(weights.Length!=vertices.Length)continue;
                var bind=mesh.bindposes[bone];
                for(int i=0;i<vertices.Length;i++){
                    var w=weights[i];float influence=(w.boneIndex0==bone?w.weight0:0)+(w.boneIndex1==bone?w.weight1:0)+(w.boneIndex2==bone?w.weight2:0)+(w.boneIndex3==bone?w.weight3:0);
                    if(influence<.85f)continue;var local=bind.MultiplyPoint3x4(vertices[i]);
                    if(!ReviewWeaponTrail.Finite(local)||local.sqrMagnitude<=best||local.sqrMagnitude>4)continue;
                    best=local.sqrMagnitude;far=local;derived=true;
                }
            }
            if(!derived&&requireDerived)throw new BuildFailedException("No actual weighted hand geometry for private candidate: "+hero);
            if(!derived)far=ReviewWeaponTrail.FallbackAnchor(hero);
            root.AddComponent<ReviewWeaponTrail>().Configure(hand,far,derived);
            if(!derived)Debug.LogWarning("Weapon trail uses equipment-dimension anchor, mesh not readable or no suitable weighted vertex: "+hero);
        }
    }
}
