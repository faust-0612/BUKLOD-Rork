using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
namespace Buklod.Empire.Editor {
    public static class PremiumCinematicReviewComposer {
        [MenuItem("BUKLOD Empire/Assemble premium cinematic review")]
        public static void Prepare(){
            if(EditorSceneManager.GetActiveScene().isDirty)throw new InvalidOperationException("Save open scene first.");
            const string path=CandidateReviewComposer.Out;
            var models=new List<GameObject>();var labels=new List<string>();
            foreach(var h in HeroKitCatalog.All)foreach(var style in new[]{"original","radiant","nightwatch","legendary","mythical"}){
                var prefab=AssetDatabase.LoadAssetAtPath<GameObject>(path+"/Prefabs/"+h.Id+"_"+style+".prefab");
                if(!prefab)throw new InvalidOperationException("Assemble 65 cosmetic review prefabs first.");
                models.Add(prefab);labels.Add(h.Id+"/"+style);
            }
            var shader=Shader.Find("BUKLOD/CombatPulse");
            if(!shader||!shader.isSupported)throw new InvalidOperationException("Combat pulse shader unavailable.");
            string materialPath=path+"/PremiumCinematicReview.mat";
            var mat=AssetDatabase.LoadAssetAtPath<Material>(materialPath);
            if(!mat){mat=new Material(shader);AssetDatabase.CreateAsset(mat,materialPath);}
            else if(mat.shader!=shader){mat.shader=shader;EditorUtility.SetDirty(mat);}
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var stage=new GameObject("REVIEW ONLY Premium Cinematic Stage",typeof(PremiumCinematicStage)).GetComponent<PremiumCinematicStage>();
            stage.pulseMaterial=mat;stage.heroes=models.ToArray();stage.labels=labels.ToArray();
            var floor=GameObject.CreatePrimitive(PrimitiveType.Cylinder);floor.name="Review plinth";floor.transform.position=new Vector3(0,-.13f,0);floor.transform.localScale=new Vector3(4,.12f,4);
            var cam=new GameObject("Portrait stage camera",typeof(Camera)).GetComponent<Camera>();cam.transform.position=new Vector3(3.6f,2.2f,5.1f);cam.transform.LookAt(new Vector3(0,1.15f,0));cam.fieldOfView=32;cam.clearFlags=CameraClearFlags.SolidColor;cam.backgroundColor=new Color(.035f,.05f,.09f);stage.stageCamera=cam;
            foreach(var pos in new[]{new Vector3(35,-35,0),new Vector3(55,145,0)}){
                var light=new GameObject("Stage light",typeof(Light)).GetComponent<Light>();light.type=LightType.Directional;light.intensity=1.5f;light.transform.rotation=Quaternion.Euler(pos);light.color=pos.y<0?new Color(1,.89f,.72f):new Color(.55f,.72f,1);
            }
            RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.37f,.41f,.49f);
            if(!EditorSceneManager.SaveScene(scene,path+"/PremiumCinematicReview.unity"))throw new InvalidOperationException("Stage save failed.");
            AssetDatabase.SaveAssets();
            Debug.Log("Premium cinematic review prepared. Open Play Mode to review 65 variants and four effect patterns. No production approval.");
        }
    }
}
