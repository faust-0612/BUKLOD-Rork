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

            if(Application.unityVersion!="6000.0.86f1")
                throw new BuildFailedException("Use the pinned, security-patched Unity 6000.0.86f1 Editor.");
            var catalog=AssetDatabase.LoadAssetAtPath<BattleVisualCatalog>(ArenaSceneComposer.CatalogPath);
            if(!catalog)throw new BuildFailedException("Production asset catalog is missing.");
            try{catalog.Validate();}catch(System.Exception ex){throw new BuildFailedException(ex.Message);}
            var applicationId = PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Android);
            if (applicationId != ExpectedApplicationId)
                throw new BuildFailedException("BUKLOD Empire requires its isolated Android application ID: " + ExpectedApplicationId);

            var scenes = EditorBuildSettings.scenes.Where(scene => scene.enabled).ToArray();
            if (scenes.Length == 0 || scenes.Any(scene => AssetDatabase.LoadAssetAtPath<SceneAsset>(scene.path) == null))
                throw new BuildFailedException("BUKLOD Empire requires valid enabled Unity scenes before Android compilation.");

            Debug.Log("BUKLOD Empire Android identity and scene preflight passed. This is not a visual or gameplay acceptance result.");
        }
    }
}
