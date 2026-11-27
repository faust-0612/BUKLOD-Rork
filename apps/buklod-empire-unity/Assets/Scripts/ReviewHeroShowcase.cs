using System;
using System.Linq;
using UnityEngine;
namespace Buklod.Empire {
    // A single off-field camera, RT and current model. Never instantiates a BattleUnit.
    // The stage is isolated from battlefield input, AI, collisions and scene camera.
    internal sealed class ReviewHeroShowcase:MonoBehaviour {
        const int StageLayer=31;
        BattleView view;Camera stageCamera;RenderTexture target;GameObject actor;
        BattleEffects effects;Light key,rim;Animator animator;string modelId;Bounds bounds;
        float angle,appearedAt;bool map,close,visible;float demoUntil;
        Vector3 focus;
        internal Texture Texture=>target;
        internal void Initialize(BattleView owner){
            if(!owner||!owner.IsEditorReview)throw new InvalidOperationException("Review showcase only.");
            view=owner;transform.position=new Vector3(-2000,0,-2000);
            gameObject.layer=StageLayer;
            var go=new GameObject("Isolated preview camera");go.transform.SetParent(transform,false);
            stageCamera=go.AddComponent<Camera>();stageCamera.enabled=false;stageCamera.cullingMask=1<<StageLayer;
            stageCamera.clearFlags=CameraClearFlags.SolidColor;stageCamera.backgroundColor=new Color(.025f,.045f,.075f);
            stageCamera.nearClipPlane=.03f;stageCamera.farClipPlane=400;stageCamera.orthographic=true;
            target=new RenderTexture(768,768,24,RenderTextureFormat.ARGB32){name="Empire live model preview",antiAliasing=1};
            if(!target.Create())throw new InvalidOperationException("Preview render target unavailable.");
            stageCamera.targetTexture=target;stageCamera.aspect=1;
            key=MakeLight("Showcase warm key",new Color(1,.88f,.72f),1.35f,new Vector3(34,145,0));
            rim=MakeLight("Showcase blue rim",new Color(.42f,.70f,1),.95f,new Vector3(30,-35,0));
            var source=owner.GetComponent<BattleEffects>();
            if(source&&source.pulseMaterial){
                effects=gameObject.AddComponent<BattleEffects>();effects.pulseMaterial=source.pulseMaterial;
                effects.skillParticleMaterial=source.skillParticleMaterial;effects.previewCamera=stageCamera;
            }
            Hide();
        }
        Light MakeLight(string id,Color color,float intensity,Vector3 rotation){
            var go=new GameObject(id);go.transform.SetParent(transform,false);var l=go.AddComponent<Light>();
            l.type=LightType.Directional;l.color=color;l.intensity=intensity;l.cullingMask=1<<StageLayer;
            l.transform.rotation=Quaternion.Euler(rotation);return l;
        }
        internal bool ShowHero(string id,bool face){
            if(!view||!view.visuals||view.visuals.heroes==null)return false;
            var row=view.visuals.heroes.FirstOrDefault(h=>h!=null&&h.id==id);
            return row!=null&&Show(row.prefab,id,false,face);
        }
        internal bool ShowMap()=>view&&view.visuals&&Show(view.visuals.genesisRift,"map",true,false);
        bool Show(GameObject prefab,string id,bool isMap,bool face){
            if(!prefab||!stageCamera||!target)return false;
            bool changed=!actor||modelId!=id;
            if(changed){
                if(effects)effects.Clear();
                if(actor){actor.SetActive(false);Destroy(actor);}
                // Inactive parent prevents prefab gameplay scripts from running before isolation.
                var holder=new GameObject("Visual-only "+id);holder.transform.SetParent(transform,false);holder.SetActive(false);
                actor=holder;
                var clone=Instantiate(prefab,holder.transform,false);
                foreach(var t in holder.GetComponentsInChildren<Transform>(true))t.gameObject.layer=StageLayer;
                foreach(var c in holder.GetComponentsInChildren<Collider>(true))c.enabled=false;
                foreach(var c in holder.GetComponentsInChildren<Collider2D>(true))c.enabled=false;
                foreach(var c in holder.GetComponentsInChildren<MonoBehaviour>(true))c.enabled=false;
                foreach(var c in holder.GetComponentsInChildren<AudioSource>(true))c.enabled=false;
                foreach(var c in holder.GetComponentsInChildren<Camera>(true))c.enabled=false;
                foreach(var c in holder.GetComponentsInChildren<Light>(true))c.enabled=false;
                foreach(var c in holder.GetComponentsInChildren<UnityEngine.AI.NavMeshAgent>(true))c.enabled=false;
                foreach(var c in holder.GetComponentsInChildren<Rigidbody>(true)){c.isKinematic=true;c.detectCollisions=false;}
                foreach(var lod in holder.GetComponentsInChildren<LODGroup>(true))lod.ForceLOD(0);
                animator=holder.GetComponentInChildren<Animator>(true);
                if(animator){animator.applyRootMotion=false;animator.updateMode=AnimatorUpdateMode.UnscaledTime;animator.cullingMode=AnimatorCullingMode.AlwaysAnimate;}
                holder.SetActive(true);
                var rs=holder.GetComponentsInChildren<Renderer>(true).Where(r=>r.enabled&&r.gameObject.activeInHierarchy).ToArray();
                if(rs.Length==0){holder.SetActive(false);Destroy(holder);actor=null;return false;}
                bounds=rs[0].bounds;foreach(var r in rs.Skip(1))bounds.Encapsulate(r.bounds);
                if(bounds.size.sqrMagnitude<.01f){holder.SetActive(false);Destroy(holder);actor=null;return false;}
                // Recenter geometry on an invariant pivot, retaining the imported rig.
                clone.transform.position+=transform.position-bounds.center+Vector3.up*bounds.extents.y;
                bounds.center=transform.position+Vector3.up*bounds.extents.y;
                modelId=id;angle=0;appearedAt=Time.unscaledTime;demoUntil=0;
                if(animator){animator.Rebind();animator.SetFloat("Speed",0);animator.Update(0);}
            }
            map=isMap;close=face;visible=true;actor.SetActive(true);key.enabled=rim.enabled=true;stageCamera.enabled=true;
            Frame();return true;
        }
        void Frame(){
            if(!visible||!actor||!stageCamera)return;
            float h=Mathf.Max(.1f,bounds.size.y),w=Mathf.Max(bounds.size.x,bounds.size.z);
            focus=bounds.center+(close?Vector3.up*h*.25f:Vector3.zero);
            float extent=map?Mathf.Max(h,w)*.68f:close?h*.29f:Mathf.Max(h,w)*.64f;
            if(Time.unscaledTime<demoUntil&&!map){extent=Mathf.Max(extent,h*1.15f);focus=bounds.center;}
            float t=Mathf.Clamp01((Time.unscaledTime-appearedAt)/.65f);
            float entrance=1-Mathf.SmoothStep(0,1,t);
            float orbit=angle+(map?12*Mathf.Sin(Time.unscaledTime*.16f):8*Mathf.Sin(Time.unscaledTime*.34f))+entrance*22;
            var dir=Quaternion.Euler(0,orbit,0)*(map?new Vector3(.48f,.91f,.70f):new Vector3(.27f,.18f,1));
            stageCamera.orthographicSize=extent*(1+.12f*entrance);
            stageCamera.transform.position=focus+dir.normalized*Mathf.Max(5,extent*2.7f);
            stageCamera.transform.LookAt(focus);
        }
        internal void Rotate(float degrees){angle=Mathf.Repeat(angle+degrees,360);Frame();}
        internal bool PlaySkill(SkillSlot slot){
            if(!visible||map||!animator||!ArenaDraftRules.Known(modelId))return false;
            string trigger=slot.ToString();if(!animator.parameters.Any(p=>p.name==trigger&&p.type==AnimatorControllerParameterType.Trigger))return false;
            foreach(var p in new[]{"Primary","Secondary","Ultimate"})animator.ResetTrigger(p);
            animator.SetTrigger(trigger);demoUntil=Time.unscaledTime+1.6f;
            if(effects&&SkillCueCatalog.TryGet(HeroKitCatalog.Get(modelId).Skill(slot).Id,out var cue)){
                var scaled=new SkillCue(cue.Id,cue.Shape,Mathf.Min(cue.Size,bounds.size.y*1.5f),cue.Duration,cue.Index);
                effects.Clear();effects.EmitSkill(transform.position,BattleEffects.Accent(modelId),scaled,Vector3.forward);
            }
            return true;
        }
        internal void Hide(){
            visible=false;if(stageCamera)stageCamera.enabled=false;if(actor)actor.SetActive(false);
            if(key)key.enabled=false;if(rim)rim.enabled=false;if(effects)effects.Clear();
        }
        void LateUpdate(){if(visible)Frame();}
        void OnApplicationPause(bool value){if(value&&stageCamera)stageCamera.enabled=false;else if(visible&&stageCamera)stageCamera.enabled=true;}
        void OnApplicationFocus(bool value){if(stageCamera)stageCamera.enabled=value&&visible;}
        void OnDestroy(){if(stageCamera)stageCamera.targetTexture=null;if(target){target.Release();Destroy(target);}}
    }
}
