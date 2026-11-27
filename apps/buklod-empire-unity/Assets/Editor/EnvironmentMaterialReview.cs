using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Shared world-projected materials cover static meshes with or without UVs.
    internal static class EnvironmentMaterialReview {
        const string Source="Tools/ReviewOutput/environment-materials";
        const string Out=CandidateReviewComposer.Out+"/EnvironmentMaterials";
        static readonly string[] Kinds={"soil","grass","stone","paving","timber","metal"};
        static readonly Dictionary<string,string> Families=new Dictionary<string,string>(StringComparer.Ordinal){
            {"terrain","soil"},{"grass_edge","grass"},{"stone","stone"},{"engraved_stone","stone"},{"river_bank","stone"},
            {"paving","paving"},{"wood","timber"},{"timber","timber"},{"masonry","stone"},
            {"lux_steel","metal"},{"tenebra_steel","metal"},{"lux_blue","metal"},{"tenebra_red","metal"},
            {"gold","metal"},{"warm_gold","metal"},{"cool_inlay","metal"},{"lux_inlay","metal"},{"tenebra_inlay","metal"},
            {"trim","metal"},{"roof","metal"}
        };
        [Serializable] sealed class Receipt {public string status;public int resolution;public Row[] textures;}
        [Serializable] sealed class Row {public string file,sha256;public int bytes;}
        static string Hash(string path){using(var f=File.OpenRead(path))using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(f)).Replace("-","").ToLowerInvariant();}
        internal static bool Prepare(){
            if(!Directory.Exists(Source))return false;
            var manifest=Source+"/manifest.json";
            if(!File.Exists(manifest))throw new InvalidOperationException("Incomplete environmental textures.");
            var doc=JsonUtility.FromJson<Receipt>(File.ReadAllText(manifest));
            if(doc==null||doc.status!="REVIEW_ONLY"||!new[]{1024,2048,4096}.Contains(doc.resolution)||doc.textures==null)
                throw new InvalidOperationException("Invalid environment material manifest.");
            var expected=new HashSet<string>(Kinds.Select(k=>k+".tga"),StringComparer.Ordinal);
            foreach(var row in doc.textures){
                if(row==null||!expected.Remove(row.file))throw new InvalidOperationException("Unknown environment tile.");
                string path=Source+"/"+row.file;
                if(!File.Exists(path)||new FileInfo(path).Length!=row.bytes||Hash(path)!=row.sha256)throw new InvalidOperationException("Environment texture hash mismatch: "+row.file);
            }
            if(expected.Count!=0)throw new InvalidOperationException("Incomplete environment texture roster.");
            Directory.CreateDirectory(Out);
            foreach(var row in doc.textures)File.Copy(Source+"/"+row.file,Out+"/"+row.file,true);
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            foreach(var row in doc.textures){
                string path=Out+"/"+row.file;
                var importer=AssetImporter.GetAtPath(path) as TextureImporter;
                if(importer==null)throw new InvalidOperationException("Missing environmental texture importer.");
                importer.textureType=TextureImporterType.Default;importer.sRGBTexture=true;
                importer.alphaSource=TextureImporterAlphaSource.FromInput;importer.alphaIsTransparency=false;
                importer.mipmapEnabled=true;importer.wrapMode=TextureWrapMode.Repeat;importer.filterMode=FilterMode.Trilinear;
                importer.anisoLevel=8;importer.maxTextureSize=doc.resolution;importer.textureCompression=TextureImporterCompression.Uncompressed;
                importer.SaveAndReimport();
                var texture=AssetDatabase.LoadAssetAtPath<Texture2D>(path);
                if(!texture||texture.width!=doc.resolution||texture.height!=doc.resolution)throw new InvalidOperationException("Unexpected environment texture dimensions.");
            }
            PremiumSurfaceReview.Prepare();
            return true;
        }
        internal static void Apply(GameObject obj,string id){
            var shader=Shader.Find("BUKLOD/Review/WorldSurface");
            if(!shader||!shader.isSupported)throw new InvalidOperationException("WorldSurface review shader unavailable.");
            int count=0;
            foreach(var renderer in obj.GetComponentsInChildren<MeshRenderer>(true)){
                var materials=renderer.sharedMaterials;bool changed=false;
                for(int i=0;i<materials.Length;i++){
                    var original=materials[i];if(!original||!Families.TryGetValue(original.name,out var kind))continue;
                    var colorProperty=original.HasProperty("_BaseColor")?"_BaseColor":original.HasProperty("_BaseColorFactor")?"_BaseColorFactor":original.HasProperty("baseColorFactor")?"baseColorFactor":original.HasProperty("_Color")?"_Color":null;
                    if(colorProperty==null)throw new InvalidOperationException("Missing original environmental tint: "+original.name);
                    var path=Out+"/"+id+"_"+original.name+".mat";
                    var m=AssetDatabase.LoadAssetAtPath<Material>(path);
                    if(!m){m=new Material(shader);AssetDatabase.CreateAsset(m,path);}else m.shader=shader;
                    var texture=AssetDatabase.LoadAssetAtPath<Texture2D>(Out+"/"+kind+".tga");
                    if(!texture)throw new InvalidOperationException("Missing environmental texture: "+kind);
                    var authored=PremiumSurfaceReview.Get(kind);
                    m.SetColor("_BaseColor",authored?Color.Lerp(original.GetColor(colorProperty),Color.white,.55f):original.GetColor(colorProperty));m.SetTexture("_Detail",authored?authored:texture);
                    m.SetFloat("_Tile",kind=="paving"?.18f:kind=="metal"?.65f:.42f);
                    float metal=original.HasProperty("_Metallic")?original.GetFloat("_Metallic"):original.HasProperty("_MetallicFactor")?original.GetFloat("_MetallicFactor"):kind=="metal"?.5f:0;
                    m.SetFloat("_Metallic",Mathf.Clamp01(metal));EditorUtility.SetDirty(m);
                    materials[i]=m;changed=true;count++;
                }
                if(changed)renderer.sharedMaterials=materials;
            }
            if(count==0)throw new InvalidOperationException("No known environmental surface material: "+id);
        }
    }
}
