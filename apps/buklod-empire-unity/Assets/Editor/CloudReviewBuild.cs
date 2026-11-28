using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Explicit isolated cloud test target. No nested BuildPlayer, publishing, or approval.
    public static class CloudReviewBuild {
        const string Marker="BUKLOD_EMPIRE_CLOUD_REVIEW";
        internal static bool IsPrepared {get;private set;}
        static bool Authorized=>Environment.GetEnvironmentVariable(Marker)=="1"&&Application.isBatchMode;
        public static void Prepare(){
            if(Application.unityVersion!="6000.3.29f1"||!Authorized||Application.isPlaying||EditorUserBuildSettings.activeBuildTarget!=BuildTarget.Android)
                throw new BuildFailedException("Use the isolated Android cloud target and successful pre-build hook.");
#if !BUKLOD_OFFLINE_REVIEW
            if(!PlayerSettings.GetScriptingDefineSymbols(NamedBuildTarget.Android).Split(';').Contains("BUKLOD_OFFLINE_REVIEW"))
                throw new BuildFailedException("Set BUKLOD_OFFLINE_REVIEW in the cloud scripting define symbols.");
#endif
            IsPrepared=false;
            // Cloud review is batch-mode only; retain this verified selection until the build callback.
            AuthoredRosterBuildGate.Begin();
            OfflineReviewBuildBootstrap.EnsureReviewPipeline();
            ConsolidatedOfflineReview.Prepare();
            StylizedArenaBenchmark.Prepare();
            var target=NamedBuildTarget.Android;
            PlayerSettings.SetApplicationIdentifier(target,BattleView.OfflineTestApplicationId);
            PlayerSettings.productName="BUKLOD Empire Offline Test";
            PlayerSettings.defaultInterfaceOrientation=UIOrientation.LandscapeLeft;
            PlayerSettings.SetScriptingBackend(target,ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures=AndroidArchitecture.ARM64;
            PlayerSettings.Android.useCustomKeystore=false;
            PlayerSettings.Android.useAPKExpansionFiles=false;
            EditorUserBuildSettings.buildAppBundle=false;
            EditorUserBuildSettings.exportAsGoogleAndroidProject=false;
            EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(StylizedArenaBenchmark.ScenePath,true)};
            AssetDatabase.SaveAssets();
            IsPrepared=true;
            Debug.Log("BUKLOD isolated cloud review prepared; no production or visual approval.");
        }
        internal static void Validate(BuildReport report){
            if(!Authorized||!IsPrepared||report.summary.platform!=BuildTarget.Android||
                !report.summary.outputPath.EndsWith(".apk",StringComparison.OrdinalIgnoreCase)||
                (report.summary.options&BuildOptions.Development)==0||
                PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Android)!=BattleView.OfflineTestApplicationId||
                PlayerSettings.GetScriptingBackend(NamedBuildTarget.Android)!=ScriptingImplementation.IL2CPP||
                PlayerSettings.Android.targetArchitectures!=AndroidArchitecture.ARM64||PlayerSettings.Android.useCustomKeystore||
                PlayerSettings.Android.useAPKExpansionFiles||EditorUserBuildSettings.buildAppBundle||EditorUserBuildSettings.exportAsGoogleAndroidProject)
                throw new BuildFailedException("Unsafe cloud review settings; must be isolated debug ARM64 APK.");
            var scenes=EditorBuildSettings.scenes.Where(s=>s.enabled).ToArray();
            string path=StylizedArenaBenchmark.ScenePath;
            if(scenes.Length!=1||scenes[0].path!=path||!AssetDatabase.LoadAssetAtPath<SceneAsset>(path))
                throw new BuildFailedException("Only the generated stylized review scene is allowed.");
            string catalogPath=CandidateReviewComposer.Out+"/OfflineReviewCatalog.asset",navPath=CandidateReviewComposer.Out+"/OfflineReviewNavMesh.asset";
            var deps=AssetDatabase.GetDependencies(path,true);
            ReviewAuthoredAssetGate.Validate(deps);
            if(!deps.Contains(catalogPath)||!deps.Contains(navPath)||deps.Any(x=>x.StartsWith("Assets/Production/",StringComparison.OrdinalIgnoreCase)||x==ArenaSceneComposer.ScenePath))
                throw new BuildFailedException("Review dependency scope mismatch.");
            var catalog=AssetDatabase.LoadAssetAtPath<BattleVisualCatalog>(catalogPath);
            if(!catalog)throw new BuildFailedException("Missing review catalog.");
            catalog.ValidateOfflineReview();
            if(!(UnityEngine.Rendering.GraphicsSettings.currentRenderPipeline is UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset))
                throw new BuildFailedException("Missing review URP pipeline.");
            var bank=Resources.Load<TextAsset>("SkillAudioBank");
            if(!bank)throw new BuildFailedException("Missing skill audio bank.");
            SkillAudio.ValidateBank(bank.bytes);
        }
    }
}
