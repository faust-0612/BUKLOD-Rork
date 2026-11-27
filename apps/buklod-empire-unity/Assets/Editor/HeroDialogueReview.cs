using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
namespace Buklod.Empire.Editor {
    internal static class HeroDialogueReview {
        const string Source="Tools/hero-dialogue.json",Cache="Tools/ReviewOutput/hero-voice",Out=CandidateReviewComposer.Out+"/HeroVoice";
        [Serializable] sealed class Lines {public int schema;public ReviewHeroDialogue.Entry[] heroes;}
        [Serializable] sealed class Receipt {public string status,sourceSha256,engine;public Row[] clips;}
        [Serializable] sealed class Row {public string file,sha256;public long bytes;public int samples;}
        static string Hash(string p){using(var stream=File.OpenRead(p))using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","").ToLowerInvariant();}
        internal static void Bind(GameObject root){
            var doc=JsonUtility.FromJson<Lines>(File.ReadAllText(Source));
            var ids=HeroKitCatalog.All.Select(h=>h.Id).ToArray();
            if(doc==null||doc.schema!=1||doc.heroes==null||doc.heroes.Length!=ids.Length||
               !doc.heroes.Select(h=>h?.id).SequenceEqual(ids)||doc.heroes.Any(h=>string.IsNullOrWhiteSpace(h.selection)||string.IsNullOrWhiteSpace(h.ultimate)))
                throw new BuildFailedException("Invalid original hero dialogue roster.");
            var component=root.AddComponent<ReviewHeroDialogue>();component.entries=doc.heroes;
            string manifest=Cache+"/manifest.json";
            if(!File.Exists(manifest)){Debug.Log("Original dialogue subtitles ready; no synthetic voice cache.");return;}
            var receipt=JsonUtility.FromJson<Receipt>(File.ReadAllText(manifest));
            var names=new HashSet<string>(ids.SelectMany(id=>new[]{id+"_selection.wav",id+"_ultimate.wav"}),StringComparer.Ordinal);
            if(receipt==null||receipt.status!="LOCAL_SYNTHETIC_REVIEW_ONLY"||receipt.sourceSha256!=Hash(Source)||receipt.clips==null||receipt.clips.Length!=names.Count)
                throw new BuildFailedException("Invalid local voice preview receipt.");
            Directory.CreateDirectory(Out);
            foreach(var row in receipt.clips){
                if(row==null||!names.Remove(row.file)||row.samples<4410||row.samples>176400||!File.Exists(Cache+"/"+row.file)||
                   new FileInfo(Cache+"/"+row.file).Length!=row.bytes||Hash(Cache+"/"+row.file)!=row.sha256)
                    throw new BuildFailedException("Invalid local voice preview asset.");
                File.Copy(Cache+"/"+row.file,Out+"/"+row.file,true);
            }
            if(names.Count!=0)throw new BuildFailedException("Incomplete local voice preview.");
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            foreach(var entry in component.entries){
                entry.selectionClip=Load(entry.id+"_selection.wav",receipt);
                entry.ultimateClip=Load(entry.id+"_ultimate.wav",receipt);
            }
            Debug.Log("26 synthetic local voice clips bound to original heroes; not actor recordings.");
        }
        static AudioClip Load(string name,Receipt receipt){
            var clip=AssetDatabase.LoadAssetAtPath<AudioClip>(Out+"/"+name);
            var row=receipt.clips.Single(r=>r.file==name);
            if(!clip||clip.channels!=1||Mathf.Abs(clip.length-row.samples/22050f)>.05f)throw new BuildFailedException("Voice import mismatch: "+name);
            return clip;
        }
    }
}
