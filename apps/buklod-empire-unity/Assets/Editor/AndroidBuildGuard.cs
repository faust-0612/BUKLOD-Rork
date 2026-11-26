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
        static bool IsUnapprovedThirdParty(string path)=>new[]{"QuaterniusReview","KenneyReview","KayKitReview"}.Any(folder=>path.StartsWith("Assets/ThirdParty/"+folder+"/",System.StringComparison.OrdinalIgnoreCase));

        public void OnPreprocessBuild(BuildReport report)
        {
            if (report.summary.platform != BuildTarget.Android)
                return;

            if(Application.unityVersion!="6000.0.86f1")
                throw new BuildFailedException("Use the pinned, security-patched Unity 6000.0.86f1 Editor.");
            // Only the explicit local development entrypoint can authorize an isolated test build.
            // All normal Android builds continue through the existing production checks.
            if(OfflineReviewAndroidBuild.IsActive){OfflineReviewAndroidBuild.ValidateBuild(report);return;}
            if(CloudReviewBuild.IsPrepared){CloudReviewBuild.Validate(report);return;}
            var catalog=AssetDatabase.LoadAssetAtPath<BattleVisualCatalog>(ArenaSceneComposer.CatalogPath);
            if(!catalog)throw new BuildFailedException("Production asset catalog is missing.");
            try{catalog.Validate();}catch(System.Exception ex){throw new BuildFailedException(ex.Message);}
            var applicationId = PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Android);
            if (applicationId != ExpectedApplicationId)
                throw new BuildFailedException("BUKLOD Empire requires its isolated Android application ID: " + ExpectedApplicationId);

            var scenes = EditorBuildSettings.scenes.Where(scene => scene.enabled).ToArray();
            if (scenes.Length != 1 || scenes[0].path != ArenaSceneComposer.ScenePath || scenes.Any(scene => AssetDatabase.LoadAssetAtPath<SceneAsset>(scene.path) == null))
                throw new BuildFailedException("BUKLOD Empire requires valid enabled Unity scenes before Android compilation.");

            if(!AssetDatabase.LoadAssetAtPath<UnityEngine.AI.NavMeshData>("Assets/Scenes/GenesisRiftNavMesh.asset"))throw new BuildFailedException("Production NavMesh missing.");
            if(!(UnityEngine.Rendering.GraphicsSettings.defaultRenderPipeline is UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset))throw new BuildFailedException("Production URP settings missing.");
            var catalogDeps=AssetDatabase.GetDependencies(ArenaSceneComposer.CatalogPath,true);
            if(catalogDeps.Any(path=>(path.StartsWith("Assets/Generated/",System.StringComparison.OrdinalIgnoreCase)||IsUnapprovedThirdParty(path))))throw new BuildFailedException("Generated or third-party review assets cannot be used by the production catalog.");
            if(!AssetDatabase.GetDependencies(scenes[0].path,true).Contains(ArenaSceneComposer.CatalogPath))throw new BuildFailedException("Enabled scene must use the approved production catalog.");
            foreach(var scene in scenes){
                if(scene.path.StartsWith("Assets/Generated/",System.StringComparison.OrdinalIgnoreCase)||
                   AssetDatabase.GetDependencies(scene.path,true).Any(path=>path.StartsWith("Assets/Generated/ReviewOnly/",System.StringComparison.OrdinalIgnoreCase)||IsUnapprovedThirdParty(path)))
                    throw new BuildFailedException("Unapproved review scene or dependency cannot enter an Android build: "+scene.path);
            }
            Debug.Log("BUKLOD Empire Android identity and scene preflight passed. This is not a visual or gameplay acceptance result.");
        }
    }
}
