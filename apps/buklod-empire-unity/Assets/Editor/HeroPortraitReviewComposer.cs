using System;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
namespace Buklod.Empire.Editor {
    // Close-up full-detail art acceptance stage, never a player scene.
    public static class HeroPortraitReviewComposer {
        const string Out=CandidateReviewComposer.Out;
        [MenuItem("BUKLOD Empire/Assemble selected hero portrait review")]
        public static void PrepareSelected(){
            var selected=Selection.activeObject;
            string id=selected?selected.name:"phan";
            if(!HeroKitCatalog.All.Any(h=>h.Id==id))id="phan";
            Prepare(id);
        }
        public static void Prepare(string heroId){
            HeroKitCatalog.Get(heroId);
            if(EditorSceneManager.GetActiveScene().isDirty)throw new InvalidOperationException("Save the open scene first.");
            if(!(GraphicsSettings.currentRenderPipeline is UniversalRenderPipelineAsset))throw new InvalidOperationException("Configure URP before portrait review.");
            var prefab=AssetDatabase.LoadAssetAtPath<GameObject>(Out+"/Prefabs/"+heroId+".prefab");
            if(!prefab)throw new InvalidOperationException("Run candidate import first: "+heroId);
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var actor=(GameObject)PrefabUtility.InstantiatePrefab(prefab,scene);
            actor.name=heroId+" — unapproved portrait review";
            foreach(var lod in actor.GetComponentsInChildren<LODGroup>(true))lod.ForceLOD(0);
            var skins=actor.GetComponentsInChildren<SkinnedMeshRenderer>(true);
            if(skins.Length==0)throw new InvalidOperationException("No hero skin found.");
            Bounds bounds=skins[0].bounds;foreach(var skin in skins.Skip(1))bounds.Encapsulate(skin.bounds);
            float height=bounds.size.y;
            if(height<.1f||height>20f)throw new InvalidOperationException("Unexpected portrait model scale.");
            var focus=bounds.center+Vector3.up*(height*.05f);
            var camera=new GameObject("Full-detail portrait camera",typeof(Camera)).GetComponent<Camera>();
            camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.018f,.027f,.045f);
            camera.fieldOfView=34;camera.nearClipPlane=.02f;camera.farClipPlane=100;camera.allowHDR=true;
            // glTF models preserve their imported orientation; front view is +Z.
            float distance=Mathf.Max(height,bounds.size.x)*2.05f;
            camera.transform.position=focus+new Vector3(.32f,.13f,1f).normalized*distance;
            camera.transform.LookAt(focus);camera.tag="MainCamera";
            var close=new GameObject("Face and armor detail camera",typeof(Camera)).GetComponent<Camera>();
            close.CopyFrom(camera);close.enabled=false;close.fieldOfView=29;
            var upper=focus+Vector3.up*(height*.27f);
            close.transform.position=upper+new Vector3(.20f,.03f,1).normalized*height*.85f;close.transform.LookAt(upper);
            var key=MakeLight("Warm soft key",new Color(1,.92f,.84f),1.35f,new Vector3(35,145,0),true);
            key.shadowBias=.04f;key.shadowNormalBias=.25f;
            MakeLight("Cool fill",new Color(.63f,.79f,1),.45f,new Vector3(18,230,0),false);
            MakeLight("Rim",new Color(.58f,.82f,1),.9f,new Vector3(28,-15,0),false);
            RenderSettings.sun=key;RenderSettings.fog=false;RenderSettings.ambientMode=AmbientMode.Trilight;
            RenderSettings.ambientSkyColor=new Color(.30f,.36f,.46f);
            RenderSettings.ambientEquatorColor=new Color(.20f,.23f,.29f);
            RenderSettings.ambientGroundColor=new Color(.09f,.10f,.13f);
            RenderSettings.defaultReflectionMode=DefaultReflectionMode.Custom;
            RenderSettings.customReflectionTexture=EnvironmentReviewLook.ReviewSkyReflection();
            RenderSettings.reflectionIntensity=.65f;
            var shader=Shader.Find("Universal Render Pipeline/Lit");if(!shader)throw new InvalidOperationException("URP Lit missing.");
            var path=Out+"/PortraitStage.mat";var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(!mat){mat=new Material(shader);AssetDatabase.CreateAsset(mat,path);}
            mat.SetColor("_BaseColor",new Color(.075f,.09f,.12f));mat.SetFloat("_Metallic",.3f);mat.SetFloat("_Smoothness",.55f);EditorUtility.SetDirty(mat);
            var stage=GameObject.CreatePrimitive(PrimitiveType.Cylinder);stage.name="Portrait pedestal";
            stage.transform.position=new Vector3(bounds.center.x,bounds.min.y-height*.035f,bounds.center.z);
            stage.transform.localScale=new Vector3(height*.92f,height*.035f,height*.92f);
            stage.GetComponent<Renderer>().sharedMaterial=mat;
            var collider=stage.GetComponent<Collider>();if(collider)UnityEngine.Object.DestroyImmediate(collider);
            var profilePath=Out+"/PortraitVolume.asset";
            var profile=AssetDatabase.LoadAssetAtPath<VolumeProfile>(profilePath);
            if(!profile){
                profile=ScriptableObject.CreateInstance<VolumeProfile>();AssetDatabase.CreateAsset(profile,profilePath);
                foreach(var c in new VolumeComponent[]{profile.Add<Bloom>(true),profile.Add<Tonemapping>(true),profile.Add<ColorAdjustments>(true)})AssetDatabase.AddObjectToAsset(c,profile);
            }
            if(!profile.TryGet<Bloom>(out var bloom)||!profile.TryGet<Tonemapping>(out var tone)||!profile.TryGet<ColorAdjustments>(out var grade))throw new InvalidOperationException("Portrait profile incomplete.");
            bloom.threshold.Override(1.1f);bloom.intensity.Override(.18f);bloom.scatter.Override(.55f);
            tone.mode.Override(TonemappingMode.Neutral);grade.contrast.Override(12);grade.saturation.Override(4);grade.postExposure.Override(-.35f);
            foreach(var c in new VolumeComponent[]{bloom,tone,grade})EditorUtility.SetDirty(c);EditorUtility.SetDirty(profile);
            var volume=new GameObject("Portrait grade",typeof(Volume)).GetComponent<Volume>();volume.isGlobal=true;volume.priority=10;volume.sharedProfile=profile;
            foreach(var cam in new[]{camera,close}){var data=cam.GetUniversalAdditionalCameraData();data.renderPostProcessing=true;data.antialiasing=AntialiasingMode.SubpixelMorphologicalAntiAliasing;data.antialiasingQuality=AntialiasingQuality.High;data.volumeLayerMask=data.volumeLayerMask.value|(1<<volume.gameObject.layer);}
            if(!EditorSceneManager.SaveScene(scene,Out+"/HeroPortrait_"+heroId+".unity"))throw new InvalidOperationException("Could not save portrait review.");
            AssetDatabase.SaveAssets();
            Debug.Log("Full-detail portrait stage prepared for "+heroId+". Switch between the two cameras to inspect face and equipment. Not a visual approval.");
        }
        static Light MakeLight(string name,Color color,float intensity,Vector3 rotation,bool shadows){
            var l=new GameObject(name,typeof(Light)).GetComponent<Light>();l.type=LightType.Directional;l.color=color;l.intensity=intensity;l.transform.rotation=Quaternion.Euler(rotation);l.shadows=shadows?LightShadows.Soft:LightShadows.None;return l;
        }
    }
}
