using System;
using UnityEditor;
using UnityEngine;
namespace Buklod.Empire.Editor {
    internal static class SkillParticleMaterial {
        public static Material Get(string path){
            var shader=Shader.Find("BUKLOD/SkillParticles");
            if(!shader||!shader.isSupported)throw new InvalidOperationException("Skill particle shader unavailable on current editor renderer.");
            var material=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(!material){material=new Material(shader);AssetDatabase.CreateAsset(material,path);}
            else if(material.shader!=shader)material.shader=shader;
            material.SetFloat("_Energy",3.2f);EditorUtility.SetDirty(material);return material;
        }
    }
}
