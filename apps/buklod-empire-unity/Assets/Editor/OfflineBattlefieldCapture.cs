using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
namespace Buklod.Empire.Editor {
    // Static editor scene evidence, never an assertion of gameplay or device quality.
    internal static class OfflineBattlefieldCapture {
        const int Width=1280,Height=720;
        const string Out="Builds/OfflineReview/VisualEvidence";
        [Serializable] sealed class Row {public string file,sha256;public int width,height;}
        [Serializable] sealed class Receipt {public string status,sceneDependencyHash;public Row[] rows;public bool deviceVerified,visualApproved;}
        static string Hash(byte[] b){using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(b)).Replace("-","").ToLowerInvariant();}
        internal static void Capture(BattleView view){
            if(!view||!view.battleCamera||!view.IsConfiguredReview)throw new BuildFailedException("Offline capture requires the isolated scene.");
            Directory.CreateDirectory(Out);
            string receipt=Out+"/battlefield-manifest.json";
            if(File.Exists(receipt))File.Delete(receipt);
            var camera=view.battleCamera;var oldPosition=camera.transform.position;var oldRotation=camera.transform.rotation;
            float oldSize=camera.orthographicSize,oldAspect=camera.aspect;
            var active=RenderTexture.active;
            var target=RenderTexture.GetTemporary(Width,Height,24,RenderTextureFormat.ARGB32,RenderTextureReadWrite.sRGB);
            var pixels=new Texture2D(Width,Height,TextureFormat.RGBA32,false);
            try{
                camera.aspect=(float)Width/Height;camera.orthographicSize=StylizedArenaPresentation.OrthographicSize;
                camera.transform.rotation=StylizedArenaPresentation.CameraRotation;
                var points=new[]{(id:"lux-base",x:17f),(id:"central-rift",x:OfflineBattle.Width*.5f),(id:"tenebra-base",x:OfflineBattle.Width-17f)};
                var rows=new System.Collections.Generic.List<Row>();
                foreach(var point in points){
                    var at=new Vector3(point.x*view.worldScale,0,OfflineBattle.Height*.5f*view.worldScale);
                    camera.transform.position=at+StylizedArenaPresentation.CameraOffset;
                    var request=new UniversalRenderPipeline.SingleCameraRequest{destination=target};
                    if(!RenderPipeline.SupportsRenderRequest(camera,request))throw new BuildFailedException("Offline capture render request unsupported.");
                    RenderPipeline.SubmitRenderRequest(camera,request);
                    RenderTexture.active=target;
                    pixels.ReadPixels(new Rect(0,0,Width,Height),0,0);pixels.Apply();
                    var colors=pixels.GetPixels32();int min=255,max=0;
                    foreach(var c in colors){int l=(c.r+c.g+c.b)/3;min=Math.Min(min,l);max=Math.Max(max,l);}
                    if(max-min<20)throw new BuildFailedException("Blank battlefield frame "+point.id);
                    var data=pixels.EncodeToPNG();
                    string file=point.id+".png";File.WriteAllBytes(Out+"/"+file,data);
                    rows.Add(new Row{file=file,sha256=Hash(data),width=Width,height=Height});
                }
                File.WriteAllText(receipt,JsonUtility.ToJson(new Receipt{status="STATIC_EDITOR_RENDER_EVIDENCE_ONLY",sceneDependencyHash=AssetDatabase.GetAssetDependencyHash(StylizedArenaBenchmark.ScenePath).ToString(),rows=rows.ToArray(),deviceVerified=false,visualApproved=false},true));
                Debug.Log("BUKLOD_OFFLINE_STATIC_RENDER_EVIDENCE: 3 battlefield views at "+Out);
            }finally{
                camera.transform.position=oldPosition;camera.transform.rotation=oldRotation;camera.orthographicSize=oldSize;camera.aspect=oldAspect;
                RenderTexture.active=active;RenderTexture.ReleaseTemporary(target);UnityEngine.Object.DestroyImmediate(pixels);
            }
        }
    }
}
