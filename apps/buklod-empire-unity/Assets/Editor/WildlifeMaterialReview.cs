using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

namespace Buklod.Empire.Editor {
    // Optional shared HD materials for the enhanced wildlife review submeshes only.
    internal static class WildlifeMaterialReview {
        const string Source="Tools/ReviewOutput/wildlife-materials";
        const string Out=CandidateReviewComposer.Out+"/WildlifeMaterials";
        static readonly string[] Kinds={"fur","scales","chitin","stone","spirit","feather","armor"};
        static readonly string[] Roles={"base","mask","normal"};
        [Serializable] sealed class Receipt {public string status;public int resolution;public Row[] textures;}
        [Serializable] sealed class Row {public string file,sha256;public int bytes;}
        static readonly Dictionary<string,string> BodyKinds=new Dictionary<string,string>(StringComparer.Ordinal){
            {"wildlife_azure_stag","fur"},{"wildlife_crimson_wolf","fur"},{"wildlife_emerald_serpent","scales"},
            {"wildlife_golden_scarab","chitin"},{"wildlife_stone_golem","stone"},{"wildlife_river_spirit","spirit"},
            {"wildlife_wind_falcon","feather"},{"wildlife_ancient_sentinel","stone"},{"wildlife_colossal_guardian","stone"}
        };
        static string Hash(string file){
            using(var f=File.OpenRead(file))using(var sha=SHA256.Create())
                return BitConverter.ToString(sha.ComputeHash(f)).Replace("-","").ToLowerInvariant();
        }
        internal static bool Prepare(){
            if(!Directory.Exists(Source))return false;
            var receiptPath=Source+"/manifest.json";
            if(!File.Exists(receiptPath))throw new InvalidOperationException("Incomplete wildlife material generation.");
            var doc=JsonUtility.FromJson<Receipt>(File.ReadAllText(receiptPath));
            if(doc==null||doc.status!="REVIEW_ONLY"||!new[]{1024,2048,4096}.Contains(doc.resolution)||doc.textures==null)
                throw new InvalidOperationException("Invalid wildlife material manifest.");
            var expected=new HashSet<string>(Kinds.SelectMany(k=>Roles.Select(r=>k+"_"+r+".png")),StringComparer.Ordinal);
            foreach(var row in doc.textures){
                if(row==null||!expected.Remove(row.file))throw new InvalidOperationException("Unexpected wildlife texture identity.");
                var path=Source+"/"+row.file;
                if(!File.Exists(path)||new FileInfo(path).Length!=row.bytes||Hash(path)!=row.sha256)
                    throw new InvalidOperationException("Wildlife texture hash mismatch: "+row.file);
            }
            if(expected.Count!=0)throw new InvalidOperationException("Incomplete wildlife texture roster.");
            Directory.CreateDirectory(Out);
            foreach(var row in doc.textures)File.Copy(Source+"/"+row.file,Out+"/"+row.file,true);
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            foreach(var row in doc.textures){
                var path=Out+"/"+row.file;
                var importer=AssetImporter.GetAtPath(path) as TextureImporter;
                if(importer==null)throw new InvalidOperationException("Texture importer unavailable: "+row.file);
                bool normal=row.file.EndsWith("_normal.png",StringComparison.Ordinal);
                importer.textureType=normal?TextureImporterType.NormalMap:TextureImporterType.Default;
                importer.sRGBTexture=row.file.EndsWith("_base.png",StringComparison.Ordinal);
                importer.alphaSource=TextureImporterAlphaSource.FromInput;
                importer.maxTextureSize=doc.resolution;importer.mipmapEnabled=true;
                importer.wrapMode=TextureWrapMode.Repeat;importer.filterMode=FilterMode.Trilinear;
                importer.anisoLevel=8;importer.textureCompression=TextureImporterCompression.Uncompressed;
                importer.SaveAndReimport();
                var tex=AssetDatabase.LoadAssetAtPath<Texture2D>(path);
                if(!tex||tex.width!=doc.resolution||tex.height!=doc.resolution)
                    throw new InvalidOperationException("Unexpected imported texture resolution: "+row.file);
            }
            return true;
        }
        static string Kind(string material,string bodyKind){
            if(material=="body"||material=="dark")return bodyKind;
            if(material=="armor")return bodyKind=="chitin"?"chitin":bodyKind=="stone"?"armor":bodyKind=="scales"?"scales":"armor";
            return null; // preserve luminous eyes, crystals and original resource materials
        }
        static Material Shared(Material original,string kind,string id){
            var path=Out+"/"+id+"_"+original.name+".mat";
            var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
            var shader=Shader.Find("Universal Render Pipeline/Lit");
            if(!shader||!shader.isSupported)throw new InvalidOperationException("URP Lit unavailable.");
            if(!mat){mat=new Material(shader);AssetDatabase.CreateAsset(mat,path);}
            mat.shader=shader;
            // Keep the imported wildlife tint, not a replacement palette.
            var colorProperty=original.HasProperty("_BaseColor")?"_BaseColor":original.HasProperty("_BaseColorFactor")?"_BaseColorFactor":original.HasProperty("baseColorFactor")?"baseColorFactor":original.HasProperty("_Color")?"_Color":null;
            if(colorProperty==null)throw new InvalidOperationException("Imported wildlife tint unavailable: "+original.name);
            mat.SetColor("_BaseColor",original.GetColor(colorProperty));
            mat.SetTexture("_BaseMap",Texture(kind,"base"));
            mat.SetTexture("_MetallicGlossMap",Texture(kind,"mask"));
            mat.SetFloat("_Smoothness",1);mat.SetFloat("_Metallic",1);
            mat.SetTexture("_BumpMap",Texture(kind,"normal"));mat.SetFloat("_BumpScale",.8f);
            mat.EnableKeyword("_METALLICSPECGLOSSMAP");mat.EnableKeyword("_NORMALMAP");
            mat.DisableKeyword("_SMOOTHNESS_TEXTURE_ALBEDO_CHANNEL_A");
            EditorUtility.SetDirty(mat);return mat;
        }
        static Texture2D Texture(string kind,string role){
            var t=AssetDatabase.LoadAssetAtPath<Texture2D>(Out+"/"+kind+"_"+role+".png");
            if(!t)throw new InvalidOperationException("Missing shared texture: "+kind+"/"+role);return t;
        }
        internal static void Apply(GameObject instance,string id){
            if(!BodyKinds.TryGetValue(id,out var bodyKind))return;
            int count=0,meshIndex=0;
            foreach(var renderer in instance.GetComponentsInChildren<SkinnedMeshRenderer>(true)){
                meshIndex++;
                var mats=renderer.sharedMaterials;
                if(!mats.Any(m=>m&&Kind(m.name,bodyKind)!=null))continue;
                var mesh=renderer.sharedMesh;
                if(!mesh||!mesh.HasVertexAttribute(VertexAttribute.TexCoord0))
                    throw new InvalidOperationException("Wildlife detail mesh missing UVs: "+id);
                if(!mesh.HasVertexAttribute(VertexAttribute.Tangent)){
                    if(!mesh.isReadable)throw new InvalidOperationException("Wildlife detail mesh must be readable for tangent generation: "+id);
                    var clone=UnityEngine.Object.Instantiate(mesh);
                    clone.RecalculateTangents();
                    if(!clone.HasVertexAttribute(VertexAttribute.Tangent)){UnityEngine.Object.DestroyImmediate(clone);throw new InvalidOperationException("Tangent generation failed: "+id);}
                    var path=Out+"/"+id+"_tangents_"+meshIndex+".asset";
                    var saved=AssetDatabase.LoadAssetAtPath<Mesh>(path);
                    if(saved){EditorUtility.CopySerialized(clone,saved);UnityEngine.Object.DestroyImmediate(clone);}
                    else{saved=clone;AssetDatabase.CreateAsset(saved,path);}
                    renderer.sharedMesh=saved;
                }
                for(int i=0;i<mats.Length;i++){
                    if(!mats[i])continue;var kind=Kind(mats[i].name,bodyKind);
                    if(kind==null)continue;
                    mats[i]=Shared(mats[i],kind,id);count++;
                }
                renderer.sharedMaterials=mats;
            }
            if(count==0)throw new InvalidOperationException("No enhanced wildlife material matched: "+id);
        }
    }
}
