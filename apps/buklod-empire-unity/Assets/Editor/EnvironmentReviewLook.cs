using System;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Buklod.Empire.Editor {
    // All materials and volume assets live in the ignored review folder.
    // Do not touch global pipeline assets, quality settings, approved scenes or build settings.
    internal static class EnvironmentReviewLook {
        const string Out=CandidateReviewComposer.Out;
        static Material GetMaterial(string name,string shaderName){
            var shader=Shader.Find(shaderName);
            if(!shader||!shader.isSupported)throw new InvalidOperationException("Review shader missing or unsupported: "+shaderName);
            string path=Out+"/"+name+".mat";
            var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(!mat){mat=new Material(shader);AssetDatabase.CreateAsset(mat,path);}
            else if(mat.shader!=shader){mat.shader=shader;EditorUtility.SetDirty(mat);}
            return mat;
        }
        public static void Apply(GameObject map,Camera camera){
            var river=GetMaterial("ReviewRiftWater","BUKLOD/Review/RiftWater");
            var leafA=GetMaterial("ReviewLeafA","BUKLOD/Review/WindLeaf");
            var leafB=GetMaterial("ReviewLeafB","BUKLOD/Review/WindLeaf");
            leafA.SetColor("_BaseColor",new Color(.27f,.44f,.16f));
            leafB.SetColor("_BaseColor",new Color(.15f,.33f,.13f));
            EditorUtility.SetDirty(leafA);EditorUtility.SetDirty(leafB);
            int water=0,leaves=0;
            foreach(var renderer in map.GetComponentsInChildren<Renderer>(true)){
                var materials=renderer.sharedMaterials;bool changed=false;
                for(int i=0;i<materials.Length;i++){
                    var m=materials[i];if(!m)continue;
                    if(string.Equals(m.name,"water",StringComparison.OrdinalIgnoreCase)){materials[i]=river;water++;changed=true;}
                    else if(m.name=="border_leaf_0"){materials[i]=leafA;leaves++;changed=true;}
                    else if(m.name=="border_leaf_1"){materials[i]=leafB;leaves++;changed=true;}
                }
                if(changed)renderer.sharedMaterials=materials;
            }
            if(water==0||leaves!=2)throw new InvalidOperationException("Expected river and both border foliage materials. Inspect imported material names.");
            string path=Out+"/EnvironmentReviewVolume.asset";
            var profile=AssetDatabase.LoadAssetAtPath<VolumeProfile>(path);
            if(!profile){profile=ScriptableObject.CreateInstance<VolumeProfile>();AssetDatabase.CreateAsset(profile,path);}
            var bloom=Get<Bloom>(profile);
            bloom.threshold.Override(1.15f);bloom.intensity.Override(.22f);bloom.scatter.Override(.55f);
            var grading=Get<ColorAdjustments>(profile);
            grading.postExposure.Override(.08f);grading.contrast.Override(9f);grading.saturation.Override(5f);
            var tone=Get<Tonemapping>(profile);tone.mode.Override(TonemappingMode.Neutral);
            EditorUtility.SetDirty(profile);EditorUtility.SetDirty(bloom);EditorUtility.SetDirty(grading);EditorUtility.SetDirty(tone);
            var volume=new GameObject("Review atmospheric grade",typeof(Volume)).GetComponent<Volume>();
            volume.isGlobal=true;volume.priority=10;volume.sharedProfile=profile;
            var data=camera.GetUniversalAdditionalCameraData();
            data.renderPostProcessing=true;data.antialiasing=AntialiasingMode.FastApproximateAntialiasing;
            data.volumeLayerMask=data.volumeLayerMask.value|(1<<volume.gameObject.layer);
            camera.allowHDR=true;
            // Far haze; do not obscure nearby actors, targeting or the HUD.
            RenderSettings.fog=true;RenderSettings.fogMode=FogMode.Linear;
            RenderSettings.fogColor=new Color(.31f,.42f,.49f);RenderSettings.fogStartDistance=45;RenderSettings.fogEndDistance=120;
            Debug.Log("Review environment water, animated foliage and cinematic grade configured. Verify on device before approving.");
        }
        static T Get<T>(VolumeProfile profile) where T:VolumeComponent{
            if(profile.TryGet<T>(out var existing))return existing;
            var component=profile.Add<T>(true);component.name=typeof(T).Name;AssetDatabase.AddObjectToAsset(component,profile);return component;
        }
    }
}
