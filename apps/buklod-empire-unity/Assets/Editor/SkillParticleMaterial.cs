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
            material.SetFloat("_Energy",3.2f);
            material.SetFloat("_UseAuthored",AuthoredExpansionReview.Requested?1:0);
            if(AuthoredExpansionReview.Requested){
                const string root="Assets/Generated/ReviewOnly/AuthoredExpansion/vfx/addons/kenney_particle_pack/";
                var glow=AssetDatabase.LoadAssetAtPath<Texture2D>(root+"light_03.png");
                var magic=AssetDatabase.LoadAssetAtPath<Texture2D>(root+"magic_03.png");
                if(!glow||!magic)throw new InvalidOperationException("Authored particle textures not imported.");
                material.SetTexture("_AuthoredLight",glow);material.SetTexture("_AuthoredMagic",magic);
            }else {material.SetTexture("_AuthoredLight",null);material.SetTexture("_AuthoredMagic",null);}
            EditorUtility.SetDirty(material);return material;
        }
    }
}
