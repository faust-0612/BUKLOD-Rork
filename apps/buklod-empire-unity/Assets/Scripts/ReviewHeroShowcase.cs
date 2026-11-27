using System;
using System.Linq;
using UnityEngine;
using UnityEngine.Rendering.Universal;
namespace Buklod.Empire {
    // A single off-field camera, RT and current model. Never instantiates a BattleUnit.
    // The stage is isolated from battlefield input, AI, collisions and scene camera.
    public sealed class ReviewHeroShowcase:MonoBehaviour {
        const int StageLayer=31;
        BattleView view;Camera stageCamera;RenderTexture target;GameObject actor;
        BattleEffects effects;Light key,rim;Animator animator;string modelId;Bounds bounds;
        float angle,appearedAt;bool map,close,visible,focused=true,appPaused;float demoUntil;GameObject dummy,platform;Material platformMat,trimMat;bool demoWasActive;ReviewEvolutionWings wings;int oldMask;bool maskOwned;
        Vector3 focus;
        internal Texture Texture=>target;
        internal void Initialize(BattleView owner){
            if(!owner||!owner.IsEditorReview||!owner.battleCamera)throw new InvalidOperationException("Review showcase only.");
            if(UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsInactive.Include,FindObjectsSortMode.None).Any(r=>r.gameObject.layer==StageLayer))throw new InvalidOperationException("Preview layer already occupied.");
            view=owner;oldMask=view.battleCamera.cullingMask;view.battleCamera.cullingMask=oldMask&~(1<<StageLayer);maskOwned=true;transform.position=new Vector3(-2000,0,-2000);
            gameObject.layer=StageLayer;
            var go=new GameObject("Isolated preview camera");go.transform.SetParent(transform,false);
            stageCamera=go.AddComponent<Camera>();stageCamera.enabled=false;stageCamera.cullingMask=1<<StageLayer;
            stageCamera.clearFlags=CameraClearFlags.SolidColor;stageCamera.backgroundColor=new Color(.025f,.045f,.075f);
            stageCamera.nearClipPlane=.03f;stageCamera.farClipPlane=1400;stageCamera.orthographic=true;stageCamera.allowHDR=true;
            var cameraData=stageCamera.GetUniversalAdditionalCameraData();cameraData.renderPostProcessing=true;cameraData.antialiasing=AntialiasingMode.SubpixelMorphologicalAntiAliasing;
            target=new RenderTexture(768,768,24,RenderTextureFormat.ARGB32){name="Empire live model preview",antiAliasing=1};
            if(!target.Create())throw new InvalidOperationException("Preview render target unavailable.");
            stageCamera.targetTexture=target;stageCamera.aspect=1;
            key=MakeLight("Showcase warm key",new Color(1,.88f,.72f),1.35f,new Vector3(34,145,0));
            rim=MakeLight("Showcase blue rim",new Color(.42f,.70f,1),.95f,new Vector3(30,-35,0));
            var source=owner.GetComponent<BattleEffects>();
            if(source&&source.pulseMaterial){
                effects=gameObject.AddComponent<BattleEffects>();effects.pulseMaterial=source.pulseMaterial;
                effects.skillParticleMaterial=source.skillParticleMaterial;effects.ConfigurePreview(stageCamera);
            }
            CreatePlatform();Hide();
        }
        void CreatePlatform(){
            var shader=Shader.Find("Universal Render Pipeline/Lit");if(!shader||!shader.isSupported)return;
            platform=new GameObject("Hero showcase stone plinth");platform.transform.SetParent(transform,false);platform.layer=StageLayer;
            platformMat=new Material(shader){name="Review showcase stone"};platformMat.SetColor("_BaseColor",new Color(.08f,.11f,.16f));platformMat.SetFloat("_Metallic",.22f);platformMat.SetFloat("_Smoothness",.45f);
            trimMat=new Material(shader){name="Review showcase metallic trim"};trimMat.SetColor("_BaseColor",new Color(.50f,.34f,.13f));trimMat.SetFloat("_Metallic",.75f);trimMat.SetFloat("_Smoothness",.6f);
            Disc("Stone plinth",Vector3.up*-.10f,new Vector3(2.2f,.07f,2.2f),platformMat);Disc("Metallic accent",Vector3.up*-.025f,new Vector3(2.04f,.025f,2.04f),trimMat);Disc("Dark stage surface",Vector3.up*.006f,new Vector3(1.95f,.012f,1.95f),platformMat);
        }
        void Disc(string name,Vector3 local,Vector3 scale,Material material){var go=GameObject.CreatePrimitive(PrimitiveType.Cylinder);go.name=name;go.transform.SetParent(platform.transform,false);go.transform.localPosition=local;go.transform.localScale=scale;go.layer=StageLayer;var c=go.GetComponent<Collider>();c.enabled=false;Destroy(c);go.GetComponent<Renderer>().sharedMaterial=material;}
        Light MakeLight(string id,Color color,float intensity,Vector3 rotation){
            var go=new GameObject(id);go.transform.SetParent(transform,false);var l=go.AddComponent<Light>();
            l.type=LightType.Directional;l.color=color;l.intensity=intensity;l.cullingMask=1<<StageLayer;
            l.transform.rotation=Quaternion.Euler(rotation);return l;
        }
        internal bool ShowHero(string id,bool face,ReviewPalette palette,bool evolution=false){
            if(!view||!view.visuals||view.visuals.heroes==null)return false;
            var row=view.visuals.heroes.FirstOrDefault(h=>h!=null&&h.id==id);
            if(row==null||!Show(row.prefab,id,false,face))return false;
            ReviewHeroPalette.Apply(actor,palette);SetWings(evolution&&!face);Frame();return true;
        }
        internal bool ShowMap()=>view&&view.visuals&&Show(view.visuals.genesisRift,"map",true,false);
        bool Show(GameObject prefab,string id,bool isMap,bool face){
            if(!prefab||!stageCamera||!target)return false;
            bool changed=!actor||modelId!=id;
            if(dummy){dummy.SetActive(false);Destroy(dummy);dummy=null;}demoWasActive=false;demoUntil=0;
            if(actor){actor.transform.localPosition=Vector3.zero;actor.transform.localRotation=Quaternion.identity;}
            if(changed){
                wings=null;if(effects)effects.Clear();
                if(actor){actor.SetActive(false);Destroy(actor);}
                // Inactive parent prevents prefab gameplay scripts from running before isolation.
                var holder=new GameObject("Visual-only "+id);holder.transform.SetParent(transform,false);holder.SetActive(false);
                actor=holder;
                var clone=Instantiate(prefab,holder.transform,false);
                Isolate(holder);
                foreach(var lod in holder.GetComponentsInChildren<LODGroup>(true))lod.ForceLOD(0);
                animator=holder.GetComponentInChildren<Animator>(true);
                if(animator){animator.applyRootMotion=false;animator.updateMode=AnimatorUpdateMode.UnscaledTime;animator.cullingMode=AnimatorCullingMode.AlwaysAnimate;}
                holder.SetActive(true);
                var equipment=holder.GetComponentInChildren<ReviewEquipmentVisual>(true);if(equipment)equipment.ResetVisual();
                if(isMap){var terrain=holder.GetComponentsInChildren<Renderer>(true).FirstOrDefault(r=>r.name.Contains("GenesisRift_terrain"));if(terrain&&Mathf.Abs(terrain.bounds.max.x-transform.position.x)<.1f)clone.transform.localScale=new Vector3(-clone.transform.localScale.x,clone.transform.localScale.y,clone.transform.localScale.z);}
                var rs=holder.GetComponentsInChildren<Renderer>(true).Where(r=>r.enabled&&r.gameObject.activeInHierarchy).ToArray();
                if(rs.Length==0){holder.SetActive(false);Destroy(holder);actor=null;return false;}
                bounds=rs[0].bounds;foreach(var r in rs.Skip(1))bounds.Encapsulate(r.bounds);
                if(bounds.size.sqrMagnitude<.01f){holder.SetActive(false);Destroy(holder);actor=null;return false;}
                // Recenter geometry on an invariant pivot, retaining the imported rig.
                clone.transform.position+=transform.position-bounds.center+Vector3.up*bounds.extents.y;
                bounds.center=transform.position+Vector3.up*bounds.extents.y;
                modelId=id;angle=0;appearedAt=Time.unscaledTime;demoUntil=0;
                if(isMap)AddMapLandmarks(holder);
                if(platform)platform.transform.localScale=Vector3.one*Mathf.Max(.6f,bounds.size.y*.85f);
                if(animator){animator.Rebind();animator.SetFloat("Speed",0);animator.Update(0);}
            }
            map=isMap;close=face;visible=true;actor.SetActive(true);key.enabled=rim.enabled=true;stageCamera.enabled=focused&&!appPaused&&Application.isFocused;if(animator)animator.speed=stageCamera.enabled?1:0;
            if(platform){platform.SetActive(!map);if(!map&&trimMat)trimMat.SetColor("_BaseColor",Color.Lerp(new Color(.50f,.34f,.13f),BattleEffects.Accent(modelId),.40f));}
            Frame();if(changed&&!map)PlayEntrance();return true;
        }
        void Isolate(GameObject root){
            foreach(var t in root.GetComponentsInChildren<Transform>(true))t.gameObject.layer=StageLayer;
                foreach(var c in root.GetComponentsInChildren<Collider>(true))c.enabled=false;
                foreach(var c in root.GetComponentsInChildren<Collider2D>(true))c.enabled=false;
                foreach(var c in root.GetComponentsInChildren<MonoBehaviour>(true))c.enabled=false;
                foreach(var c in root.GetComponentsInChildren<AudioSource>(true))c.enabled=false;
                foreach(var c in root.GetComponentsInChildren<Camera>(true))c.enabled=false;
                foreach(var c in root.GetComponentsInChildren<Light>(true))c.enabled=false;
                foreach(var c in root.GetComponentsInChildren<UnityEngine.AI.NavMeshAgent>(true))c.enabled=false;
                foreach(var c in root.GetComponentsInChildren<Rigidbody>(true)){c.isKinematic=true;c.detectCollisions=false;}
            foreach(var listener in root.GetComponentsInChildren<AudioListener>(true))listener.enabled=false;
            foreach(var animation in root.GetComponentsInChildren<Animation>(true))animation.enabled=false;
        }
        void AddMapLandmarks(GameObject holder){
            if(view.visuals.factions==null)return;
            foreach(var faction in view.visuals.factions){
                bool lux=faction.team==ArenaTeam.Lux;
                AddLandmark(holder,faction.core,new Vector2(lux?14:OfflineBattle.Width-14,OfflineBattle.Height*.5f));
                foreach(float lane in new[]{.19f,.5f,.81f})AddLandmark(holder,faction.tower,new Vector2(lux?35:OfflineBattle.Width-35,OfflineBattle.Height*lane));
            }
        }
        void AddLandmark(GameObject parent,GameObject prefab,Vector2 position){
            if(!prefab)return;var mount=new GameObject("Map landmark");mount.transform.SetParent(parent.transform,false);mount.SetActive(false);
            mount.transform.localPosition=new Vector3(position.x-OfflineBattle.Width*.5f,0,position.y-OfflineBattle.Height*.5f);
            Instantiate(prefab,mount.transform,false);Isolate(mount);mount.SetActive(true);
        }
        void SetWings(bool enabled){
            if(enabled&&!wings&&actor){
                var materials=actor.GetComponentsInChildren<SkinnedMeshRenderer>(true).SelectMany(r=>r.sharedMaterials).Where(m=>m).Distinct().ToArray();
                var armor=materials.FirstOrDefault(m=>m.name=="armor");var trim=materials.FirstOrDefault(m=>m.name=="trim");
                if(!armor||!trim)return;
                var mount=new GameObject("LOCKED EVOLUTION PREVIEW ONLY");mount.layer=StageLayer;mount.transform.SetParent(actor.transform,false);
                mount.transform.position=bounds.center+Vector3.up*bounds.size.y*.24f-actor.transform.forward*bounds.size.y*.13f;
                mount.transform.localScale=Vector3.one*bounds.size.y*.66f;
                wings=mount.AddComponent<ReviewEvolutionWings>();wings.Initialize(armor,trim);
            }
            if(wings)wings.gameObject.SetActive(enabled);
        }
        public static SkillCue ScaleCue(SkillCue cue,float height){
            float size=Mathf.Clamp(cue.Size/4f,.35f,1f)*Mathf.Clamp(height,.1f,20f)*.38f;
            return new SkillCue(cue.Id,cue.Shape,size,cue.Duration,cue.Index);
        }
        public static float FrameSize(Vector3 size,float aspect,bool full){
            if(aspect<=0||size.y<=0||size.x<=0||float.IsNaN(size.y)||float.IsInfinity(size.y))throw new ArgumentException("Invalid preview bounds");
            return full?Mathf.Max(size.y*.61f,Mathf.Max(size.x,size.z)*.72f/aspect):Mathf.Max(size.y*.29f,size.x*.38f/aspect);
        }
        void Frame(){
            if(!visible||!actor||!stageCamera)return;
            float h=Mathf.Max(.1f,bounds.size.y),w=Mathf.Max(bounds.size.x,bounds.size.z);
            focus=bounds.center+(close?Vector3.up*h*.25f:Vector3.zero);
            float extent=map?Mathf.Max(h,w)*.68f:FrameSize(bounds.size,stageCamera.aspect,!close);
            if(wings&&wings.gameObject.activeSelf)extent=Mathf.Max(extent,h*1.12f);
            if(Time.unscaledTime<demoUntil&&!map){extent=Mathf.Max(extent,h*1.55f);focus=bounds.center+Vector3.right*h*.55f;}
            else if(demoWasActive){demoWasActive=false;if(dummy){dummy.SetActive(false);Destroy(dummy);dummy=null;}actor.transform.localPosition=Vector3.zero;actor.transform.localRotation=Quaternion.identity;}
            float t=Mathf.Clamp01((Time.unscaledTime-appearedAt)/.65f);
            float entrance=1-Mathf.SmoothStep(0,1,t);
            float orbit=angle+(map?12*Mathf.Sin(Time.unscaledTime*.16f):8*Mathf.Sin(Time.unscaledTime*.34f))+entrance*22;
            var dir=Quaternion.Euler(0,orbit,0)*(map?new Vector3(.48f,.91f,.70f):new Vector3(.27f,.18f,1));
            stageCamera.orthographicSize=extent*(1+.12f*entrance);
            stageCamera.transform.position=focus+dir.normalized*Mathf.Max(5,extent*2.7f);
            stageCamera.transform.LookAt(focus);
        }
        internal void Rotate(float degrees){angle=Mathf.Repeat(angle+degrees,360);Frame();}
        internal void PlayEntrance(){
            if(!visible||map||!animator)return;
            // Distinct existing canonical animation for each hero's presentation.
            string entrance=ReviewEntranceProfiles.Motion(modelId);
            if(animator.parameters.Any(p=>p.name==entrance&&p.type==AnimatorControllerParameterType.Trigger))animator.SetTrigger(entrance);
            if(effects)effects.Emit(transform.position,BattleEffects.Accent(modelId),ReviewEntranceProfiles.Pulse(modelId));
        }
        internal bool PlaySkill(SkillSlot slot,out string outcome){
            outcome="";if(!visible||map||!animator||!ArenaDraftRules.Known(modelId))return false;
            string trigger=slot.ToString();if(!animator.parameters.Any(p=>p.name==trigger&&p.type==AnimatorControllerParameterType.Trigger))return false;
            var trial=ReviewSkillTrial.Evaluate(modelId,slot);outcome=trial.Summary;
            if(dummy){dummy.SetActive(false);Destroy(dummy);dummy=null;}
            var foe=view.visuals.heroes.FirstOrDefault(h=>h!=null&&h.id==trial.Enemy);
            float hgt=Mathf.Max(.5f,bounds.size.y);
            if(foe!=null&&foe.prefab){
                dummy=new GameObject("Skill lab opponent");dummy.transform.SetParent(transform,false);dummy.SetActive(false);
                dummy.transform.localPosition=Vector3.right*hgt*1.45f;dummy.transform.localRotation=Quaternion.LookRotation(Vector3.left);
                Instantiate(foe.prefab,dummy.transform,false);Isolate(dummy);dummy.SetActive(true);
                var targetAnimator=dummy.GetComponentInChildren<Animator>(true);
                if(targetAnimator&&trial.Damage>0&&targetAnimator.parameters.Any(p=>p.name=="Hit"&&p.type==AnimatorControllerParameterType.Trigger))targetAnimator.SetTrigger("Hit");
            }
            actor.transform.localPosition=Vector3.zero;actor.transform.localRotation=Quaternion.LookRotation(Vector3.right);
            foreach(var p in new[]{"Primary","Secondary","Ultimate","Victory"})if(animator.parameters.Any(x=>x.name==p&&x.type==AnimatorControllerParameterType.Trigger))animator.ResetTrigger(p);
            // A rejected trial must not present a successful cast.
            demoUntil=Time.unscaledTime+2.1f;demoWasActive=true;
            if(!trial.Accepted)return true;
            animator.SetTrigger(trigger);
            if(effects&&SkillCueCatalog.TryGet(HeroKitCatalog.Get(modelId).Skill(slot).Id,out var cue)){
                var scaled=ScaleCue(cue,hgt);
                effects.Clear();effects.EmitSkill(transform.position,BattleEffects.Accent(modelId),scaled,Vector3.right);
                var audio=view.GetComponent<SkillAudio>();if(audio&&view.battleCamera)audio.Play(cue,view.battleCamera.transform.position,true,true);
            }
            return true;
        }
        internal void Hide(){
            visible=false;if(stageCamera)stageCamera.enabled=false;if(actor)actor.SetActive(false);if(dummy){dummy.SetActive(false);Destroy(dummy);dummy=null;}if(platform)platform.SetActive(false);if(view){var audio=view.GetComponent<SkillAudio>();if(audio)audio.ClearPreview();}
            if(key)key.enabled=false;if(rim)rim.enabled=false;if(effects)effects.Clear();
        }
        void LateUpdate(){if(visible&&focused&&!appPaused){if(wings&&wings.gameObject.activeSelf)wings.Animate(Time.unscaledDeltaTime);Frame();}}
        void RefreshFocus(){bool active=focused&&!appPaused&&visible;if(stageCamera)stageCamera.enabled=active;if(animator)animator.speed=active?1:0;if(!active){if(effects)effects.Clear();if(view){var audio=view.GetComponent<SkillAudio>();if(audio)audio.ClearPreview();}}}
        void OnApplicationPause(bool value){appPaused=value;RefreshFocus();}
        void OnApplicationFocus(bool value){focused=value;RefreshFocus();}
        void OnDisable(){Hide();}
        void OnDestroy(){if(stageCamera){stageCamera.enabled=false;stageCamera.targetTexture=null;}if(target){target.Release();Destroy(target);}if(platformMat)Destroy(platformMat);if(trimMat)Destroy(trimMat);if(maskOwned&&view&&view.battleCamera){int mask=view.battleCamera.cullingMask;view.battleCamera.cullingMask=(mask&~(1<<StageLayer))|(oldMask&(1<<StageLayer));}}
    }
}
