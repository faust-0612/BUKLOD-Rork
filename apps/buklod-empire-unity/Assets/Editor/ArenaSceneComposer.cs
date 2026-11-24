using System;
using System.IO;
using Unity.AI.Navigation;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
namespace Buklod.Empire.Editor {
    // Invoked explicitly from the Editor or cloud pre-export after production assets arrive.
    // Never creates placeholder art or starts a build.
    public static class ArenaSceneComposer {
        public const string CatalogPath="Assets/Production/VisualCatalog.asset";
        public const string ScenePath="Assets/Scenes/GenesisRift.unity";
        [MenuItem("BUKLOD Empire/Assemble approved battle scene")]
        public static void PrepareCloud(){
            var catalog=AssetDatabase.LoadAssetAtPath<BattleVisualCatalog>(CatalogPath);
            if(!catalog)throw new BuildFailedException("Production visual catalog is not yet present: "+CatalogPath);
            catalog.Validate();
            if(!(GraphicsSettings.defaultRenderPipeline is UniversalRenderPipelineAsset))
                throw new BuildFailedException("A configured URP pipeline asset is required before scene assembly.");
            if(EditorSceneManager.GetActiveScene().isDirty)throw new BuildFailedException("Save open scene before assembly.");
            Directory.CreateDirectory("Assets/Scenes");AssetDatabase.Refresh();
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var world=(GameObject)PrefabUtility.InstantiatePrefab(catalog.genesisRift,scene);
            var surface=world.GetComponent<NavMeshSurface>();if(!surface)surface=world.AddComponent<NavMeshSurface>();
            surface.collectObjects=CollectObjects.Children;surface.BuildNavMesh();
            if(!surface.navMeshData)throw new BuildFailedException("No valid NavMesh generated from production terrain.");
            const string navPath="Assets/Scenes/GenesisRiftNavMesh.asset";
            var nav=AssetDatabase.LoadAssetAtPath<UnityEngine.AI.NavMeshData>(navPath);
            if(nav){EditorUtility.CopySerialized(surface.navMeshData,nav);surface.RemoveData();surface.navMeshData=nav;surface.AddData();EditorUtility.SetDirty(nav);}
            else AssetDatabase.CreateAsset(surface.navMeshData,navPath);
            var cameraObject=new GameObject("Battle Camera",typeof(Camera),typeof(AudioListener));cameraObject.tag="MainCamera";
            var camera=cameraObject.GetComponent<Camera>();camera.fieldOfView=48;camera.nearClipPlane=.2f;camera.farClipPlane=250;
            var root=new GameObject("Offline Battle",typeof(BattleView),typeof(BattleEffects));var view=root.GetComponent<BattleView>();view.visuals=catalog;view.battleCamera=camera;
            // Scene-owned, free lighting only when the approved map has no light rig.
            if(world.GetComponentsInChildren<Light>(true).Length==0){
                var sun=new GameObject("Arena sunlight",typeof(Light)).GetComponent<Light>();sun.type=LightType.Directional;sun.color=new Color(1f,.92f,.8f);sun.intensity=1.3f;sun.shadows=LightShadows.Soft;sun.transform.rotation=Quaternion.Euler(48,-35,0);
                RenderSettings.ambientMode=AmbientMode.Trilight;RenderSettings.ambientSkyColor=new Color(.44f,.53f,.65f);RenderSettings.ambientEquatorColor=new Color(.34f,.38f,.40f);RenderSettings.ambientGroundColor=new Color(.21f,.24f,.19f);
            }
            var pulseShader=Shader.Find("BUKLOD/CombatPulse");if(!pulseShader)throw new BuildFailedException("Combat pulse shader missing.");
            const string pulsePath="Assets/Scenes/CombatPulse.mat";var pulse=AssetDatabase.LoadAssetAtPath<Material>(pulsePath);
            if(!pulse){pulse=new Material(pulseShader);AssetDatabase.CreateAsset(pulse,pulsePath);}
            root.GetComponent<BattleEffects>().pulseMaterial=pulse;
            root.GetComponent<BattleEffects>().skillParticleMaterial=SkillParticleMaterial.Get("Assets/Scenes/SkillParticles.mat");
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android,AndroidBuildGuard.ExpectedApplicationId);
            PlayerSettings.productName="BUKLOD EMPIRE";PlayerSettings.defaultInterfaceOrientation=UIOrientation.LandscapeLeft;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android,ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures=AndroidArchitecture.ARM64;
            EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(ScenePath,true)};
            if(!EditorSceneManager.SaveScene(scene,ScenePath))throw new BuildFailedException("Scene could not be saved.");
            AssetDatabase.SaveAssets();
        }
    }
}
