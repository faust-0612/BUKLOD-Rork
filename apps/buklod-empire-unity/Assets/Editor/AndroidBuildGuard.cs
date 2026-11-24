using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Buklod.Empire.Editor
{
    // Runs for both cloud and local Android builds; never modifies settings or starts a build.
    public sealed class AndroidBuildGuard : IPreprocessBuildWithReport
    {
        public const string ExpectedApplicationId = "org.mzbministry.buklod.empire";
        public int callbackOrder => -1000;

        public void OnPreprocessBuild(BuildReport report)
        {
            if (report.summary.platform != BuildTarget.Android)
                return;
            ValidateProject();
        }
        [MenuItem("BUKLOD Empire/Validate Android build inputs (no build)")]
        public static void ValidateProject(){

            if(Application.unityVersion!="6000.0.86f1")
                throw new BuildFailedException("Use the pinned, security-patched Unity 6000.0.86f1 Editor.");
            if(!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.Android,BuildTarget.Android))throw new BuildFailedException("Android build support is not installed.");
            if(!(UnityEngine.Rendering.GraphicsSettings.defaultRenderPipeline is UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset))throw new BuildFailedException("Configured URP asset is required.");
            if(PlayerSettings.GetScriptingBackend(NamedBuildTarget.Android)!=ScriptingImplementation.IL2CPP||PlayerSettings.Android.targetArchitectures!=AndroidArchitecture.ARM64)throw new BuildFailedException("Use isolated IL2CPP ARM64 Android settings.");
            if(EditorUserBuildSettings.buildAppBundle)throw new BuildFailedException("Standalone development artifact must be an APK, not an AAB.");
            var catalog=AssetDatabase.LoadAssetAtPath<BattleVisualCatalog>(ArenaSceneComposer.CatalogPath);
            if(!catalog)throw new BuildFailedException("Production asset catalog is missing.");
            try{catalog.Validate();}catch(System.Exception ex){throw new BuildFailedException(ex.Message);}
            var applicationId = PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Android);
            if (applicationId != ExpectedApplicationId)
                throw new BuildFailedException("BUKLOD Empire requires its isolated Android application ID: " + ExpectedApplicationId);

            var scenes = EditorBuildSettings.scenes.Where(scene => scene.enabled).ToArray();
            if (scenes.Length != 1 || scenes[0].path!=ArenaSceneComposer.ScenePath || scenes.Any(scene => AssetDatabase.LoadAssetAtPath<SceneAsset>(scene.path) == null))
                throw new BuildFailedException("BUKLOD Empire requires valid enabled Unity scenes before Android compilation.");

            if(AssetDatabase.GetDependencies(ArenaSceneComposer.CatalogPath,true).Any(path=>path.StartsWith("Assets/Generated/ReviewOnly/",System.StringComparison.OrdinalIgnoreCase)))throw new BuildFailedException("Production catalog references unapproved review assets.");
            foreach(var scene in scenes){
                if(scene.path.StartsWith("Assets/Generated/",System.StringComparison.OrdinalIgnoreCase)||
                   AssetDatabase.GetDependencies(scene.path,true).Any(path=>path.StartsWith("Assets/Generated/ReviewOnly/",System.StringComparison.OrdinalIgnoreCase)))
                    throw new BuildFailedException("Unapproved review scene or dependency cannot enter an Android build: "+scene.path);
            }
            Debug.Log("BUKLOD Empire Android identity and scene preflight passed. This is not a visual or gameplay acceptance result.");
        }
    }
}
