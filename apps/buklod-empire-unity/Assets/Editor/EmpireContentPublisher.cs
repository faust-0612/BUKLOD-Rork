using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace Buklod.Empire.Editor {
    // Generates unsigned Android bundle inputs only. Signing and hosting are separate, local operations.
    public static class EmpireContentPublisher {
        [MenuItem("BUKLOD Empire/Content updates/Export unsigned content bundles")]
        public static void Export(){
            if(EditorUserBuildSettings.activeBuildTarget!=BuildTarget.Android||Application.unityVersion!="6000.3.29f1")
                throw new BuildFailedException("Use the pinned Android editor before exporting content.");
            var trust=EmpireContentUpdater.ReadTrust();
            if(trust==null||trust.apkVersionCode!=PlayerSettings.Android.bundleVersionCode)throw new BuildFailedException("Configure pinned public trust for this exact APK version.");
            var output=Path.GetFullPath("Builds/EmpireContent/unsigned-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss"));
            if(Directory.Exists(output))throw new BuildFailedException("Content export already exists.");
            ReviewAuthoredAssetGate.ValidateLibraryAudioInputs();
            var paths=new Dictionary<string,string>(StringComparer.Ordinal);
            foreach(string slot in EmpireContentProtocol.Slots){
                var choices=new[]{"Magic","Reward"}.Select(group=>"Assets/Resources/LibraryAudio/"+group+"/"+slot+".ogg").Where(File.Exists).ToArray();
                if(choices.Length!=1||!AssetDatabase.LoadAssetAtPath<AudioClip>(choices[0]))throw new BuildFailedException("Missing licensed audio: "+slot);
                paths.Add(slot,choices[0]);
            }
            var catalog=AssetDatabase.LoadAssetAtPath<BattleVisualCatalog>(CandidateReviewComposer.Out+"/OfflineReviewCatalog.asset");
            if(!catalog)throw new BuildFailedException("Assemble the Library-first offline review before exporting content.");
            LibraryStructureReview.ValidateDependencies(AssetDatabase.GetDependencies(OfflineReviewComposer.ScenePath,true));
            foreach(var row in EmpireStaticContent.Slots(catalog)){
                var prefab=row.Value;
                var assetPath=AssetDatabase.GetAssetPath(prefab);
                if(string.IsNullOrEmpty(assetPath)||!assetPath.StartsWith(CandidateReviewComposer.Out+"/LibraryFirst/Prefabs/",StringComparison.Ordinal)||
                   !EmpireStaticContent.Compatible(prefab,prefab))
                    throw new BuildFailedException("Static art not compatible: "+row.Key);
                paths.Add(row.Key,assetPath);
            }
            EmpireContentSources.Apply(paths,catalog);
            if(paths.Values.Distinct(StringComparer.Ordinal).Count()!=paths.Count)throw new BuildFailedException("Each content slot requires a distinct asset path.");
            Directory.CreateDirectory(output);
            var groups=paths.GroupBy(x=>EmpireContentProtocol.IsStatic(x.Key)?(x.Key.StartsWith("lux_",StringComparison.Ordinal)?"static-lux":x.Key.StartsWith("tenebra_",StringComparison.Ordinal)?"static-tenebra":"static-resources"):Array.IndexOf(EmpireContentProtocol.Slots,x.Key)<21?"magic":"reward").OrderBy(g=>g.Key).ToArray();
            var builds=groups.Select(g=>new AssetBundleBuild{assetBundleName=g.Key,assetNames=g.Select(x=>x.Value).ToArray(),addressableNames=g.Select(x=>EmpireContentProtocol.AssetName(x.Key)).ToArray()}).ToArray();
            var manifest=BuildPipeline.BuildAssetBundles(output,builds,BuildAssetBundleOptions.ChunkBasedCompression|BuildAssetBundleOptions.StrictMode,BuildTarget.Android);
            if(!manifest)throw new BuildFailedException("Unsigned content bundle build failed.");
            var rows=new List<EmpireContentProtocol.Bundle>();
            foreach(var g in groups){
                if(manifest.GetAllDependencies(g.Key).Length!=0)throw new BuildFailedException("Unexpected bundle dependency.");
                string file=Path.Combine(output,g.Key);
                long bytes=new FileInfo(file).Length;
                if(bytes<=0||bytes>EmpireContentProtocol.MaxBundleBytes)throw new BuildFailedException("Bundle exceeds content budget.");
                string digest=EmpireContentProtocol.HashFile(file);
                var row=new EmpireContentProtocol.Bundle{sha256=digest,bytes=(int)bytes,slots=g.Select(x=>x.Key).ToArray()};
                File.Move(file,Path.Combine(output,EmpireContentProtocol.BundleFile(row)));rows.Add(row);
            }
            if(rows.Sum(x=>(long)x.bytes)>EmpireContentProtocol.MaxRevisionBytes)throw new BuildFailedException("Revision exceeds content budget.");
            var doc=new EmpireContentProtocol.Manifest{abi=EmpireContentProtocol.Abi,platform="Android",unity=Application.unityVersion,schema=2,
                minApk=trust.apkVersionCode,maxApk=trust.apkVersionCode,revision=0,bundles=rows.ToArray()};
            File.WriteAllText(Path.Combine(output,"unsigned-content.json"),JsonUtility.ToJson(doc,true));
            Debug.Log("Unsigned content exported: "+output+"; sign locally before hosting. Nothing deployed.");
        }
        internal static void ValidateBuildConfiguration(){
            try{
                var trust=EmpireContentUpdater.ReadTrust();
                if(trust==null||trust.apkVersionCode!=PlayerSettings.Android.bundleVersionCode)throw new InvalidDataException("Missing content trust for this APK version.");
                EmpireContentProtocol.Origin(trust);
            }catch(Exception e){throw new BuildFailedException("Content updater build configuration invalid: "+e.Message);}
        }
    }
}
