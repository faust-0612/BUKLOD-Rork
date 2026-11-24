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
            int water=0,leaves=0,cascades=0;
            Material cascade=null;
            foreach(var renderer in map.GetComponentsInChildren<Renderer>(true)){
                var materials=renderer.sharedMaterials;bool changed=false;
                for(int i=0;i<materials.Length;i++){
                    var m=materials[i];if(!m)continue;
                    if(string.Equals(m.name,"water",StringComparison.OrdinalIgnoreCase)){materials[i]=river;water++;changed=true;}
                    else if(m.name=="rift_cascade"){if(!cascade)cascade=GetMaterial("ReviewRiftCascade","BUKLOD/Review/RiftCascade");materials[i]=cascade;cascades++;changed=true;}
                    else if(m.name=="border_leaf_0"){materials[i]=leafA;leaves++;changed=true;}
                    else if(m.name=="border_leaf_1"){materials[i]=leafB;leaves++;changed=true;}
                }
                if(changed)renderer.sharedMaterials=materials;
            }
            if(water==0||leaves!=2)throw new InvalidOperationException("Expected river and both border foliage materials. Inspect imported material names.");
            if(cascades>1)throw new InvalidOperationException("Unexpected duplicate cascade material group.");
            string path=Out+"/EnvironmentReviewVolume.asset";
            var profile=AssetDatabase.LoadAssetAtPath<VolumeProfile>(path);
            if(!profile){profile=ScriptableObject.CreateInstance<VolumeProfile>();AssetDatabase.CreateAsset(profile,path);}
            var bloom=Get<Bloom>(profile);
            bloom.threshold.Override(1.25f);bloom.intensity.Override(.24f);bloom.scatter.Override(.58f);
            var grading=Get<ColorAdjustments>(profile);
            grading.postExposure.Override(.06f);grading.contrast.Override(10f);grading.saturation.Override(4f);
            var balance=Get<WhiteBalance>(profile);balance.temperature.Override(-4f);balance.tint.Override(2f);
            var vignette=Get<Vignette>(profile);vignette.intensity.Override(.10f);vignette.smoothness.Override(.72f);
            vignette.color.Override(new Color(.08f,.12f,.17f));
            EditorUtility.SetDirty(balance);EditorUtility.SetDirty(vignette);
            var tone=Get<Tonemapping>(profile);tone.mode.Override(TonemappingMode.Neutral);
            EditorUtility.SetDirty(profile);EditorUtility.SetDirty(bloom);EditorUtility.SetDirty(grading);EditorUtility.SetDirty(tone);
            var volume=new GameObject("Review atmospheric grade",typeof(Volume)).GetComponent<Volume>();
            volume.isGlobal=true;volume.priority=10;volume.sharedProfile=profile;
            var data=camera.GetUniversalAdditionalCameraData();
            data.renderPostProcessing=true;data.antialiasing=AntialiasingMode.SubpixelMorphologicalAntiAliasing;
            data.antialiasingQuality=AntialiasingQuality.High;
            data.volumeLayerMask=data.volumeLayerMask.value|(1<<volume.gameObject.layer);
            camera.allowHDR=true;
            var cube=ReviewSkyReflection();
            river.SetTexture("_ReviewSkyCube",cube);river.SetFloat("_ReflectionStrength",.38f);EditorUtility.SetDirty(river);
            RenderSettings.defaultReflectionMode=DefaultReflectionMode.Custom;
            RenderSettings.customReflectionTexture=cube;
            RenderSettings.reflectionIntensity=1.05f;
            // Far haze; do not obscure nearby actors, targeting or the HUD.
            RenderSettings.fog=true;RenderSettings.fogMode=FogMode.Linear;
            RenderSettings.fogColor=new Color(.35f,.46f,.55f);RenderSettings.fogStartDistance=52;RenderSettings.fogEndDistance=145;
            Debug.Log("Review environment water, animated foliage and cinematic grade configured. Verify on device before approving.");
        }
        // Original environment reflection, no downloaded HDRI and no per-frame capture.
        internal static Cubemap ReviewSkyReflection(){
            const int size=128;string path=Out+"/ReviewSkyReflection.asset";
            var cube=AssetDatabase.LoadAssetAtPath<Cubemap>(path);
            if(cube)return cube;
            cube=new Cubemap(size,TextureFormat.RGBAHalf,true);
            var faces=new[]{CubemapFace.PositiveX,CubemapFace.NegativeX,CubemapFace.PositiveY,CubemapFace.NegativeY,CubemapFace.PositiveZ,CubemapFace.NegativeZ};
            var sun=new Vector3(-.45f,.78f,-.35f).normalized;
            foreach(var face in faces){
                var pixels=new Color[size*size];
                for(int y=0;y<size;y++)for(int x=0;x<size;x++){
                    float u=2*(x+.5f)/size-1,v=2*(y+.5f)/size-1;
                    Vector3 dir;
                    switch(face){
                        case CubemapFace.PositiveX:dir=new Vector3(1,-v,-u);break;
                        case CubemapFace.NegativeX:dir=new Vector3(-1,-v,u);break;
                        case CubemapFace.PositiveY:dir=new Vector3(u,1,v);break;
                        case CubemapFace.NegativeY:dir=new Vector3(u,-1,-v);break;
                        case CubemapFace.PositiveZ:dir=new Vector3(u,-v,1);break;
                        default:dir=new Vector3(-u,-v,-1);break;
                    }
                    dir.Normalize();
                    var horizon=new Color(.52f,.63f,.69f);
                    var sky=Color.Lerp(horizon,new Color(.14f,.32f,.62f),Mathf.Clamp01(dir.y));
                    if(dir.y<0)sky=Color.Lerp(horizon,new Color(.12f,.16f,.12f),-dir.y);
                    float lobe=Mathf.Pow(Mathf.Max(0,Vector3.Dot(dir,sun)),32)*2.4f;
                    pixels[y*size+x]=sky+new Color(1,.78f,.48f)*lobe;
                }
                cube.SetPixels(pixels,face);
            }
            cube.Apply(true,false);AssetDatabase.CreateAsset(cube,path);return cube;
        }
        static T Get<T>(VolumeProfile profile) where T:VolumeComponent{
            if(profile.TryGet<T>(out var existing))return existing;
            var component=profile.Add<T>(true);component.name=typeof(T).Name;AssetDatabase.AddObjectToAsset(component,profile);return component;
        }
    }
}
