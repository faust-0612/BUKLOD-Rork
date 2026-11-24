using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Optional isolated palette review, not production variants or an entitlement system.
    public static class CosmeticReviewComposer {
        const string Out=CandidateReviewComposer.Out;
        const string Source="Tools/ReviewOutput/variants";
        static readonly string[] Styles={"original","radiant","nightwatch","legendary","mythical"};
        [Serializable] private sealed class Manifest {public string status;public Row[] variants;}
        [Serializable] private sealed class Row {public string hero,style,file,sha256,sourceSha256;public int bytes;}
        [MenuItem("BUKLOD Empire/Assemble cosmetic review gallery")]
        public static void Prepare(){
            if(EditorSceneManager.GetActiveScene().isDirty)throw new InvalidOperationException("Save open scene first.");
            if(!File.Exists(Source+"/manifest.json"))throw new InvalidOperationException("Run Tools/variant_review.py first.");
            var manifest=JsonUtility.FromJson<Manifest>(File.ReadAllText(Source+"/manifest.json"));
            if(manifest==null||manifest.status!="COSMETIC_REVIEW_ONLY"||manifest.variants==null||manifest.variants.Length!=HeroKitCatalog.All.Count*Styles.Length)throw new InvalidOperationException("Incomplete cosmetic review manifest.");
            var map=new Dictionary<string,Row>(StringComparer.Ordinal);
            foreach(var row in manifest.variants){
                if(row==null||!HeroKitCatalog.All.Any(h=>h.Id==row.hero)||!Styles.Contains(row.style)||row.file!=row.hero+"_"+row.style+".glb"||map.ContainsKey(row.file))throw new InvalidOperationException("Invalid variant identity.");
                var data=File.ReadAllBytes(Source+"/"+row.file);
                var source=File.ReadAllBytes("Tools/ReviewOutput/heroes/"+row.hero+".glb");
                using(var sha=SHA256.Create()){
                    string hash=BitConverter.ToString(sha.ComputeHash(data)).Replace("-","").ToLowerInvariant();
                    string sourceHash=BitConverter.ToString(sha.ComputeHash(source)).Replace("-","").ToLowerInvariant();
                    if(data.Length!=row.bytes||hash!=row.sha256||sourceHash!=row.sourceSha256)throw new InvalidOperationException("Variant integrity mismatch: "+row.file);
                }
                map.Add(row.file,row);
            }
            foreach(var hero in HeroKitCatalog.All)foreach(var style in Styles)if(!map.ContainsKey(hero.Id+"_"+style+".glb"))throw new InvalidOperationException("Missing variant.");
            foreach(var dir in new[]{"Models","Prefabs","Controllers","Clips"})Directory.CreateDirectory(Out+"/"+dir);
            foreach(var row in map.Values)File.Copy(Source+"/"+row.file,Out+"/Models/"+row.file,true);
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            var prefabs=new Dictionary<string,GameObject>();
            foreach(var row in map.Values){string id=Path.GetFileNameWithoutExtension(row.file);prefabs.Add(id,CandidateReviewComposer.MakePrefab(id,CandidateReviewComposer.HeroClips));}
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var root=new GameObject("UNAPPROVED COSMETIC PALETTE REVIEW");
            for(int i=0;i<HeroKitCatalog.All.Count;i++)for(int j=0;j<Styles.Length;j++){
                string id=HeroKitCatalog.All[i].Id+"_"+Styles[j];var actor=(GameObject)PrefabUtility.InstantiatePrefab(prefabs[id],scene);
                actor.name=id;actor.transform.SetParent(root.transform,false);actor.transform.localPosition=new Vector3(j*3.8f,0,i*3.4f);
            }
            var ground=GameObject.CreatePrimitive(PrimitiveType.Plane);ground.name="Review floor";ground.transform.position=new Vector3(7.6f,-.02f,20.4f);ground.transform.localScale=new Vector3(2.4f,1,4.7f);
            var light=new GameObject("Review light",typeof(Light)).GetComponent<Light>();light.type=LightType.Directional;light.intensity=1.4f;light.transform.rotation=Quaternion.Euler(45,-30,0);
            var camera=new GameObject("Review camera",typeof(Camera)).GetComponent<Camera>();camera.orthographic=true;camera.orthographicSize=27;camera.farClipPlane=150;camera.transform.position=new Vector3(7.6f,46,-23);camera.transform.LookAt(new Vector3(7.6f,0,20.4f));
            if(!EditorSceneManager.SaveScene(scene,Out+"/CosmeticReview.unity"))throw new InvalidOperationException("Cosmetic gallery save failed.");
            AssetDatabase.SaveAssets();
            Debug.Log("65 cosmetic review prefabs assembled. No production build or approval.");
        }
    }
}
