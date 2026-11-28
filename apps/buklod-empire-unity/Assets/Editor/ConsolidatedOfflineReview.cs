using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // One local review assembly entrypoint; never changes production catalog or build settings.
    public static class ConsolidatedOfflineReview {
        const string Source="Tools/ReviewOutput";
        [Serializable] sealed class Receipt {public string status;public int files;public long bytes;public bool unityVerified,productionApproved;public Group[] groups;}
        [Serializable] sealed class Group {public string directory,manifestSha256;public Row[] rows;}
        [Serializable] sealed class Row {public string file,sha256;public long bytes;}
        static readonly Dictionary<string,int> Counts=new Dictionary<string,int>(StringComparer.Ordinal){
            {"heroes",13},{"hero-lod",13},{"variants",39},{"premium-factions",22},{"wildlife",14},{"economy",14},
            {"faction-materials",15},{"wildlife-materials",21},{"environment-materials",6},{"presentation-audio",25},{"environment",1}
        };
        static string Hash(string path){using(var f=File.OpenRead(path))using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(f)).Replace("-","").ToLowerInvariant();}
        public static void ValidateReceipt(){
            string path=Source+"/offline-preparation.json";
            if(!File.Exists(path))throw new InvalidOperationException("Run node Tools/prepare-offline-review.mjs first.");
            var doc=JsonUtility.FromJson<Receipt>(File.ReadAllText(path));
            if(doc==null||doc.status!="OFFLINE_ASSETS_VERIFIED_REVIEW_ONLY"||doc.productionApproved||doc.unityVerified||doc.groups==null||doc.groups.Length!=Counts.Count)
                throw new InvalidOperationException("Incomplete offline asset preparation receipt.");
            var seen=new HashSet<string>(StringComparer.Ordinal);int files=0;long bytes=0;
            foreach(var g in doc.groups){
                if(g==null||g.directory==null||!Counts.TryGetValue(g.directory,out int count)||!seen.Add(g.directory)||g.rows==null||g.rows.Length!=count)
                    throw new InvalidOperationException("Invalid prepared asset group.");
                string folder=Source+"/"+g.directory;
                if(Hash(folder+"/manifest.json")!=g.manifestSha256)throw new InvalidOperationException("Manifest changed: "+g.directory);
                var names=new HashSet<string>(StringComparer.Ordinal);
                foreach(var row in g.rows){
                    if(row==null||string.IsNullOrWhiteSpace(row.file)||Path.GetFileName(row.file)!=row.file||row.file.Contains("/")||row.file.Contains("\\")||row.file==".."||row.file=="."||!names.Add(row.file)||row.bytes<=0)
                        throw new InvalidOperationException("Invalid asset path.");
                    string file=folder+"/"+row.file;
                    if(!File.Exists(file)||new FileInfo(file).Length!=row.bytes||Hash(file)!=row.sha256)
                        throw new InvalidOperationException("Prepared file changed: "+file);
                    files++;bytes+=row.bytes;
                }
            }
            if(files!=doc.files||bytes!=doc.bytes||files!=Counts.Values.Sum())throw new InvalidOperationException("Aggregate asset receipt mismatch.");
        }
        [MenuItem("BUKLOD Empire/Assemble consolidated offline review")]
        public static void Prepare(){
            if(Application.isPlaying||EditorSceneManager.GetActiveScene().isDirty)throw new InvalidOperationException("Exit play mode and save the scene first.");
            if(Application.unityVersion!="6000.3.29f1"&&Application.unityVersion!="6000.6.10f1")throw new InvalidOperationException("Use pinned Unity 6000.3.29f1 or the isolated Unity 6000.6.10f1 review candidate.");
            if(!(UnityEngine.Rendering.GraphicsSettings.currentRenderPipeline is UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset))
                throw new InvalidOperationException("Configure the local URP asset before review.");
            ValidateReceipt();
            ReviewAuthoredAssetGate.ValidateLibraryAudioInputs();
            LibraryVillageReview.ValidateInputs();
            var bank=Resources.Load<TextAsset>("SkillAudioBank");
            if(!bank)throw new InvalidOperationException("Missing committed 39-skill audio bank.");
            SkillAudio.ValidateBank(bank.bytes);
            // A Library-first review must not silently use the old generated skill audio.
            SkillAudio.LoadLibraryClips();
            CandidateReviewComposer.Prepare();
            if(AuthoredExpansionReview.Requested||AuthoredRosterBuildGate.Active)PortraitCaptureReview.EnsureCurrent();
            OfflineReviewComposer.Prepare();
            Debug.Log("Consolidated offline review assembled. Run EditMode/PlayMode and visual acceptance separately. No APK or production approval.");
        }
    }
}
