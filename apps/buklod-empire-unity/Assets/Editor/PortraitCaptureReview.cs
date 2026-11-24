using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
namespace Buklod.Empire.Editor {
    // Local GPU capture of existing unapproved meshes, not generated concept art.
    public static class PortraitCaptureReview {
        const string Out=CandidateReviewComposer.Out+"/Portraits";
        const int Width=512,Height=640;
        [Serializable] sealed class Row {public string id,sourceHash,sha256;}
        [Serializable] sealed class Receipt {public string status;public Row[] rows;}
        static string Prefab(string id)=>CandidateReviewComposer.Out+"/Prefabs/"+id+".prefab";
        static string SourceHash(string id)=>AssetDatabase.GetAssetDependencyHash(Prefab(id)).ToString();
        static string Hash(byte[] bytes){using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();}
        [MenuItem("BUKLOD Empire/Capture all 13 review portraits")]
        public static void Capture(){
            if(SystemInfo.graphicsDeviceType==GraphicsDeviceType.Null)throw new InvalidOperationException("A local Unity graphics device is required.");
            var setup=EditorSceneManager.GetSceneManagerSetup();
            for(int i=0;i<SceneManager.sceneCount;i++){
                var scene=SceneManager.GetSceneAt(i);
                if(scene.isDirty||string.IsNullOrEmpty(scene.path))throw new InvalidOperationException("Save all scenes before portrait capture.");
            }
            Directory.CreateDirectory(Out);
            string receipt=Out+"/manifest.json";
            if(File.Exists(receipt))File.Delete(receipt);
            var rows=new System.Collections.Generic.List<Row>();
            try{
                foreach(var hero in HeroKitCatalog.All){
                    HeroPortraitReviewComposer.Prepare(hero.Id);
                    var cam=GameObject.Find("Face and armor detail camera")?.GetComponent<Camera>();
                    if(!cam)throw new InvalidOperationException("Missing portrait camera: "+hero.Id);
                    var bytes=CaptureCamera(cam);
                    File.WriteAllBytes(Out+"/"+hero.Id+".tga",bytes);
                    rows.Add(new Row{id=hero.Id,sourceHash=SourceHash(hero.Id),sha256=Hash(bytes)});
                }
                File.WriteAllText(receipt,JsonUtility.ToJson(new Receipt{status="REVIEW_ONLY",rows=rows.ToArray()},true));
                AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            }finally{EditorSceneManager.RestoreSceneManagerSetup(setup);}
        }
        static byte[] CaptureCamera(Camera camera){
            var previous=RenderTexture.active;
            var target=RenderTexture.GetTemporary(Width,Height,24,RenderTextureFormat.ARGB32,RenderTextureReadWrite.sRGB);
            var pixels=new Texture2D(Width,Height,TextureFormat.RGBA32,false);
            float oldAspect=camera.aspect;camera.aspect=(float)Width/Height;
            try{
                var request=new UniversalRenderPipeline.SingleCameraRequest{destination=target};
                if(!RenderPipeline.SupportsRenderRequest(camera,request))throw new InvalidOperationException("URP capture request unsupported.");
                RenderPipeline.SubmitRenderRequest(camera,request);
                RenderTexture.active=target;pixels.ReadPixels(new Rect(0,0,Width,Height),0,0);pixels.Apply();
                var colors=pixels.GetPixels32();int min=255,max=0;
                var tga=new byte[18+colors.Length*4];
                tga[2]=2;tga[12]=(byte)(Width&255);tga[13]=(byte)(Width>>8);tga[14]=(byte)(Height&255);tga[15]=(byte)(Height>>8);tga[16]=32;tga[17]=8;
                for(int i=0;i<colors.Length;i++){
                    var c=colors[i];int at=18+i*4;tga[at]=c.b;tga[at+1]=c.g;tga[at+2]=c.r;tga[at+3]=255;
                    int light=(c.r+c.g+c.b)/3;min=Math.Min(min,light);max=Math.Max(max,light);
                }
                if(max-min<20)throw new InvalidOperationException("Flat or blank portrait capture.");
                return tga;
            }finally{camera.aspect=oldAspect;RenderTexture.active=previous;RenderTexture.ReleaseTemporary(target);UnityEngine.Object.DestroyImmediate(pixels);}
        }
        internal static void Bind(GameObject root){
            string manifest=Out+"/manifest.json";
            if(!File.Exists(manifest))return; // optional: retain existing vector hero cards
            var doc=JsonUtility.FromJson<Receipt>(File.ReadAllText(manifest));
            var ids=HeroKitCatalog.All.Select(h=>h.Id).ToArray();
            if(doc==null||doc.status!="REVIEW_ONLY"||doc.rows==null||doc.rows.Length!=ids.Length)throw new InvalidOperationException("Incomplete portrait manifest.");
            var portraits=new Texture2D[ids.Length];
            for(int i=0;i<ids.Length;i++){
                string id=ids[i],path=Out+"/"+id+".tga";
                var row=doc.rows.SingleOrDefault(x=>x!=null&&x.id==id);
                if(row==null||row.sourceHash!=SourceHash(id)||!File.Exists(path)||Hash(File.ReadAllBytes(path))!=row.sha256)
                    throw new InvalidOperationException("Stale or invalid portrait: "+id+". Recapture the review roster.");
                var tex=AssetDatabase.LoadAssetAtPath<Texture2D>(path);
                if(!tex||tex.width!=Width||tex.height!=Height)throw new InvalidOperationException("Unexpected portrait dimensions: "+id);
                portraits[i]=tex;
            }
            var component=root.AddComponent<ReviewPortraits>();component.ids=ids;component.portraits=portraits;
        }
    }
}
