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
            var root=new GameObject("Offline Battle",typeof(BattleView));var view=root.GetComponent<BattleView>();view.visuals=catalog;view.battleCamera=camera;
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
