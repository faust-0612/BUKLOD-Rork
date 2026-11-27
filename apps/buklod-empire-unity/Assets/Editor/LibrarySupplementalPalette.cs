using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Source-backed optional model palette. It is deliberately outside Resources
    // and the playable catalog until an exact identity and motion contract are approved.
    internal static class LibrarySupplementalPalette {
        const string Source="Tools/AssetCandidates/LibraryFirst/";
        const string Out=CandidateReviewComposer.Out+"/SupplementalPalette/";
        [Serializable] sealed class Row {public string source,name,gitBlob;public int bytes,clips;}
        [Serializable] sealed class Manifest {public string status,author,license;public bool releaseApproved;public Row[] models;}
        static readonly Dictionary<string,string[]> Expected=new Dictionary<string,string[]>(StringComparer.Ordinal){
            {"Monsters/quaternius-green-blob.glb",new[]{"Idle","Walk","Bite_Front","HitRecieve","Death"}},
            {"Monsters/quaternius-demon.glb",new[]{"Flying_Idle"}},
            {"Monsters/quaternius-yeti.glb",new[]{"Idle","Walk","Bite_Front","HitRecieve","Death"}},
            {"Monsters/quaternius-orc.glb",new[]{"Idle","Walk","Punch","HitReact","Death"}},
            {"Monsters/quaternius-orc-skull.glb",new[]{"Idle","Walk","Punch","HitReact","Death"}},
            {"Monsters/quaternius-alien.glb",new[]{"Idle","Walk","Punch","HitReact","Death"}},
            {"Monsters/quaternius-mushroom-king.glb",new[]{"Idle","Walk","Punch","HitReact","Death"}},
            {"Monsters/quaternius-blue-demon.glb",new[]{"Idle","Walk","Punch","HitReact","Death"}},
            {"Enemies/Snake.glb",new[]{"Snake_Idle","Snake_Walk","Snake_Attack","Snake_Jump"}}
        };
        static string Key(Row row)=>row.source+"/"+row.name;
        static bool SafeName(string name)=>!string.IsNullOrWhiteSpace(name)&&name==Path.GetFileName(name)&&name.EndsWith(".glb",StringComparison.Ordinal)&&!name.Contains("/")&&!name.Contains("\\")&&!name.Contains(":");
        [MenuItem("BUKLOD Empire/Import supplemental authored creature palette")]
        public static void Prepare(){
            if(Application.isPlaying)throw new InvalidOperationException("Exit play mode first.");
            var doc=JsonUtility.FromJson<Manifest>(File.ReadAllText(Source+"manifest.json"));
            if(doc==null||doc.status!="LICENSED_SOURCE_CANDIDATES_ONLY"||doc.author!="Quaternius"||doc.license!="CC0-1.0"||doc.releaseApproved||doc.models==null)
                throw new InvalidOperationException("Invalid supplemental provenance.");
            var rows=doc.models.Where(r=>r!=null&&Expected.ContainsKey(Key(r))).ToArray();
            if(rows.Length!=Expected.Count||rows.Select(Key).Distinct(StringComparer.Ordinal).Count()!=Expected.Count)
                throw new InvalidOperationException("Incomplete supplemental model roster.");
            var verified=new Dictionary<string,byte[]>(StringComparer.Ordinal);
            foreach(var row in rows){
                if(!SafeName(row.name)||row.bytes<=0||row.bytes>16*1024*1024)throw new InvalidOperationException("Invalid model path or size.");
                var data=File.ReadAllBytes(Source+Key(row));
                if(data.Length!=row.bytes||LibraryStructureReview.GitBlob(data)!=row.gitBlob)
                    throw new InvalidOperationException("Changed supplemental model: "+Key(row));
                verified.Add(Key(row),data);
            }
            foreach(var pair in verified){
                string path=Out+"Models/"+pair.Key;Directory.CreateDirectory(Path.GetDirectoryName(path));
                if(!File.Exists(path)||LibraryStructureReview.GitBlob(File.ReadAllBytes(path))!=LibraryStructureReview.GitBlob(pair.Value))
                    File.WriteAllBytes(path,pair.Value);
            }
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            foreach(var row in rows){
                string modelPath=Out+"Models/"+Key(row);
                var model=AssetDatabase.LoadAssetAtPath<GameObject>(modelPath);
                if(!model||!model.GetComponentInChildren<SkinnedMeshRenderer>(true))throw new InvalidOperationException("Missing imported rig: "+row.name);
                var imported=AssetDatabase.LoadAllAssetsAtPath(modelPath).OfType<AnimationClip>().Where(c=>c.length>0).ToArray();
                foreach(var expected in Expected[Key(row)])
                    if(imported.Count(c=>c.name.Split('|').Last()==expected)!=1)
                        throw new InvalidOperationException("Missing or ambiguous supplemental animation: "+row.name+"/"+expected);
                // Preserve the complete authored model and clips. No fabricated combat motions.
                Debug.Log("Supplemental source ready for visual review: "+row.name+" ("+imported.Length+" clips)");
            }
            AssetDatabase.SaveAssets();
            Debug.Log("Nine supplemental source rigs imported for review only; not a gameplay replacement or release approval.");
        }
    }
}
