using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Isolated candidate gallery only. No camp spawns, resource stock or gameplay colliders.
    public static class WildlifeReviewComposer {
        const string Out=CandidateReviewComposer.Out;
        const string Source="Tools/ReviewOutput/wildlife";
        static readonly string[] Creatures={"azure_stag","crimson_wolf","emerald_serpent","golden_scarab","stone_golem","river_spirit","wind_falcon","ancient_sentinel","colossal_guardian"};
        static readonly string[] Resources={"wood","stone","crystal","gold","food"};
        static readonly string[] Clips={"Idle","Walk","Attack","Hit","Death","Roar"};
        [Serializable] sealed class Receipt {public string status;public Row[] models;}
        [Serializable] sealed class Row {public string id,kind,file,sha256;public int bytes,triangles,bones,clips;}
        static string Hash(string path){
            using(var f=File.OpenRead(path))using(var h=SHA256.Create())
                return BitConverter.ToString(h.ComputeHash(f)).Replace("-","").ToLowerInvariant();
        }
        internal static Dictionary<string,GameObject> ImportReviewPrefabs(){
            string path=Source+"/manifest.json";
            if(!File.Exists(path))throw new InvalidOperationException("Run node Tools/wildlife-review.mjs first.");
            var manifest=JsonUtility.FromJson<Receipt>(File.ReadAllText(path));
            if(manifest==null||manifest.status!="REVIEW_ONLY"||manifest.models==null||manifest.models.Length!=14)
                throw new InvalidOperationException("Incomplete wildlife roster.");
            var expected=new HashSet<string>(Creatures.Concat(Resources),StringComparer.Ordinal);
            foreach(var row in manifest.models){
                if(row==null||!expected.Remove(row.id)||row.file!=row.id+".glb"||row.triangles<=0)
                    throw new InvalidOperationException("Invalid wildlife identity.");
                bool creature=Creatures.Contains(row.id);
                if(row.kind!=(creature?"creature":"resource")||row.bones!=(creature?8:0)||row.clips!=(creature?6:0))
                    throw new InvalidOperationException("Invalid wildlife rig metadata.");
                string file=Source+"/"+row.file;
                if(!File.Exists(file)||new FileInfo(file).Length!=row.bytes||Hash(file)!=row.sha256)
                    throw new InvalidOperationException("Wildlife hash mismatch: "+row.id);
            }
            if(expected.Count!=0)throw new InvalidOperationException("Incomplete wildlife roster.");
            foreach(var dir in new[]{"Models","Prefabs","Controllers","Clips"})Directory.CreateDirectory(Out+"/"+dir);
            foreach(var row in manifest.models)File.Copy(Source+"/"+row.file,Out+"/Models/wildlife_"+row.file,true);
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            bool wildlifeHd=WildlifeMaterialReview.Prepare();
            var prefabs=new Dictionary<string,GameObject>();
            foreach(var row in manifest.models)prefabs.Add(row.id,CandidateReviewComposer.MakePrefab("wildlife_"+row.id,Creatures.Contains(row.id)?Clips:Array.Empty<string>(),wildlifeHd:wildlifeHd&&Creatures.Contains(row.id)));
            AssetDatabase.SaveAssets();return prefabs;
        }
        [MenuItem("BUKLOD Empire/Assemble wildlife and resource review")]
        public static void Prepare(){
            if(EditorSceneManager.GetActiveScene().isDirty)throw new InvalidOperationException("Save the open scene first.");
            var prefabs=ImportReviewPrefabs();
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var root=new GameObject("UNAPPROVED wildlife and resource candidates");
            for(int i=0;i<Creatures.Length;i++){
                var obj=(GameObject)PrefabUtility.InstantiatePrefab(prefabs[Creatures[i]],scene);
                obj.transform.SetParent(root.transform,false);obj.transform.position=new Vector3((i%5)*7,0,(i/5)*8);
            }
            for(int i=0;i<Resources.Length;i++){
                var obj=(GameObject)PrefabUtility.InstantiatePrefab(prefabs[Resources[i]],scene);
                obj.transform.SetParent(root.transform,false);obj.transform.position=new Vector3(i*7,0,17);
            }
            var ground=GameObject.CreatePrimitive(PrimitiveType.Plane);
            ground.name="Review floor";ground.transform.position=new Vector3(14,-.25f,8.5f);ground.transform.localScale=new Vector3(3.6f,1,2.6f);
            var sun=new GameObject("Review key",typeof(Light)).GetComponent<Light>();
            sun.type=LightType.Directional;sun.intensity=1.7f;sun.color=new Color(1,.92f,.8f);sun.shadows=LightShadows.Soft;sun.transform.rotation=Quaternion.Euler(45,-35,0);
            var fill=new GameObject("Review fill",typeof(Light)).GetComponent<Light>();
            fill.type=LightType.Directional;fill.intensity=.5f;fill.color=new Color(.55f,.75f,1);fill.transform.rotation=Quaternion.Euler(25,145,0);
            var cam=new GameObject("Wildlife review camera",typeof(Camera)).GetComponent<Camera>();
            cam.orthographic=true;cam.orthographicSize=22;cam.farClipPlane=160;cam.transform.position=new Vector3(14,30,-27);cam.transform.LookAt(new Vector3(14,1,9));
            if(!EditorSceneManager.SaveScene(scene,Out+"/WildlifeReview.unity"))throw new InvalidOperationException("Wildlife gallery save failed.");
            AssetDatabase.SaveAssets();
            Debug.Log("Nine creature and five resource review prefabs assembled. No gameplay integration or approval.");
        }
    }
}
