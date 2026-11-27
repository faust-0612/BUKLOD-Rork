using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using UnityEditor;
using UnityEngine;
namespace Buklod.Empire.Editor {
    internal static class PresentationAudioReview {
        const string Source="Tools/ReviewOutput/presentation-audio",Out=CandidateReviewComposer.Out+"/PresentationAudio";
        [Serializable] sealed class Receipt {public string status;public int rate;public Row[] clips;}
        [Serializable] sealed class Row {public string name,file,sha256;public int bytes,samples;}
        static string Hash(string path){using(var f=File.OpenRead(path))using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(f)).Replace("-","").ToLowerInvariant();}
        internal static AudioClip LibraryReward(string name){
            var clip=Resources.Load<AudioClip>("LibraryAudio/Reward/"+name);
            if(!clip||clip.length<=0)throw new InvalidOperationException("Missing Library reward audio: "+name);
            return clip;
        }
        internal static void Bind(GameObject root){
            if(!Directory.Exists(Source))return;
            string path=Source+"/manifest.json";if(!File.Exists(path))throw new InvalidOperationException("Incomplete presentation audio generation.");
            var doc=JsonUtility.FromJson<Receipt>(File.ReadAllText(path));
            var expected=new HashSet<string>(new[]{"menu","battle","ambience","victory","defeat","draw","entrance"}.Concat(Enumerable.Range(0,9).SelectMany(i=>new[]{"creature_attack_"+i,"creature_defeat_"+i})),StringComparer.Ordinal);
            if(doc==null||doc.status!="REVIEW_ONLY"||doc.rate!=22050||doc.clips==null||doc.clips.Length!=expected.Count)throw new InvalidOperationException("Invalid presentation audio receipt.");
            foreach(var row in doc.clips){
                if(row==null||!expected.Remove(row.name)||row.file!=row.name+".wav"||row.samples<=0||row.bytes!=44+row.samples*2L)throw new InvalidOperationException("Invalid presentation audio identity.");
                var file=Source+"/"+row.file;if(!File.Exists(file)||new FileInfo(file).Length!=row.bytes||Hash(file)!=row.sha256)throw new InvalidOperationException("Audio hash mismatch: "+row.name);
            }
            if(expected.Count!=0)throw new InvalidOperationException("Missing audio cue.");
            Directory.CreateDirectory(Out);foreach(var row in doc.clips)File.Copy(Source+"/"+row.file,Out+"/"+row.file,true);
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            var clips=new Dictionary<string,AudioClip>(StringComparer.Ordinal);
            foreach(var row in doc.clips){
                var clip=AssetDatabase.LoadAssetAtPath<AudioClip>(Out+"/"+row.file);
                if(!clip||clip.channels!=1||Mathf.Abs(clip.length-row.samples/22050f)>.03f)throw new InvalidOperationException("Unexpected imported audio: "+row.name);
                clips.Add(row.name,clip);
            }
            var audio=root.AddComponent<ReviewPresentationAudio>();
            audio.menu=clips["menu"];audio.battle=clips["battle"];audio.ambience=clips["ambience"];
            audio.victory=LibraryReward("victory-fanfare");audio.defeat=clips["defeat"];audio.draw=clips["draw"];audio.entrance=clips["entrance"];
            audio.attacks=Enumerable.Range(0,9).Select(i=>clips["creature_attack_"+i]).ToArray();
            audio.defeats=Enumerable.Range(0,9).Select(i=>clips["creature_defeat_"+i]).ToArray();
        }
    }
}
