using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using UnityEditor;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Isolated opt-in authored textures. No simulation, hero identity or production changes.
    internal static class PremiumSurfaceReview {
        const string Source="Tools/ReviewOutput/polyhaven-surfaces-v1";
        const string Out=CandidateReviewComposer.Out+"/PremiumSurfaces";
        static readonly Dictionary<string,string> Assets=new Dictionary<string,string>(StringComparer.Ordinal){
            {"soil","forest_floor"},{"grass","sparse_grass"},{"stone","mossy_rock"},{"paving","cobblestone_01"},{"timber","medieval_wood"}
        };
        [Serializable] sealed class Receipt {public string status,provider,license;public int resolution;public bool productionApproved;public Row[] textures;}
        [Serializable] sealed class Row {public string kind,asset,file,sha256,diffSha256,roughSha256,normalFile,normalSha256;public long bytes,normalBytes;}
        static string Hash(string p){using(var f=File.OpenRead(p))using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(f)).Replace("-","").ToLowerInvariant();}
        internal static bool Requested=>Environment.GetEnvironmentVariable("BUKLOD_PREMIUM_SURFACES")=="1";
        internal static void Prepare(){
            if(!Requested)return;
            var doc=JsonUtility.FromJson<Receipt>(File.ReadAllText(Source+"/manifest.json"));
            if(doc==null||doc.status!="POLYHAVEN_CC0_REVIEW_ONLY"||doc.provider!="Poly Haven"||doc.license!="CC0"||doc.productionApproved||doc.resolution!=4096||doc.textures==null||doc.textures.Length!=Assets.Count)
                throw new InvalidOperationException("Invalid Poly Haven review receipt.");
            var seen=new HashSet<string>(StringComparer.Ordinal);
            foreach(var row in doc.textures){
                if(row==null||row.kind==null||!Assets.TryGetValue(row.kind,out var id)||id!=row.asset||!seen.Add(row.kind)||row.file!=row.kind+".png"||row.bytes<=0||!File.Exists(Source+"/"+row.file)||new FileInfo(Source+"/"+row.file).Length!=row.bytes||Hash(Source+"/"+row.file)!=row.sha256)
                    throw new InvalidOperationException("Invalid authored surface data.");
                if(row.normalFile!=row.kind+"-normal.png"||row.normalBytes<=0||!File.Exists(Source+"/"+row.normalFile)||new FileInfo(Source+"/"+row.normalFile).Length!=row.normalBytes||Hash(Source+"/"+row.normalFile)!=row.normalSha256)
                    throw new InvalidOperationException("Invalid authored normal map.");
            }
            Directory.CreateDirectory(Out);
            foreach(var row in doc.textures){
                var dst=Out+"/"+row.file;
                if(!File.Exists(dst)||Hash(dst)!=row.sha256)File.Copy(Source+"/"+row.file,dst,true);
                var normal=Out+"/"+row.normalFile;if(!File.Exists(normal)||Hash(normal)!=row.normalSha256)File.Copy(Source+"/"+row.normalFile,normal,true);
            }
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            foreach(var row in doc.textures)foreach(bool normal in new[]{false,true}){
                string path=Out+"/"+(normal?row.normalFile:row.file);
                var importer=AssetImporter.GetAtPath(path) as TextureImporter;
                if(!importer)throw new InvalidOperationException("Missing authored texture importer: "+path);
                importer.textureType=normal?TextureImporterType.NormalMap:TextureImporterType.Default;importer.sRGBTexture=!normal;
                importer.convertToNormalmap=false;
                importer.alphaSource=normal?TextureImporterAlphaSource.None:TextureImporterAlphaSource.FromInput;importer.alphaIsTransparency=false;
                importer.mipmapEnabled=true;importer.wrapMode=TextureWrapMode.Repeat;importer.filterMode=FilterMode.Trilinear;
                importer.anisoLevel=8;importer.maxTextureSize=4096;importer.textureCompression=TextureImporterCompression.CompressedHQ;
                var android=importer.GetPlatformTextureSettings("Android");android.overridden=true;android.maxTextureSize=4096;android.format=TextureImporterFormat.ASTC_6x6;android.compressionQuality=100;importer.SetPlatformTextureSettings(android);
                importer.SaveAndReimport();
                var tex=AssetDatabase.LoadAssetAtPath<Texture2D>(path);
                if(!tex||tex.width!=4096||tex.height!=4096)throw new InvalidOperationException("Unexpected authored surface resolution.");
            }
            Debug.Log("Powered by Poly Haven: five CC0 4K albedo/smoothness and normal map pairs prepared.");
        }
        internal static Texture2D Get(string kind,bool normal=false){
            if(!Requested||!Assets.ContainsKey(kind))return null;
            var tex=AssetDatabase.LoadAssetAtPath<Texture2D>(Out+"/"+kind+(normal?"-normal.png":".png"));
            if(!tex)throw new InvalidOperationException("Missing authored surface: "+kind);
            return tex;
        }
        internal static void Validate(string[] dependencies){
            if(!Requested)return;
            var set=new HashSet<string>(dependencies,StringComparer.Ordinal);
            foreach(var kind in new[]{"soil","stone","paving"})
                if(!set.Contains(Out+"/"+kind+".png")||!set.Contains(Out+"/"+kind+"-normal.png"))throw new UnityEditor.Build.BuildFailedException("Missing authored battlefield dependency: "+kind);
        }
    }
}
