using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace Buklod.Empire.Editor {
    // A private offline APK must not silently regenerate the previous procedural roster.
    // Missing authored inputs stop the build before scene assembly, not after APK compilation.
    internal static class AuthoredRosterBuildGate {
        const string Source="Tools/ReviewOutput/authored-roster";
        const string Generated=CandidateReviewComposer.Out+"/Models";
        [Serializable] internal sealed class Row {
            public string id,fullSha256,lodSha256,author,sourceUrl,license,licenseEvidence,identityEvidence;
        }
        [Serializable] internal sealed class Manifest {
            public string status;
            public Row[] heroes;
        }
        static Dictionary<string,Row> rows;
        internal static bool Active=>rows!=null;
        sealed class Lease:IDisposable {public void Dispose(){rows=null;}}
        static string Hash(string path){
            if(!File.Exists(path))throw new BuildFailedException("Missing authored hero input: "+path);
            using(var f=File.OpenRead(path))using(var sha=SHA256.Create())
                return BitConverter.ToString(sha.ComputeHash(f)).Replace("-","").ToLowerInvariant();
        }
        static bool IsHash(string h)=>h!=null&&h.Length==64&&h.All(c=>c>='0'&&c<='9'||c>='a'&&c<='f');
        internal static bool ValidRow(Row r){
            if(r==null||!HeroKitCatalog.All.Any(h=>h.Id==r.id)||!IsHash(r.fullSha256)||!IsHash(r.lodSha256)||r.fullSha256==r.lodSha256||
               string.IsNullOrWhiteSpace(r.author)||string.IsNullOrWhiteSpace(r.licenseEvidence)||string.IsNullOrWhiteSpace(r.identityEvidence)||
               (r.license!="CC0-1.0"&&r.license!="CC-BY-4.0"))return false;
            return Uri.TryCreate(r.sourceUrl,UriKind.Absolute,out var uri)&&uri.Scheme=="https"&&string.IsNullOrEmpty(uri.UserInfo);
        }
        static string Full(string id)=>Source+"/full/"+id+".glb";
        static string Lod(string id)=>Source+"/lod/"+id+".glb";
        internal static IDisposable Begin(){
            if(Active)throw new BuildFailedException("Authored roster scope already active.");
            string manifest=Source+"/manifest.json";
            if(!File.Exists(manifest))throw new BuildFailedException("NEW HERO ROSTER REQUIRED BEFORE APK: "+manifest+". The old generated heroes must not be rebuilt as a visual upgrade.");
            var m=JsonUtility.FromJson<Manifest>(File.ReadAllText(manifest));
            if(m==null||m.status!="AUTHORED_ROSTER_PRIVATE_CANDIDATE"||m.heroes==null||m.heroes.Length!=HeroKitCatalog.All.Count)
                throw new BuildFailedException("All 13 authored hero inputs required.");
            var result=new Dictionary<string,Row>(StringComparer.Ordinal);
            var hashes=new HashSet<string>(StringComparer.Ordinal);
            foreach(var r in m.heroes){
                if(!ValidRow(r)||result.ContainsKey(r.id)||!hashes.Add(r.fullSha256)||!hashes.Add(r.lodSha256))
                    throw new BuildFailedException("Invalid, duplicated, or undocumented authored hero.");
                if(Hash(Full(r.id))!=r.fullSha256||Hash(Lod(r.id))!=r.lodSha256)
                    throw new BuildFailedException("Authored hero hash mismatch: "+r.id);
                // The existing generated baseline remains the comparison, never a fallback.
                if(Hash("Tools/ReviewOutput/heroes/"+r.id+".glb")==r.fullSha256||
                   Hash("Tools/ReviewOutput/hero-lod/"+r.id+".glb")==r.lodSha256)
                    throw new BuildFailedException("Unchanged legacy hero geometry input: "+r.id);
                result.Add(r.id,r);
            }
            rows=result;return new Lease();
        }
        internal static string FullPath(string id){
            if(!Active)return null;
            if(!rows.TryGetValue(id,out var row)||Hash(Full(id))!=row.fullSha256)
                throw new BuildFailedException("Authored hero source changed: "+id);
            return Full(id);
        }
        internal static void CopyLods(string target){
            if(!Active)throw new BuildFailedException("Missing authored roster scope.");
            foreach(var pair in rows)if(Hash(Lod(pair.Key))!=pair.Value.lodSha256)
                throw new BuildFailedException("Authored LOD source changed: "+pair.Key);
            foreach(var pair in rows)File.Copy(Lod(pair.Key),target+"/"+pair.Key+"_lod1.glb",true);
        }
        internal static void ValidateDependencies(HashSet<string> dependencies){
            if(!Active)throw new BuildFailedException("APK/preflight requires an active authored roster scope.");
            var catalog=AssetDatabase.LoadAssetAtPath<BattleVisualCatalog>(CandidateReviewComposer.Out+"/OfflineReviewCatalog.asset");
            if(!catalog)throw new BuildFailedException("Offline review catalog missing.");
            foreach(var pair in rows){
                string id=pair.Key,full=Generated+"/"+id+".glb",lod=Generated+"/"+id+"_lod1.glb";
                if(!dependencies.Contains(full)||!dependencies.Contains(lod)||Hash(full)!=pair.Value.fullSha256||Hash(lod)!=pair.Value.lodSha256)
                    throw new BuildFailedException("New authored models not serialized in the actual APK scene: "+id);
                var hero=catalog.heroes.SingleOrDefault(h=>h.id==id);
                if(hero==null||!hero.prefab)throw new BuildFailedException("Missing actual hero prefab: "+id);
                var skins=hero.prefab.GetComponentsInChildren<SkinnedMeshRenderer>(true);
                if(!skins.Any(s=>s.sharedMesh&&AssetDatabase.GetAssetPath(s.sharedMesh)==full)||
                   !skins.Any(s=>s.sharedMesh&&AssetDatabase.GetAssetPath(s.sharedMesh)==lod))
                    throw new BuildFailedException("Hero prefab still references legacy or unrelated skin: "+id);
                foreach(var suffix in new[]{".tga","-full.tga"})
                    if(!dependencies.Contains(CandidateReviewComposer.Out+"/Portraits/"+id+suffix))
                        throw new BuildFailedException("New roster portrait dependency missing: "+id);
            }
            string material=CandidateReviewComposer.Out+"/ReviewPremiumSkillSurface.mat";
            var mat=AssetDatabase.LoadAssetAtPath<Material>(material);
            if(!dependencies.Contains(material)||!mat||!mat.shader||mat.shader.name!="BUKLOD/PremiumSkillSurface"||
               !mat.shader.isSupported||ShaderUtil.ShaderHasError(mat.shader))
                throw new BuildFailedException("New cinematic skill surfaces not serialized in APK scene.");
            Debug.Log("BUKLOD_AUTHORED_ROSTER_DEPENDENCIES_PASS — 13 exact source/LOD pairs bound to gameplay and portraits. No visual approval inferred.");
        }
    }
}
