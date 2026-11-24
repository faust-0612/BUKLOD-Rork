using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
namespace Buklod.Empire.Editor {
    // Isolated review, never a production catalog or gameplay change.
    public static class PremiumTransformationReviewComposer {
        const string Out=CandidateReviewComposer.Out+"/PremiumCommerce";
        static GameObject Prefab(string id){
            var p=AssetDatabase.LoadAssetAtPath<GameObject>(CandidateReviewComposer.Out+"/Prefabs/"+id+".prefab");
            if(!p)throw new InvalidOperationException("Missing review prefab "+id);return p;
        }
        static Material Mat(string id,Color color,float metal,float gloss){
            var shader=Shader.Find("Universal Render Pipeline/Lit");
            if(!shader)throw new InvalidOperationException("URP Lit shader required");
            string path=Out+"/Materials/"+id+".mat";
            var m=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(!m){m=new Material(shader);AssetDatabase.CreateAsset(m,path);}
            m.shader=shader;m.SetColor("_BaseColor",color);m.SetFloat("_Metallic",metal);m.SetFloat("_Smoothness",gloss);EditorUtility.SetDirty(m);return m;
        }
        static Transform Joint(GameObject actor,string name){
            var matches=actor.GetComponentsInChildren<Transform>(true).Where(t=>t.name==name).ToArray();
            if(matches.Length!=1)throw new InvalidOperationException("Expected one joint "+name);return matches[0];
        }
        static void Shape(Transform parent,string name,PrimitiveType type,Vector3 at,Vector3 scale,Vector3 rotation,Material material){
            var g=GameObject.CreatePrimitive(type);g.name=name;g.transform.SetParent(parent,false);g.transform.localPosition=at;g.transform.localScale=scale;g.transform.localRotation=Quaternion.Euler(rotation);
            var collider=g.GetComponent<Collider>();if(collider)UnityEngine.Object.DestroyImmediate(collider);g.GetComponent<Renderer>().sharedMaterial=material;
        }
        static void Decorate(GameObject actor,string id,int index){
            if(!SacredStoneCatalog.TryGet(id,out var stone))throw new InvalidOperationException("Missing stone");
            var gold=Mat(id+"_transform_gold",new Color(.84f,.66f,.32f),.88f,.72f);
            var accent=Mat(id+"_transform_accent",stone.Accent,.68f,.66f);
            var chest=Joint(actor,"Chest");
            for(int side=-1;side<=1;side+=2){
                var arm=Joint(actor,side<0?"UpperArm_L":"UpperArm_R");
                for(int k=0;k<3;k++){
                    Shape(arm,"Shoulder plate "+k,PrimitiveType.Sphere,new Vector3(side*(.025f+k*.026f),-.025f-k*.033f,-.015f),new Vector3(.18f-k*.022f,.095f,.20f-k*.024f),new Vector3(0,0,side*(15+k*8)),k%2==0?gold:accent);
                    Shape(chest,"Backcrest "+side+" "+k,PrimitiveType.Cube,new Vector3(side*(.12f+k*.062f),.07f+k*.025f,-.17f),new Vector3(.035f,.17f+.028f*(index%4)+.032f*k,.045f),new Vector3(0,0,-side*(20+10*k+index%5*3)),k==1?accent:gold);
                }
            }
        }
        [MenuItem("BUKLOD Empire/Assemble transformation and battlefield themes")]
        public static void Prepare(){
            if(EditorSceneManager.GetActiveScene().isDirty)throw new InvalidOperationException("Save open scene first");
            foreach(var h in HeroKitCatalog.All)Prefab(h.Id+"_mythical");
            var map=Prefab("genesis_rift_candidate");
            foreach(var d in new[]{"Prefabs","Materials"})Directory.CreateDirectory(Out+"/"+d);
            AssetDatabase.Refresh();
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var root=new GameObject("REVIEW ONLY hero transformations").transform;
            int i=0;
            foreach(var h in HeroKitCatalog.All){
                var actor=(GameObject)PrefabUtility.InstantiatePrefab(Prefab(h.Id+"_mythical"));
                if(PrefabUtility.IsPartOfPrefabInstance(actor))PrefabUtility.UnpackPrefabInstance(actor,PrefabUnpackMode.Completely,InteractionMode.AutomatedAction);
                Decorate(actor,h.Id,i);
                if(!PrefabUtility.SaveAsPrefabAsset(actor,Out+"/Prefabs/"+h.Id+"_transformation.prefab"))throw new InvalidOperationException("Transformation save failed");
                actor.transform.SetParent(root,false);actor.transform.localPosition=new Vector3(i%7*3f,0,i/7*4f);i++;
            }
            LightAt(new Vector3(40,-40,0),new Color(1,.9f,.76f),1.5f);
            LightAt(new Vector3(50,140,0),new Color(.58f,.72f,1),.8f);
            RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.4f,.44f,.5f);
            CameraAt(new Vector3(9,16,-16),new Vector3(9,1,2),12);
            Save(scene,"HeroTransformationReview");
            foreach(var team in new[]{"lux","tenebra"}){
                var world=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
                var instance=(GameObject)PrefabUtility.InstantiatePrefab(map,world);
                var renderers=instance.GetComponentsInChildren<Renderer>(true);
                if(renderers.Length==0)throw new InvalidOperationException("Missing battlefield");
                var bounds=renderers[0].bounds;foreach(var r in renderers.Skip(1))bounds.Encapsulate(r.bounds);
                bool lux=team=="lux";
                // Lighting-only themes: no geometry, team cues, terrain or navigation changes.
                RenderSettings.ambientMode=AmbientMode.Trilight;
                RenderSettings.ambientSkyColor=lux?new Color(.65f,.67f,.63f):new Color(.43f,.50f,.66f);
                RenderSettings.ambientEquatorColor=lux?new Color(.49f,.47f,.42f):new Color(.37f,.40f,.48f);
                RenderSettings.ambientGroundColor=new Color(.29f,.29f,.28f);RenderSettings.fog=false;
                LightAt(new Vector3(48,-35,0),lux?new Color(1,.88f,.69f):new Color(.74f,.83f,1),1.55f);
                var span=Mathf.Max(bounds.size.x,bounds.size.z);
                var c=CameraAt(bounds.center+new Vector3(0,span*.8f,-span*.65f),bounds.center,span*.72f);c.farClipPlane=Mathf.Max(500,span*4);
                Save(world,team+"_BattlefieldThemeReview");
            }
            AssetDatabase.SaveAssets();
        }
        static void LightAt(Vector3 rotation,Color tint,float intensity){
            var l=new GameObject("Review light",typeof(Light)).GetComponent<Light>();l.type=LightType.Directional;l.color=tint;l.intensity=intensity;l.transform.rotation=Quaternion.Euler(rotation);
        }
        static Camera CameraAt(Vector3 pos,Vector3 target,float size){
            var c=new GameObject("Review camera",typeof(Camera)).GetComponent<Camera>();c.orthographic=true;c.orthographicSize=size;c.transform.position=pos;c.transform.LookAt(target);c.clearFlags=CameraClearFlags.SolidColor;c.backgroundColor=new Color(.045f,.06f,.085f);return c;
        }
        static void Save(UnityEngine.SceneManagement.Scene scene,string name){
            if(!EditorSceneManager.SaveScene(scene,Out+"/"+name+".unity"))throw new InvalidOperationException("Review save failed "+name);
        }
    }
}
