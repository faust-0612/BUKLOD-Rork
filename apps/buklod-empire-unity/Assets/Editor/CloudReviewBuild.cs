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
        static IDisposable rosterLease;
        static void ResetPreparation(){IsPrepared=false;rosterLease?.Dispose();rosterLease=null;}
        static bool Authorized=>Environment.GetEnvironmentVariable(Marker)=="1"&&Application.isBatchMode;
        public static void Prepare(){
            if(Application.unityVersion!="6000.3.29f1"||!Authorized||Application.isPlaying||EditorUserBuildSettings.activeBuildTarget!=BuildTarget.Android)
                throw new BuildFailedException("Use the isolated Android cloud target and successful pre-build hook.");
#if !BUKLOD_OFFLINE_REVIEW
            if(!PlayerSettings.GetScriptingDefineSymbols(NamedBuildTarget.Android).Split(';').Contains("BUKLOD_OFFLINE_REVIEW"))
                throw new BuildFailedException("Set BUKLOD_OFFLINE_REVIEW in the cloud scripting define symbols.");
#endif
            ResetPreparation();
            // Retain the verified roster selection for the build callback; dispose failed or superseded preparations.
            try{
            rosterLease=AuthoredRosterBuildGate.Begin();
            EmpireContentPublisher.ValidateBuildConfiguration();
            OfflineReviewBuildBootstrap.EnsureReviewPipeline();
            ConsolidatedOfflineReview.Prepare();
            StylizedArenaBenchmark.Prepare();
            ConsolidatedCandidateValidation.Validate(StylizedArenaBenchmark.ScenePath,true);
            var view=UnityEngine.Object.FindFirstObjectByType<BattleView>();
            if(!view)throw new BuildFailedException("Missing prepared match.");
            OfflineMotionGate.Validate(view.visuals);
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
            }catch{ResetPreparation();throw;}
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
            ConsolidatedCandidateValidation.Validate(path,true);
        }
    }
}
