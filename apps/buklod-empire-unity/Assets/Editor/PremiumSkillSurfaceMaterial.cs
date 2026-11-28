using System;
using UnityEditor;
using UnityEngine;
namespace Buklod.Empire.Editor {
    internal static class PremiumSkillSurfaceMaterial {
        internal static Material Get(string path){
            var shader=Shader.Find("BUKLOD/PremiumSkillSurface");
            if(!shader||!shader.isSupported||ShaderUtil.ShaderHasError(shader))throw new InvalidOperationException("Premium surface shader unavailable.");
            var material=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(!material){material=new Material(shader);AssetDatabase.CreateAsset(material,path);}
            else if(material.shader!=shader)material.shader=shader;
            material.SetFloat("_Intensity",1.6f);EditorUtility.SetDirty(material);return material;
        }
    }
}
