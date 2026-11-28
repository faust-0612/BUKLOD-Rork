using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEngine;

namespace Buklod.Empire.Editor {
    // Private authoring viewer: no gameplay prefab, catalog, scene, or build settings writes.
    public sealed class OwnerHeroStudio:EditorWindow {
        const string Root="Assets/Generated/ReviewOnly/OwnerHeroStudio";
        const string Source="Tools/ReviewOutput/owner-hero-candidates/models";
        sealed class Candidate {
            public readonly string File,Hash;public readonly int Triangles;public readonly string[] Clips;
            public Candidate(string file,string hash,int triangles,params string[] clips){File=file;Hash=hash;Triangles=triangles;Clips=clips;}
        }
        static readonly Candidate[] Models={
            new Candidate("azure-champion-2048.glb","ae752eb227b2a7a558f0eff7f9a1b0d069005675228f3d13d37bca382e91a075",150000,
                "death","hit_chest","idle","jog_fwd_loop","jump_land","jump_loop","jump_start","roll","sprint_loop","sword_enter","sword_exit","sword_idle","sword_regular_a","sword_regular_b","sword_regular_c","walk_loop"),
            new Candidate("t1-sentinel-2048.glb","795a9c65823692cb337bd1a8a601182cb860b7f8a2ca3b76fcb2d7a5cdfdaa53",149880,
                "death","hit_chest","idle","sword_attack","sword_block","sword_idle","walk_loop"),
            new Candidate("hooded-blade-2048.glb","d4f132d307c8a49efd36ef770660e14edd3d5e7e863275d093153f86fa9ad591",150000,
                "idle","jog_fwd_loop","kick","punch_jab","sprint_loop","walk_loop")
        };
        PreviewRenderUtility preview;GameObject actor;
        AnimationClip[] clips=Array.Empty<AnimationClip>();
        Transform[] bones;Vector3[] positions,scales;Quaternion[] rotations;
        int selected,clipIndex;float time,yaw=25,pitch=8,zoom=1;
        bool playing;double last;Bounds bounds;string error;
        [MenuItem("BUKLOD Empire/Character Studio (private candidates)")]
        static void Open(){GetWindow<OwnerHeroStudio>("Hero Studio");}
        static string Hash(string path){using(var f=File.OpenRead(path))using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(f)).Replace("-","").ToLowerInvariant();}
        static string ModelPath(Candidate c)=>Root+"/"+c.File;
        static void VerifyInputs(){
            // Check all three immutable inputs before touching the generated asset tree.
            foreach(var c in Models){
                string path=Source+"/"+c.File;
                if(!File.Exists(path)||Hash(path)!=c.Hash)throw new InvalidOperationException("Missing or changed private input: "+path);
            }
        }
        static void Import(){
            if(EditorApplication.isPlayingOrWillChangePlaymode||EditorApplication.isCompiling)throw new InvalidOperationException("Stop playback/compilation before importing.");
            VerifyInputs();
            Directory.CreateDirectory(Root);
            foreach(var c in Models){
                var path=ModelPath(c);
                if(!File.Exists(path)||Hash(path)!=c.Hash)File.Copy(Source+"/"+c.File,path,true);
            }
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            foreach(var c in Models)Validate(c);
        }
        static AnimationClip[] Validate(Candidate c){
            var path=ModelPath(c);
            if(!File.Exists(path)||Hash(path)!=c.Hash)throw new InvalidOperationException("Import the pinned candidate first: "+c.File);
            var asset=AssetDatabase.LoadAssetAtPath<GameObject>(path);
            if(!asset)throw new InvalidOperationException("glTFast model unavailable: "+c.File);
            var skin=asset.GetComponentsInChildren<SkinnedMeshRenderer>(true);
            if(skin.Length!=1||!skin[0].sharedMesh||skin[0].bones.Length!=22||skin[0].bones.Any(b=>!b))
                throw new InvalidOperationException("Expected actual 22-joint skin: "+c.File);
            var mesh=skin[0].sharedMesh;ulong tris=0;
            for(int i=0;i<mesh.subMeshCount;i++){if(mesh.GetTopology(i)!=MeshTopology.Triangles)throw new InvalidOperationException("Nontriangle mesh.");tris+=mesh.GetIndexCount(i)/3;}
            if(tris!=(ulong)c.Triangles)throw new InvalidOperationException("Triangle count drift: "+c.File);
            var imported=AssetDatabase.LoadAllAssetsAtPath(path).OfType<AnimationClip>().Where(x=>x&&x.length>0).ToArray();
            // Never invent or silently substitute a missing action.
            return c.Clips.Select(name=>{
                var hits=imported.Where(x=>x.name==name).ToArray();
                if(hits.Length!=1)throw new InvalidOperationException("Missing or ambiguous imported clip: "+c.File+"/"+name);
                return hits[0];
            }).ToArray();
        }
        void OnEnable(){EditorApplication.update+=Tick;last=EditorApplication.timeSinceStartup;}
        void OnDisable(){EditorApplication.update-=Tick;Release();}
        void Release(){
            playing=false;
            if(preview!=null){preview.Cleanup();preview=null;}
            actor=null;bones=null;clips=Array.Empty<AnimationClip>();
        }
        void Load(){
            Release();error=null;
            try{
                var c=Models[selected];clips=Validate(c);
                preview=new PreviewRenderUtility();preview.cameraFieldOfView=34;
                preview.camera.clearFlags=CameraClearFlags.Color;preview.camera.backgroundColor=new Color(.035f,.045f,.07f);
                preview.camera.allowHDR=true;preview.camera.nearClipPlane=.01f;preview.camera.farClipPlane=100;
                preview.ambientColor=new Color(.27f,.31f,.39f);
                preview.lights[0].color=new Color(1,.91f,.8f);preview.lights[0].intensity=2.2f;preview.lights[0].transform.rotation=Quaternion.Euler(35,35,0);
                preview.lights[1].color=new Color(.4f,.7f,1);preview.lights[1].intensity=1.5f;preview.lights[1].transform.rotation=Quaternion.Euler(25,215,0);
                actor=Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>(ModelPath(c)));actor.hideFlags=HideFlags.HideAndDontSave;
                foreach(var a in actor.GetComponentsInChildren<Animator>(true))a.enabled=false;
                foreach(var a in actor.GetComponentsInChildren<Animation>(true))a.enabled=false;
                foreach(var b in actor.GetComponentsInChildren<MonoBehaviour>(true))b.enabled=false;
                preview.AddSingleGO(actor);
                bones=actor.GetComponentsInChildren<Transform>(true);positions=bones.Select(b=>b.localPosition).ToArray();
                rotations=bones.Select(b=>b.localRotation).ToArray();scales=bones.Select(b=>b.localScale).ToArray();
                var skin=actor.GetComponentInChildren<SkinnedMeshRenderer>(true);skin.updateWhenOffscreen=true;
                bounds=skin.bounds;if(bounds.size.y<=.001f||!Finite(bounds.center)||!Finite(bounds.size))throw new InvalidOperationException("Invalid imported character framing.");
                clipIndex=Array.FindIndex(clips,x=>x.name=="idle");if(clipIndex<0)throw new InvalidOperationException("Idle clip missing.");
                time=0;playing=true;last=EditorApplication.timeSinceStartup;Sample();
            }catch(Exception e){Release();error=e.Message;}
        }
        static bool Finite(Vector3 v)=>!float.IsNaN(v.sqrMagnitude)&&!float.IsInfinity(v.sqrMagnitude);
        void Sample(){
            if(!actor||clips.Length==0||bones==null)return;
            for(int i=0;i<bones.Length;i++){bones[i].localPosition=positions[i];bones[i].localRotation=rotations[i];bones[i].localScale=scales[i];}
            clips[clipIndex].SampleAnimation(actor,time);
        }
        void Tick(){
            double now=EditorApplication.timeSinceStartup;float dt=(float)Math.Min(.05,Math.Max(0,now-last));last=now;
            if(!playing||!actor||clips.Length==0)return;
            time=Mathf.Repeat(time+dt,clips[clipIndex].length);Sample();Repaint();
        }
        void OnGUI(){
            EditorGUILayout.LabelField("BUKLOD EMPIRE / CHARACTER STUDIO",EditorStyles.boldLabel);
            EditorGUILayout.HelpBox("Private authored candidate review. Not a playable hero or rights approval. The model, skin and original motion clips are rendered directly.",MessageType.Info);
            if(GUILayout.Button("Import exact optimized Library candidates")){
                try{Release();Import();Load();}catch(Exception e){error=e.Message;}
            }
            int next=EditorGUILayout.Popup("Character",selected,Models.Select(c=>c.File.Replace("-2048.glb","")).ToArray());
            if(next!=selected){selected=next;Load();}
            if(error!=null)EditorGUILayout.HelpBox(error,MessageType.Error);
            if(!actor||preview==null||clips.Length==0){if(GUILayout.Button("Load imported candidate"))Load();return;}
            var chosen=EditorGUILayout.Popup("Actual motion",clipIndex,clips.Select(c=>c.name).ToArray());
            if(chosen!=clipIndex){clipIndex=chosen;time=0;Sample();}
            EditorGUILayout.BeginHorizontal();
            if(GUILayout.Button(playing?"Pause":"Play",GUILayout.Width(80)))playing=!playing;
            if(GUILayout.Button("Restart",GUILayout.Width(80))){time=0;Sample();}
            float seek=EditorGUILayout.Slider(time,0,clips[clipIndex].length);if(!Mathf.Approximately(seek,time)){time=seek;Sample();}
            EditorGUILayout.EndHorizontal();
            yaw=EditorGUILayout.Slider("Orbit",yaw,-180,180);pitch=EditorGUILayout.Slider("Elevation",pitch,-12,35);zoom=EditorGUILayout.Slider("Zoom",zoom,.75f,1.7f);
            EditorGUILayout.LabelField(Models[selected].Triangles.ToString("N0")+" triangles • 22 joints • "+clips.Length+" original motion clips");
            var rect=GUILayoutUtility.GetRect(120,10000,240,10000);
            if(Event.current.type!=EventType.Repaint||rect.width<2||rect.height<2)return;
            float aspect=rect.width/rect.height;
            float extent=Mathf.Max(bounds.size.y,bounds.size.x/Mathf.Max(.2f,aspect),bounds.size.z);
            float distance=extent*.65f/Mathf.Tan(preview.cameraFieldOfView*.5f*Mathf.Deg2Rad)*zoom;
            var rotation=Quaternion.Euler(pitch,yaw,0);
            preview.camera.transform.position=bounds.center+rotation*Vector3.back*distance;
            preview.camera.transform.LookAt(bounds.center);
            preview.BeginPreview(rect,GUIStyle.none);
            preview.Render(true);
            var texture=preview.EndPreview();GUI.DrawTexture(rect,texture,ScaleMode.StretchToFill,false);
        }
    }
}
