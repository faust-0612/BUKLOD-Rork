using System;
using System.Linq;
using UnityEngine;
using UnityEngine.Rendering.Universal;
namespace Buklod.Empire {
    // A single isolated preview actor, not a simulation unit. Review package only.
    public sealed class ReviewLiveHeroPreview:MonoBehaviour {
        const int Layer=31, Width=512, Height=640;
        BattleView view;GameObject stage,actor;Camera camera;RenderTexture target;
        Animator animator;ReviewClipPlayback fallback;ReviewEvolutionWings wings;ReviewEquipmentVisual previewEquipment;Vector3 fullWingScale;string hero;Bounds bounds;int oldMask;bool maskOwned,focused=true,appPaused;
        bool fullBody=true;
        float portraitElapsed,portraitSize;
        float angle,castAt=-1,castEnd;SkillCue pendingCue;bool pendingEffect;BattleEffects previewEffects;SkillAudio previewAudio;
        public static SkillCue ScaleCue(SkillCue cue,float height){
            float size=Mathf.Clamp(cue.Size/4f,.35f,1f)*Mathf.Clamp(height,.1f,20f)*.38f;
            return new SkillCue(cue.Id,cue.Shape,size,cue.Duration,cue.Index);
        }
        public static float FrameSize(Vector3 size,float aspect,bool full){
            if(aspect<=0||size.y<=0||size.x<=0||float.IsNaN(size.y)||float.IsInfinity(size.y))throw new ArgumentException("Invalid preview bounds");
            return full?Mathf.Max(size.y*.61f,Mathf.Max(size.x,size.z)*.72f/aspect):Mathf.Max(size.y*.29f,size.x*.38f/aspect);
        }
        static void SetLayer(Transform node){node.gameObject.layer=Layer;foreach(Transform child in node)SetLayer(child);}
        static void SetLayerForDisposal(Transform node){node.gameObject.layer=0;foreach(Transform child in node)SetLayerForDisposal(child);}
        void CreateStage(){
            if(stage)return;
            if(!view||!view.IsEditorReview||!view.battleCamera)throw new InvalidOperationException("Review preview only.");
            if(UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsInactive.Include,FindObjectsSortMode.None).Any(r=>r.gameObject.layer==Layer))
                throw new InvalidOperationException("Preview layer already occupied.");
            stage=new GameObject("Isolated hero showcase");stage.transform.position=new Vector3(0,-500,0);
            oldMask=view.battleCamera.cullingMask;view.battleCamera.cullingMask=oldMask&~(1<<Layer);maskOwned=true;
            target=new RenderTexture(Width,Height,24,RenderTextureFormat.ARGB32){name="Hero showcase target"};
            if(!target.Create())throw new InvalidOperationException("Preview texture unavailable.");
            var go=new GameObject("Showcase camera");go.transform.SetParent(stage.transform,false);camera=go.AddComponent<Camera>();
            camera.enabled=false;camera.targetTexture=target;camera.cullingMask=1<<Layer;camera.clearFlags=CameraClearFlags.SolidColor;
            camera.backgroundColor=new Color(.025f,.041f,.065f);camera.orthographic=true;camera.aspect=(float)Width/Height;
            camera.nearClipPlane=.02f;camera.farClipPlane=40;camera.allowHDR=false;
            var data=camera.GetUniversalAdditionalCameraData();data.renderPostProcessing=false;data.renderShadows=false;
            MakeLight("Showcase key",new Vector3(1.4f,2.8f,2.7f),new Color(1,.92f,.83f),1.8f);
            MakeLight("Showcase fill",new Vector3(-1.8f,1.9f,2.1f),new Color(.63f,.79f,1),.85f);
            MakeLight("Showcase rim",new Vector3(.3f,2.5f,-2f),new Color(.48f,.74f,1),1.4f);
            var source=view.GetComponent<BattleEffects>();
            if(source&&source.pulseMaterial){var fx=new GameObject("Showcase skill effects");fx.transform.SetParent(stage.transform,false);fx.layer=Layer;
                previewEffects=fx.AddComponent<BattleEffects>();previewEffects.pulseMaterial=source.pulseMaterial;previewEffects.skillParticleMaterial=source.skillParticleMaterial;previewEffects.ConfigurePreview(camera);}
            previewAudio=view.GetComponent<SkillAudio>();if(!previewAudio)previewAudio=view.gameObject.AddComponent<SkillAudio>();
        }
        void MakeLight(string label,Vector3 at,Color color,float intensity){
            var go=new GameObject(label);go.transform.SetParent(stage.transform,false);go.transform.localPosition=at;go.layer=Layer;
            var l=go.AddComponent<Light>();l.type=LightType.Point;l.color=color;l.intensity=intensity;l.range=9;l.cullingMask=1<<Layer;l.shadows=LightShadows.None;
        }
        public Texture Show(BattleView owner,string id,bool full,int previewLevel=1){
            if(!owner||!owner.IsEditorReview||!owner.visuals)return null;view=owner;
            try{
                int previewStage=ArenaProgression.PreviewStage(previewLevel);
                CreateStage();
                if(!actor||hero!=id){
                    ClearCast();fallback?.Dispose();fallback=null;wings=null;previewEquipment=null;if(actor){actor.SetActive(false);SetLayerForDisposal(actor.transform);Destroy(actor);}
                    var entry=view.visuals.heroes.Single(h=>h.id==id);
                    actor=Instantiate(entry.prefab,stage.transform);actor.transform.localPosition=Vector3.zero;actor.transform.localRotation=Quaternion.identity;
                    SetLayer(actor.transform);
                    foreach(var c in actor.GetComponentsInChildren<Collider>(true))c.enabled=false;
                    previewEquipment=actor.GetComponent<ReviewEquipmentVisual>();if(previewEquipment)previewEquipment.ResetVisual();
                    foreach(var b in actor.GetComponentsInChildren<MonoBehaviour>(true))b.enabled=false;
                    foreach(var lod in actor.GetComponentsInChildren<LODGroup>(true))lod.ForceLOD(0);
                    animator=actor.GetComponentInChildren<Animator>(true);
                    if(!animator||!animator.runtimeAnimatorController)throw new InvalidOperationException("Preview rig missing.");
                    animator.applyRootMotion=false;animator.cullingMode=AnimatorCullingMode.AlwaysAnimate;animator.updateMode=AnimatorUpdateMode.UnscaledTime;
                    animator.enabled=true;animator.Rebind();animator.Update(0f);
                    if(!BattleVisualCatalog.HasHeroParameters(animator.parameters))fallback=ReviewClipPlayback.TryCreate(animator,id);
                    var skins=actor.GetComponentsInChildren<SkinnedMeshRenderer>(true).Where(r=>r.name!="Mobile LOD1").ToArray();
                    if(skins.Length==0)throw new InvalidOperationException("Preview mesh missing.");
                    bounds=skins[0].bounds;foreach(var skin in skins.Skip(1))bounds.Encapsulate(skin.bounds);
                    hero=id;angle=0;portraitElapsed=0;
                }
                // These are provisional looks on the isolated clone only.
                ApplyPreviewLook(previewStage);
                bool showWings=previewStage>=3&&full;
                if(showWings&&!wings){
                    var materials=actor.GetComponentsInChildren<SkinnedMeshRenderer>(true).SelectMany(r=>r.sharedMaterials).Where(m=>m).Distinct().ToArray();
                    var armor=materials.FirstOrDefault(m=>m.name=="armor");var trim=materials.FirstOrDefault(m=>m.name=="trim");
                    if(!armor||!trim){Debug.LogWarning("Optional evolution wings unavailable; base live preview retained.");showWings=false;}
                    else{
                    var mount=new GameObject("LOCKED EVOLUTION PREVIEW ONLY");mount.layer=Layer;mount.transform.SetParent(actor.transform,false);
                    // Anchor in the unrotated actor frame; retain position while the preview turns.
                    var priorRotation=actor.transform.localRotation;actor.transform.localRotation=Quaternion.identity;
                    mount.transform.position=bounds.center+Vector3.up*bounds.size.y*.24f-actor.transform.forward*bounds.size.y*.13f;
                    actor.transform.localRotation=priorRotation;
                    var scale=actor.transform.lossyScale;float size=bounds.size.y*.66f;
                    mount.transform.localScale=new Vector3(size/Mathf.Max(.001f,Mathf.Abs(scale.x)),size/Mathf.Max(.001f,Mathf.Abs(scale.y)),size/Mathf.Max(.001f,Mathf.Abs(scale.z)));
                    fullWingScale=mount.transform.localScale;
                    try{wings=mount.AddComponent<ReviewEvolutionWings>();wings.Initialize(armor,trim);}
                    catch(Exception error){Debug.LogWarning("Optional evolution wings unavailable: "+error.Message);mount.SetActive(false);Destroy(mount);wings=null;showWings=false;}
                    }
                }
                if(wings){wings.transform.localScale=fullWingScale*(previewStage==3?.70f:1f);wings.gameObject.SetActive(showWings);}
                float aspect=(float)Width/Height;camera.orthographicSize=FrameSize(bounds.size,aspect,full);
                if(showWings)camera.orthographicSize=Mathf.Max(camera.orthographicSize,bounds.size.y*(previewStage==3?.85f:1.12f)/aspect);
                if(fullBody!=full)portraitElapsed=0;
                fullBody=full;
                portraitSize=camera.orthographicSize;
                FrameCamera();
                camera.enabled=focused&&!appPaused;animator.speed=camera.enabled?1:0;
                return target;
            }catch(Exception error){Debug.LogWarning("Live hero preview unavailable; using captured model portrait: "+error.Message);Hide();return null;}
        }
        void FrameCamera(){
            var motion=ReviewPortraitMotion.Get(hero);
            float phase=Mathf.SmoothStep(0,1,portraitElapsed/motion.Duration);
            float orbit=fullBody?0:Mathf.Lerp(motion.Orbit,0,phase);
            float lift=fullBody?0:.26f+motion.Height*(1-phase);
            var focus=bounds.center+Vector3.up*(bounds.size.y*lift);
            var direction=Quaternion.Euler(0,orbit,0)*new Vector3(.12f,.035f,1f).normalized;
            camera.orthographicSize=portraitSize*(fullBody?1:Mathf.Lerp(1+motion.Zoom,1,phase));
            camera.transform.position=focus+direction*Mathf.Max(3,bounds.size.magnitude*2);
            camera.transform.LookAt(focus);
        }
        public void PlayEntrance(){
            if(!actor||!animator||!camera||!camera.enabled)return;
            string action=ReviewEntranceProfiles.Motion(hero);
            ClearCast();
            if(fallback!=null){if(!fallback.Trigger(action))return;}
            else{
                if(!animator.parameters.Any(p=>p.type==AnimatorControllerParameterType.Trigger&&p.name==action))return;
                animator.SetTrigger(action);
            }
            var clip=animator.runtimeAnimatorController.animationClips.FirstOrDefault(c=>c.name==action);
            castEnd=Time.unscaledTime+(clip?clip.length:.65f);
        }
        public bool SetPalette(ReviewPalette palette){
            if(!actor||!Enum.IsDefined(typeof(ReviewPalette),palette))return false;
            return ReviewHeroPalette.Apply(actor,palette)>0;
        }
        void ApplyPreviewLook(int level){
            if(!previewEquipment||previewEquipment.mounts==null)return;
            foreach(var mount in previewEquipment.mounts){
                if(mount==null)continue;
                bool on=level>=2||level==1&&(mount.slot=="armor"||mount.slot=="weapon");
                if(mount.basePlate){mount.basePlate.SetActive(on);mount.basePlate.transform.localScale=Vector3.one*(1+.04f*Mathf.Max(0,level-1));}
                if(mount.advancedTrim)mount.advancedTrim.SetActive(on&&level>=3);
            }
        }
        public bool PlaySkill(SkillSlot slot){
            if(!actor||!animator||!camera||!camera.enabled)return false;
            string name=slot.ToString();
            if(!SkillCueCatalog.TryGet(HeroKitCatalog.Get(hero).Skill(slot).Id,out var cue))return false;
            if(fallback==null){
                var triggers=animator.parameters.Where(p=>p.type==AnimatorControllerParameterType.Trigger).Select(p=>p.name).ToArray();
                if(!triggers.Contains(name))return false;
                foreach(var trigger in new[]{"Attack","Primary","Secondary","Ultimate","Hit"})if(triggers.Contains(trigger))animator.ResetTrigger(trigger);
            }
            ClearCast();
            if(fallback!=null){if(!fallback.Trigger(name))return false;}else animator.SetTrigger(name);
            pendingCue=ScaleCue(cue,bounds.size.y);pendingEffect=true;castAt=Time.unscaledTime+.12f;
            var clip=animator.runtimeAnimatorController.animationClips.FirstOrDefault(c=>c.name==name);
            castEnd=Time.unscaledTime+Mathf.Max(.65f,clip?clip.length:cue.Duration);
            return true;
        }
        void ClearCast(){pendingEffect=false;castAt=-1;castEnd=0;if(previewEffects)previewEffects.Clear();if(previewAudio)previewAudio.ClearPreview();}
        void Update(){
            if(!actor||!camera||!camera.enabled)return;
            fallback?.Tick(Time.unscaledDeltaTime);
            if(!fullBody&&portraitElapsed<1){
                portraitElapsed+=Mathf.Min(.05f,Time.unscaledDeltaTime);
                FrameCamera();
            }
            if(pendingEffect&&Time.unscaledTime>=castAt){
                pendingEffect=false;
                if(previewEffects)previewEffects.EmitSkill(bounds.center-Vector3.up*bounds.size.y*.16f,BattleEffects.Accent(hero),pendingCue,actor.transform.forward);
                if(previewAudio)previewAudio.Play(pendingCue,actor.transform.position,true,true);
            }
            if(wings&&wings.gameObject.activeSelf)wings.Animate(Time.unscaledDeltaTime);
            if(Time.unscaledTime<castEnd)return;
            angle+=Time.unscaledDeltaTime*.38f;actor.transform.localRotation=Quaternion.Euler(0,Mathf.Sin(angle)*18f,0);
        }
        void RefreshFocus(){if(!focused||appPaused)ClearCast();if(camera)camera.enabled=focused&&!appPaused;if(animator)animator.speed=focused&&!appPaused?1:0;}
        void OnApplicationFocus(bool value){focused=value;RefreshFocus();}
        void OnApplicationPause(bool value){appPaused=value;RefreshFocus();}
        public void Hide(){
            ClearCast();fallback?.Dispose();fallback=null;previewEffects=null;previewAudio=null;
            if(camera){camera.enabled=false;camera.targetTexture=null;}
            if(stage){stage.SetActive(false);SetLayerForDisposal(stage.transform);Destroy(stage);}
            if(target){target.Release();Destroy(target);}
            if(maskOwned&&view&&view.battleCamera)view.battleCamera.cullingMask=oldMask;
            maskOwned=false;stage=null;actor=null;camera=null;target=null;animator=null;wings=null;previewEquipment=null;hero=null;
        }
        void OnDisable(){Hide();}
    }
}
