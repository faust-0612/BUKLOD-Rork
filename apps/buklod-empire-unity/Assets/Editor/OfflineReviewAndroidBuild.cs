using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Android;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
namespace Buklod.Empire.Editor {
    // Local, debug-signed, separately installed APK. Never publishes or touches production assets.
    public static class OfflineReviewAndroidBuild {
        internal static bool IsActive {get;private set;}
        static string expectedOutput;
        const string Catalog=CandidateReviewComposer.Out+"/OfflineReviewCatalog.asset";
        const string Nav=CandidateReviewComposer.Out+"/OfflineReviewNavMesh.asset";
        const string Scene=StylizedArenaBenchmark.ScenePath;
        internal static void ValidateBuild(BuildReport report){
            if(!IsActive||string.IsNullOrEmpty(expectedOutput)||report.summary.platform!=BuildTarget.Android||
               Path.GetFullPath(report.summary.outputPath)!=expectedOutput||
               PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Android)!=BattleView.OfflineTestApplicationId||
               (report.summary.options&BuildOptions.Development)==0||EditorUserBuildSettings.buildAppBundle||
               PlayerSettings.Android.useCustomKeystore||PlayerSettings.Android.targetArchitectures!=AndroidArchitecture.ARM64)
                throw new BuildFailedException("Invalid isolated offline test build scope.");
            var scenes=EditorBuildSettings.scenes.Where(s=>s.enabled).ToArray();
            if(scenes.Length!=1||scenes[0].path!=Scene||!AssetDatabase.LoadAssetAtPath<SceneAsset>(Scene))
                throw new BuildFailedException("Only the offline review scene is allowed.");
            ConsolidatedCandidateValidation.Validate(Scene,true);
        }
        [MenuItem("BUKLOD Empire/Build isolated offline test APK (local)")]
        public static void Build(){
            using(AuthoredRosterBuildGate.Begin())BuildWithAuthoredRoster();
        }
        static void BuildWithAuthoredRoster(){
            if(IsActive||Application.isPlaying||EditorSceneManager.GetActiveScene().isDirty)
                throw new BuildFailedException("Exit play mode and save the scene first.");
            if(Application.unityVersion!="6000.3.29f1"||EditorUserBuildSettings.activeBuildTarget!=BuildTarget.Android||!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.Android,BuildTarget.Android))
                throw new BuildFailedException("Use pinned Unity with Android Build Support and switch platform to Android first.");
            EmpireContentPublisher.ValidateBuildConfiguration();
            // Assembly validates the aggregate asset receipt and all imported catalog references.
            ConsolidatedOfflineReview.Prepare();
            StylizedArenaBenchmark.Prepare();
            var view=UnityEngine.Object.FindFirstObjectByType<BattleView>();
            if(!view||!view.IsConfiguredReview||!view.visuals||!view.GetComponent<EmpireContentUpdater>())throw new BuildFailedException("Review scene or native content updater missing.");
            ConsolidatedCandidateValidation.Validate(Scene,true);
            OfflineMotionGate.Validate(view.visuals);
            var root=Path.GetFullPath("Builds/OfflineReview");Directory.CreateDirectory(root);
            var output=Path.Combine(root,"buklod-empire-offline-test-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss")+".apk");
            if(File.Exists(output))throw new BuildFailedException("Output already exists.");
            var target=NamedBuildTarget.Android;
            var icon=AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Resources/EmpireBrand/LauncherIcon.png");
            if(!icon)throw new BuildFailedException("BUKLOD Empire launcher icon is missing.");
            var iconKinds=new[]{AndroidPlatformIconKind.Legacy,AndroidPlatformIconKind.Round,AndroidPlatformIconKind.Adaptive};
            var previousIcons=System.Array.ConvertAll(iconKinds,kind=>PlayerSettings.GetPlatformIcons(target,kind));
            bool oldSplash=PlayerSettings.SplashScreen.show;
            var oldId=PlayerSettings.GetApplicationIdentifier(target);var oldName=PlayerSettings.productName;
            var oldOrientation=PlayerSettings.defaultInterfaceOrientation;
            var oldBackend=PlayerSettings.GetScriptingBackend(target);var oldArch=PlayerSettings.Android.targetArchitectures;
            var oldKeystore=PlayerSettings.Android.useCustomKeystore;var oldBundle=EditorUserBuildSettings.buildAppBundle;
            var oldExport=EditorUserBuildSettings.exportAsGoogleAndroidProject;var oldScenes=EditorBuildSettings.scenes;
            try{
                PlayerSettings.SetApplicationIdentifier(target,BattleView.OfflineTestApplicationId);
                PlayerSettings.SplashScreen.show=false;
                foreach(var kind in iconKinds){
                    var slots=PlayerSettings.GetPlatformIcons(target,kind);
                    foreach(var slot in slots){
                        if(kind==AndroidPlatformIconKind.Adaptive)slot.SetTextures(icon,icon);
                        else slot.SetTextures(icon);
                    }
                    PlayerSettings.SetPlatformIcons(target,kind,slots);
                }
                PlayerSettings.productName="BUKLOD Empire Offline Test";
                PlayerSettings.defaultInterfaceOrientation=UIOrientation.LandscapeLeft;
                PlayerSettings.SetScriptingBackend(target,ScriptingImplementation.IL2CPP);
                PlayerSettings.Android.targetArchitectures=AndroidArchitecture.ARM64;
                PlayerSettings.Android.useCustomKeystore=false;
                EditorUserBuildSettings.buildAppBundle=false;EditorUserBuildSettings.exportAsGoogleAndroidProject=false;
                EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(Scene,true)};
                expectedOutput=output;IsActive=true;
                var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{
                    scenes=new[]{Scene},locationPathName=output,target=BuildTarget.Android,
                    options=BuildOptions.Development|BuildOptions.StrictMode,
                    extraScriptingDefines=new[]{"BUKLOD_OFFLINE_REVIEW"}
                });
                if(report.summary.result!=BuildResult.Succeeded||report.summary.totalErrors!=0||!File.Exists(output)||new FileInfo(output).Length==0)
                    throw new BuildFailedException("Local offline test build failed. Do not install incomplete output.");
                using(var stream=File.OpenRead(output))using(var sha=SHA256.Create()){
                    string hash=BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","").ToLowerInvariant();
                    File.WriteAllText(output+".build.txt","UNAPPROVED_OFFLINE_TEST\npackage="+BattleView.OfflineTestApplicationId+"\nunity="+Application.unityVersion+"\nbytes="+stream.Length+"\nsha256="+hash+"\nartifact_signature_verified=false\ndevice_verified=false\n");
                }
                Debug.Log("Local test APK built: "+output+" — verify signature, package identity and device behavior separately.");
            }catch{
                if(File.Exists(output))File.Delete(output);
                if(File.Exists(output+".build.txt"))File.Delete(output+".build.txt");
                throw;
            }finally{
                IsActive=false;expectedOutput=null;
                PlayerSettings.SplashScreen.show=oldSplash;
                for(int i=0;i<iconKinds.Length;i++)PlayerSettings.SetPlatformIcons(target,iconKinds[i],previousIcons[i]);
                EditorBuildSettings.scenes=oldScenes;
                PlayerSettings.SetApplicationIdentifier(target,oldId);PlayerSettings.productName=oldName;
                PlayerSettings.defaultInterfaceOrientation=oldOrientation;PlayerSettings.SetScriptingBackend(target,oldBackend);
                PlayerSettings.Android.targetArchitectures=oldArch;PlayerSettings.Android.useCustomKeystore=oldKeystore;
                EditorUserBuildSettings.buildAppBundle=oldBundle;EditorUserBuildSettings.exportAsGoogleAndroidProject=oldExport;
                AssetDatabase.SaveAssets();
            }
        }
    }
}
