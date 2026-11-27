using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace Buklod.Empire.Editor {
    // Publisher-side only. A new art revision is data, not a new native player script.
    internal static class EmpireContentSources {
        const string Root="Assets/EmpireContentSource/";
        const string ManifestPath=Root+"manifest.json";
        [Serializable] sealed class Manifest {public string status;public Entry[] entries;}
        [Serializable] sealed class Entry {public string slot,assetPath,author,license,sourceUrl;public bool redistributionReviewed;public FileRow[] files;}
        [Serializable] sealed class FileRow {public string path,sha256,metaSha256;}
        static readonly HashSet<string> Extensions=new HashSet<string>(new[]{
            ".prefab",".ogg",".glb",".gltf",".bin",".fbx",".asset",".mat",".png",".jpg",".jpeg",".tga",".exr"
        },StringComparer.OrdinalIgnoreCase);
        static bool Safe(string path){
            return !string.IsNullOrEmpty(path)&&path.StartsWith(Root,StringComparison.Ordinal)&&!path.Contains("\\")&&!path.Contains(":")&&
                path.Split('/').All(x=>x.Length>0&&x!="."&&x!=".."&&!x.EndsWith(".",StringComparison.Ordinal)&&!x.EndsWith(" ",StringComparison.Ordinal))&&Extensions.Contains(Path.GetExtension(path));
        }
        static void Verify(FileRow file){
            if(file==null||!Safe(file.path)||!EmpireContentProtocol.IsHash(file.sha256)||!EmpireContentProtocol.IsHash(file.metaSha256))
                throw new BuildFailedException("Invalid supplemental content file.");
            if(!File.Exists(file.path)||!File.Exists(file.path+".meta")||
                EmpireContentProtocol.HashFile(file.path)!=file.sha256||EmpireContentProtocol.HashFile(file.path+".meta")!=file.metaSha256)
                throw new BuildFailedException("Changed supplemental content input: "+file.path);
        }
        internal static void Apply(Dictionary<string,string> paths,BattleVisualCatalog catalog){
            if(!File.Exists(ManifestPath))return;
            var doc=JsonUtility.FromJson<Manifest>(File.ReadAllText(ManifestPath));
            if(doc==null||doc.status!="RIGHTS_AND_SOURCE_REVIEWED"||doc.entries==null||doc.entries.Length>paths.Count)
                throw new BuildFailedException("Invalid supplemental content manifest.");
            var slots=EmpireStaticContent.Slots(catalog);
            var seen=new HashSet<string>(StringComparer.Ordinal);
            foreach(var entry in doc.entries){
                if(entry==null||!paths.TryGetValue(entry.slot,out var baseline)||!seen.Add(entry.slot)||!Safe(entry.assetPath)||
                    !entry.redistributionReviewed||string.IsNullOrWhiteSpace(entry.author)||
                    entry.license!="CC0-1.0"||
                    !Uri.TryCreate(entry.sourceUrl,UriKind.Absolute,out var url)||url.Scheme!="https"||entry.files==null||entry.files.Length<1)
                    throw new BuildFailedException("Unreviewed supplemental content entry.");
                var declared=new HashSet<string>(StringComparer.Ordinal);
                foreach(var row in entry.files){Verify(row);if(!declared.Add(row.path))throw new BuildFailedException("Duplicate supplemental file.");}
                if(!declared.Contains(entry.assetPath))throw new BuildFailedException("Missing supplemental root hash.");
                var trusted=new HashSet<string>(AssetDatabase.GetDependencies(baseline,true),StringComparer.Ordinal);
                var needed=new HashSet<string>(StringComparer.Ordinal);
                foreach(var dep in AssetDatabase.GetDependencies(entry.assetPath,true)){
                    if(dep.StartsWith(Root,StringComparison.Ordinal)){if(!Safe(dep))throw new BuildFailedException("Unsupported supplemental dependency: "+dep);needed.Add(dep);}
                    else if(!trusted.Contains(dep))throw new BuildFailedException("Unexpected external dependency: "+dep);
                }
                if(!needed.SetEquals(declared))throw new BuildFailedException("Supplemental dependency receipt mismatch: "+entry.slot);
                if(EmpireContentProtocol.IsStatic(entry.slot)){
                    if(Path.GetExtension(entry.assetPath)!=".prefab"||
                        !EmpireStaticContent.Compatible(AssetDatabase.LoadAssetAtPath<GameObject>(entry.assetPath),slots[entry.slot]))
                        throw new BuildFailedException("Incompatible static prefab: "+entry.slot);
                }else{
                    var clip=AssetDatabase.LoadAssetAtPath<AudioClip>(entry.assetPath);
                    if(Path.GetExtension(entry.assetPath)!=".ogg"||!clip||clip.length<=0||clip.length>30||clip.channels<1||clip.channels>2)
                        throw new BuildFailedException("Incompatible audio clip: "+entry.slot);
                }
                paths[entry.slot]=entry.assetPath;
            }
        }
    }
}
