using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using UnityEditor;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Review only: lower-detail geometry on the exact same animated skeleton.
    internal static class HeroLodReviewImporter {
        const string Source="Tools/ReviewOutput/hero-lod";
        const string Full="Tools/ReviewOutput/heroes";
        const string Models=CandidateReviewComposer.Out+"/Models";
        [Serializable] private sealed class Manifest {public string status;public Row[] heroes;}
        [Serializable] private sealed class Row {public string id,file,sha256,sourceSha256;public int bytes,fullTriangles,lodTriangles;}
        static string Hash(byte[] bytes){
            using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();
        }
        public static void CopyModels(){
            if(!File.Exists(Source+"/manifest.json"))throw new InvalidOperationException("Run Tools/prepare-review-assets.py first (LOD manifest missing).");
            var m=JsonUtility.FromJson<Manifest>(File.ReadAllText(Source+"/manifest.json"));
            if(m==null||m.status!="LOD_REVIEW_ONLY"||m.heroes==null||m.heroes.Length!=HeroKitCatalog.All.Count)throw new InvalidOperationException("Incomplete LOD manifest.");
            var ids=new HashSet<string>();
            foreach(var row in m.heroes){
                if(row==null||!HeroKitCatalog.All.Any(h=>h.Id==row.id)||!ids.Add(row.id)||row.file!=row.id+".glb"||row.fullTriangles<=0||row.lodTriangles<=0||row.lodTriangles>=row.fullTriangles*.8f)
                    throw new InvalidOperationException("Invalid LOD identity or triangle budget.");
                var data=File.ReadAllBytes(Source+"/"+row.file);
                if(data.Length!=row.bytes||Hash(data)!=row.sha256||Hash(File.ReadAllBytes(Full+"/"+row.file))!=row.sourceSha256)
                    throw new InvalidOperationException("LOD/full model hash mismatch: "+row.id);
            }
            foreach(var row in m.heroes)File.Copy(Source+"/"+row.file,Models+"/"+row.id+"_lod1.glb",true);
        }
        static string PathFrom(Transform child,Transform root){
            if(!child||!(child==root||child.IsChildOf(root)))throw new InvalidOperationException("LOD transform outside model hierarchy.");
            return AnimationUtility.CalculateTransformPath(child,root);
        }
        static Transform Find(Transform root,string path){
            var t=path.Length==0?root:root.Find(path);
            if(!t)throw new InvalidOperationException("LOD rig path missing: "+path);return t;
        }
        public static void Attach(GameObject high,string id){
            var low=AssetDatabase.LoadAssetAtPath<GameObject>(Models+"/"+id+"_lod1.glb");
            if(!low||high.GetComponent<LODGroup>())throw new InvalidOperationException("LOD model missing or duplicate LOD group: "+id);
            var highSkins=high.GetComponentsInChildren<SkinnedMeshRenderer>(true);
            var lowSkins=low.GetComponentsInChildren<SkinnedMeshRenderer>(true);
            if(highSkins.Length==0||highSkins.Length!=lowSkins.Length||high.GetComponentsInChildren<Renderer>(true).Length!=highSkins.Length||low.GetComponentsInChildren<Renderer>(true).Length!=lowSkins.Length)
                throw new InvalidOperationException("Unexpected LOD renderer layout: "+id);
            var reduced=new List<Renderer>();
            foreach(var src in lowSkins){
                var target=Find(high.transform,PathFrom(src.transform,low.transform)).GetComponent<SkinnedMeshRenderer>();
                if(!target||!target.sharedMesh||!src.sharedMesh||src.sharedMesh.subMeshCount!=target.sharedMesh.subMeshCount||src.sharedMaterials.Length!=target.sharedMaterials.Length||
                    src.sharedMesh.bindposes.Length!=target.sharedMesh.bindposes.Length||src.bones.Length!=target.bones.Length)
                    throw new InvalidOperationException("Incompatible LOD skin: "+id);
                var highBind=target.sharedMesh.bindposes;var lowBind=src.sharedMesh.bindposes;
                for(int i=0;i<highBind.Length;i++)for(int j=0;j<16;j++)if(Mathf.Abs(highBind[i][j]-lowBind[i][j])>.0001f)
                    throw new InvalidOperationException("LOD bind pose drift: "+id);
                var mapped=src.bones.Select(b=>Find(high.transform,PathFrom(b,low.transform))).ToArray();
                if(!mapped.SequenceEqual(target.bones))throw new InvalidOperationException("LOD bone ordering mismatch: "+id);
                // A child of the high skin inherits exactly its transform without a second rig.
                var go=new GameObject("Mobile LOD1");go.transform.SetParent(target.transform,false);
                var r=go.AddComponent<SkinnedMeshRenderer>();r.sharedMesh=src.sharedMesh;r.sharedMaterials=target.sharedMaterials;r.bones=mapped;
                if(src.rootBone)r.rootBone=Find(high.transform,PathFrom(src.rootBone,low.transform));
                if(r.rootBone!=target.rootBone)throw new InvalidOperationException("LOD root bone mismatch: "+id);
                r.localBounds=src.localBounds;r.quality=target.quality;r.updateWhenOffscreen=false;
                r.shadowCastingMode=target.shadowCastingMode;r.receiveShadows=target.receiveShadows;
                reduced.Add(r);
            }
            var group=high.AddComponent<LODGroup>();group.fadeMode=LODFadeMode.None;
            // Starting thresholds only: verify on the actual device/camera before release.
            // Final threshold zero avoids hiding distant visible units.
            group.SetLODs(new[]{new LOD(.055f,highSkins.Cast<Renderer>().ToArray()),new LOD(0f,reduced.ToArray())});
            group.RecalculateBounds();
        }
    }
}
