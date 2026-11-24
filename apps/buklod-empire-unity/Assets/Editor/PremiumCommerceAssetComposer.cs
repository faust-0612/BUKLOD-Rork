using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Security.Cryptography;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
namespace Buklod.Empire.Editor {
    // Isolated asset review. Never replaces a production prefab, terrain, combat rig or build scene.
    public static class PremiumCommerceAssetComposer {
        const string Source="Tools/AssetCandidates/PremiumCommerce";
        const string Out=CandidateReviewComposer.Out+"/PremiumCommerce";
        [Serializable] private sealed class Manifest {public string status;public bool premiumVerified;public Row[] models;}
        [Serializable] private sealed class Row {public string file,hero,gear,gitBlob;public int triangles,bufferBytes;}
        static readonly string[] Teams={"lux","tenebra"};
        static GameObject BasePrefab(string name){
            var p=AssetDatabase.LoadAssetAtPath<GameObject>(CandidateReviewComposer.Out+"/Prefabs/"+name+".prefab");
            if(!p)throw new InvalidOperationException("Assemble base candidate prefabs first: "+name);
            return p;
        }
        static Material Variant(Material original,string team,Dictionary<Material,Material> cache){
            if(!original)return original;
            // Tint only named armor, fabric, stonework and trim; leave skin, eyes, gems and team identifiers alone.
            string n=original.name.ToLowerInvariant();
            if(n.Contains("skin")||n.Contains("eye")||n.Contains("hair")||n.Contains("stone_")||n.Contains("glow")||n.Contains("team")||n.Contains("water")||n.Contains("lane"))return original;
            if(!new[]{"armor","trim","fabric","leather","metal","masonry","roof"}.Any(k=>n.Contains(k)))return original;
            if(cache.TryGetValue(original,out var cached))return cached;
            var mat=new Material(original);
            var color=team=="lux"?new Color(.85f,.71f,.42f):new Color(.41f,.31f,.64f);
            string property=mat.HasProperty("_BaseColor")?"_BaseColor":mat.HasProperty("_Color")?"_Color":null;
            if(property!=null)mat.SetColor(property,Color.Lerp(mat.GetColor(property),color,.38f));
            if(mat.HasProperty("_Metallic")&&(n.Contains("armor")||n.Contains("trim")||n.Contains("metal")))mat.SetFloat("_Metallic",.78f);
            if(mat.HasProperty("_Smoothness")&&(n.Contains("armor")||n.Contains("trim")||n.Contains("metal")))mat.SetFloat("_Smoothness",.72f);
            string asset=Out+"/Materials/"+team+"_"+cache.Count+".mat";
            var saved=AssetDatabase.LoadAssetAtPath<Material>(asset);
            if(saved){EditorUtility.CopySerialized(mat,saved);UnityEngine.Object.DestroyImmediate(mat);mat=saved;EditorUtility.SetDirty(mat);}
            else AssetDatabase.CreateAsset(mat,asset);
            cache.Add(original,mat);return mat;
        }
        static GameObject FactionVariant(string id,string team,Dictionary<Material,Material> cache){
            var instance=(GameObject)PrefabUtility.InstantiatePrefab(BasePrefab(id));
            try{
                if(PrefabUtility.IsPartOfPrefabInstance(instance))PrefabUtility.UnpackPrefabInstance(instance,PrefabUnpackMode.Completely,InteractionMode.AutomatedAction);
                foreach(var r in instance.GetComponentsInChildren<Renderer>(true)){
                    var old=r.sharedMaterials;for(int i=0;i<old.Length;i++)old[i]=Variant(old[i],team,cache);r.sharedMaterials=old;
                }
                var saved=PrefabUtility.SaveAsPrefabAsset(instance,Out+"/Prefabs/"+id+"_royal.prefab");
                if(!saved)throw new InvalidOperationException("Faction variant save failed: "+id);
                return saved;
            }finally{UnityEngine.Object.DestroyImmediate(instance);}
        }
        static void Place(GameObject prefab,Transform root,Vector3 at){
            var g=(GameObject)PrefabUtility.InstantiatePrefab(prefab);g.transform.SetParent(root,false);g.transform.localPosition=at;
        }
        [MenuItem("BUKLOD Empire/Assemble premium relic and faction review")]
        public static void Prepare(){
            if(EditorSceneManager.GetActiveScene().isDirty)throw new InvalidOperationException("Save open scene first.");
            var m=JsonUtility.FromJson<Manifest>(File.ReadAllText(Source+"/manifest.json"));
            if(m==null||m.status!="REVIEW_ONLY"||m.premiumVerified||m.models==null||m.models.Length!=HeroKitCatalog.All.Count)throw new InvalidOperationException("Incomplete relic roster");
            var seen=new HashSet<string>();
            foreach(var row in m.models){
                if(row==null||!HeroKitCatalog.All.Any(h=>h.Id==row.hero)||!seen.Add(row.hero)||row.file!=row.hero+"_relic.gltf"||row.triangles<100||row.bufferBytes<=0)throw new InvalidOperationException("Invalid relic identity");
                if(!File.Exists(Source+"/"+row.file))throw new FileNotFoundException(row.file);
                var data=File.ReadAllBytes(Source+"/"+row.file);
                var header=Encoding.ASCII.GetBytes("blob "+data.Length+"\0");
                using(var sha=SHA1.Create()){
                    string actual=BitConverter.ToString(sha.ComputeHash(header.Concat(data).ToArray())).Replace("-","").ToLowerInvariant();
                    if(actual!=row.gitBlob)throw new InvalidOperationException("Relic source integrity mismatch: "+row.hero);
                }
            }
            // Check all base assets before changing generated outputs.
            foreach(var team in Teams){
                foreach(var role in CandidateReviewComposer.Roles.Concat(team=="lux"?CandidateReviewComposer.LuxVillagers:CandidateReviewComposer.TenebraVillagers))BasePrefab(team+"_"+role);
                BasePrefab(team+"_tower_candidate");BasePrefab(team+"_core_candidate");
            }
            foreach(var d in new[]{"Models","Prefabs","Materials"})Directory.CreateDirectory(Out+"/"+d);
            foreach(var row in m.models)File.Copy(Source+"/"+row.file,Out+"/Models/"+row.file,true);
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            var relics=new List<GameObject>();
            foreach(var h in HeroKitCatalog.All){
                var model=AssetDatabase.LoadAssetAtPath<GameObject>(Out+"/Models/"+h.Id+"_relic.gltf");
                if(!model||!model.GetComponentInChildren<MeshFilter>(true))throw new InvalidOperationException("glTF relic import failed: "+h.Id);
                relics.Add(model);
            }
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var root=new GameObject("UNAPPROVED revenue asset review").transform;
            for(int i=0;i<relics.Count;i++)Place(relics[i],root,new Vector3(i%7*2.4f,1, i/7*3f));
            int rowIndex=0;
            foreach(var team in Teams){
                var cache=new Dictionary<Material,Material>();
                var ids=CandidateReviewComposer.Roles.Concat(team=="lux"?CandidateReviewComposer.LuxVillagers:CandidateReviewComposer.TenebraVillagers).Select(x=>team+"_"+x).Concat(new[]{team+"_tower_candidate",team+"_core_candidate"}).ToArray();
                for(int i=0;i<ids.Length;i++)Place(FactionVariant(ids[i],team,cache),root,new Vector3(i%7*4f,0,7+rowIndex*10+i/7*4f));
                rowIndex++;
            }
            var ground=GameObject.CreatePrimitive(PrimitiveType.Plane);ground.name="Gallery floor";ground.transform.position=new Vector3(12,-.05f,11);ground.transform.localScale=new Vector3(3.2f,1,3.1f);
            var light=new GameObject("Review key",typeof(Light)).GetComponent<Light>();light.type=LightType.Directional;light.intensity=1.6f;light.transform.rotation=Quaternion.Euler(45,-35,0);
            RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.36f,.40f,.48f);
            var cam=new GameObject("Review camera",typeof(Camera)).GetComponent<Camera>();cam.orthographic=true;cam.orthographicSize=19;cam.transform.position=new Vector3(12,27,-18);cam.transform.LookAt(new Vector3(12,0,11));
            if(!EditorSceneManager.SaveScene(scene,Out+"/RelicFactionReview.unity"))throw new InvalidOperationException("Review scene save failed");
            AssetDatabase.SaveAssets();
            Debug.Log("13 relics and 26 faction variant candidates imported. Inspect actual render and rig; no approval or live changes.");
        }
    }
}
