using System;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Buklod.Empire.Editor {
    // Creates a separate playable look-development scene from the actual offline battle.
    // No production assets, build settings, global pipeline settings or source prefabs are modified.
    public static class StylizedArenaBenchmark {
        public const string ScenePath=CandidateReviewComposer.Out+"/StylizedPhanBenchmark.unity";
        const string GradePath=CandidateReviewComposer.Out+"/StylizedPhanGrade.asset";
        [MenuItem("BUKLOD Empire/Visual benchmark/Assemble Phan stylized review")]
        public static void Prepare(){
            if(Application.isPlaying||EditorSceneManager.GetActiveScene().isDirty)
                throw new InvalidOperationException("Stop play mode and save the scene first.");
            if(!(GraphicsSettings.currentRenderPipeline is UniversalRenderPipelineAsset))
                throw new InvalidOperationException("A configured URP pipeline is required.");
            if(!AssetDatabase.LoadAssetAtPath<SceneAsset>(OfflineReviewComposer.ScenePath))
                throw new InvalidOperationException("Assemble consolidated offline review first.");
            var scene=EditorSceneManager.OpenScene(OfflineReviewComposer.ScenePath,OpenSceneMode.Single);
            // Copy first: the original review scene remains intact even if later setup fails.
            if(!EditorSceneManager.SaveScene(scene,ScenePath))
                throw new InvalidOperationException("Benchmark copy failed.");
            var view=UnityEngine.Object.FindFirstObjectByType<BattleView>();
            if(!view||!view.IsConfiguredReview||!view.visuals||!view.battleCamera)
                throw new InvalidOperationException("Missing real offline battle.");
            view.visuals.ValidateOfflineReview();
            view.selectedHero="phan";view.ConfigureStylizedBenchmark();
            var camera=view.battleCamera;
            camera.orthographic=true;camera.orthographicSize=StylizedArenaPresentation.OrthographicSize;
            camera.transform.rotation=StylizedArenaPresentation.CameraRotation;
            camera.nearClipPlane=.2f;camera.farClipPlane=130f;
            camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.17f,.23f,.31f);
            var sun=UnityEngine.Object.FindObjectsByType<Light>(FindObjectsSortMode.None).FirstOrDefault(l=>l.type==LightType.Directional);
            if(!sun)throw new InvalidOperationException("Review directional light missing.");
            sun.color=new Color(1f,.88f,.69f);sun.intensity=1.25f;
            sun.shadows=LightShadows.Soft;sun.transform.rotation=Quaternion.Euler(52,-38,0);
            RenderSettings.ambientMode=AmbientMode.Trilight;
            RenderSettings.ambientSkyColor=new Color(.50f,.60f,.73f);
            RenderSettings.ambientEquatorColor=new Color(.36f,.43f,.47f);
            RenderSettings.ambientGroundColor=new Color(.24f,.27f,.29f);
            RenderSettings.fog=false; // do not wash out the orthographic playfield
            RenderSettings.reflectionIntensity=.65f;
            foreach(var volume in UnityEngine.Object.FindObjectsByType<Volume>(FindObjectsSortMode.None))
                if(volume.isGlobal)volume.enabled=false;
            var grade=AssetDatabase.LoadAssetAtPath<VolumeProfile>(GradePath);
            if(!grade){grade=ScriptableObject.CreateInstance<VolumeProfile>();AssetDatabase.CreateAsset(grade,GradePath);}
            var tone=Get<Tonemapping>(grade);tone.mode.Override(TonemappingMode.Neutral);
            var color=Get<ColorAdjustments>(grade);color.postExposure.Override(.10f);color.contrast.Override(8f);color.saturation.Override(2f);
            var bloom=Get<Bloom>(grade);bloom.threshold.Override(1.4f);bloom.intensity.Override(.12f);bloom.scatter.Override(.55f);
            EditorUtility.SetDirty(tone);EditorUtility.SetDirty(color);EditorUtility.SetDirty(bloom);EditorUtility.SetDirty(grade);
            var look=new GameObject("Stylized benchmark grade",typeof(Volume)).GetComponent<Volume>();
            look.isGlobal=true;look.priority=20;look.sharedProfile=grade;
            var cameraData=camera.GetUniversalAdditionalCameraData();
            cameraData.renderPostProcessing=true;cameraData.volumeLayerMask=cameraData.volumeLayerMask.value|(1<<look.gameObject.layer);
            AuthoredNatureBenchmark.Apply();
            EditorSceneManager.MarkSceneDirty(scene);
            if(!EditorSceneManager.SaveScene(scene))throw new InvalidOperationException("Benchmark scene save failed.");
            AssetDatabase.SaveAssets();
            Debug.Log("Stylized Phan benchmark prepared. Play with existing Arena menu and controls. This is not visual acceptance or an APK.");
        }
        static T Get<T>(VolumeProfile profile) where T:VolumeComponent {
            if(profile.TryGet<T>(out var component))return component;
            component=profile.Add<T>(true);component.name=typeof(T).Name;AssetDatabase.AddObjectToAsset(component,profile);return component;
        }
    }
}
