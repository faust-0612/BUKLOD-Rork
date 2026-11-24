using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;
using UnityEngine.Rendering;
namespace Buklod.Empire {
    public sealed class BattleView:MonoBehaviour {
        public BattleVisualCatalog visuals;
        public Camera battleCamera;
        public string selectedHero="phan";
        public float worldScale=1, cameraHeight=23;
        [Tooltip("Preserve full-detail hero geometry and visible hero shadows. Disable only for an explicit lower-quality mode.")]
        public bool premiumVisuals=true;
        public OfflineBattle Battle {get;private set;}
        public bool Paused {get;private set;}
        public void SetPaused(bool value){Paused=value;if(input)input.enabled=!value;}
#if UNITY_EDITOR
        [SerializeField, HideInInspector] private bool editorReviewOnly;
        public void ConfigureEditorReview(){if(Application.isPlaying)throw new System.InvalidOperationException("Configure review before play.");editorReviewOnly=true;}
#endif
        private MobileBattleInput input;
        private BattleEffects effects;
        private WorldInteractionEffects worldEffects;
        private SkillAudio skillAudio;
        private readonly Dictionary<int,Visual> active=new Dictionary<int,Visual>();
        private readonly Dictionary<GameObject,Stack<GameObject>> pool=new Dictionary<GameObject,Stack<GameObject>>();
        private readonly HashSet<int> seen=new HashSet<int>();
        private readonly List<int> removed=new List<int>();
        private readonly Plane[] frustum=new Plane[6];
        private int pooledCount;
        public int ActiveVisualCount=>active.Count;
        public int PooledVisualCount=>pooledCount;
        private sealed class Visual {public BattleUnit unit;public GameObject instance,prefab;public Animator animator;public float attack=float.NegativeInfinity,health;public int castSequence,villageActions;public LODGroup[] lodGroups;public int forcedLod=int.MinValue;public Renderer[] renderers;public ShadowCastingMode[] originalShadows;public bool shadowsOn=true;public Vector2 sampledAt;public float groundY;public readonly HashSet<string> parameters=new HashSet<string>();}
        private sealed class Navigation:IBattleNavigation {
            private readonly float scale;
            public Navigation(float scale){this.scale=scale;}
            private Vector3 World(Vector2 p)=>new Vector3(p.x*scale,0,p.y*scale);
            private bool Sample(Vector2 p,out NavMeshHit h)=>NavMesh.SamplePosition(World(p),out h,Mathf.Max(2,scale*2),NavMesh.AllAreas);
            public bool CanTraverse(Vector2 from,Vector2 to){
                if(!Sample(from,out var a)||!Sample(to,out var b)||Vector2.Distance(new Vector2(b.position.x,b.position.z)/scale,to)>.25f)return false;
                return !NavMesh.Raycast(a.position,b.position,out _,NavMesh.AllAreas);
            }
            public bool TryWaypoint(Vector2 from,Vector2 goal,out Vector2 waypoint){
                waypoint=from;if(!Sample(from,out var a)||!Sample(goal,out var b))return false;
                var path=new NavMeshPath();if(!NavMesh.CalculatePath(a.position,b.position,NavMesh.AllAreas,path)||path.corners.Length<2)return false;
                var c=path.corners[1];waypoint=new Vector2(c.x,c.z)/scale;return true;
            }
        }
        public void StartMatch(string hero)=>StartConfiguredMatch(hero,ArenaDifficulty.Normal,null,ArenaTactic.Renew);
        public void StartConfiguredMatch(string hero,ArenaDifficulty difficulty,CovenantLoadout? covenant,ArenaTactic tactic){
            if(!visuals||!battleCamera||worldScale<=0)throw new System.InvalidOperationException("Battle scene is incomplete.");
#if UNITY_EDITOR
            if(editorReviewOnly)visuals.ValidateEditorReview();else
#endif
            visuals.Validate();
            foreach(var v in active.Values)Return(v);active.Clear();
            effects=GetComponent<BattleEffects>();if(effects)effects.Clear();
            worldEffects=GetComponent<WorldInteractionEffects>();if(worldEffects)worldEffects.Clear();
            skillAudio=GetComponent<SkillAudio>();if(!skillAudio)skillAudio=gameObject.AddComponent<SkillAudio>();skillAudio.Clear();
            Battle=new OfflineBattle(hero,new Navigation(worldScale),difficulty:difficulty);
            if(covenant.HasValue&&!Battle.SelectPlayerCovenant(covenant.Value))throw new System.InvalidOperationException("Invalid Covenant loadout.");
            if(!Battle.SelectPlayerTactic(tactic))throw new System.InvalidOperationException("Invalid tactic.");
            selectedHero=hero;Paused=false;
            input=GetComponent<MobileBattleInput>();if(!input)input=gameObject.AddComponent<MobileBattleInput>();input.Bind(this);input.enabled=true;
            if(!GetComponent<BattleHud>())gameObject.AddComponent<BattleHud>();
            Follow(true);Sync(true);
        }
        private void Start(){
            if(Battle==null)StartMatch(selectedHero);
            if(!GetComponent<OfflineSessionMenu>())gameObject.AddComponent<OfflineSessionMenu>();
        }
        private void OnApplicationPause(bool paused){if(paused&&Battle!=null&&!Battle.Finished)SetPaused(true);}
        private void OnApplicationFocus(bool focused){if(!focused&&Battle!=null&&!Battle.Finished)SetPaused(true);}
        private Vector2 ToWorld(Vector2 screen){
            Vector3 right=battleCamera.transform.right,forward=battleCamera.transform.forward;
            var r=new Vector2(right.x,right.z).normalized;var f=new Vector2(forward.x,forward.z).normalized;
            return Vector2.ClampMagnitude(r*screen.x+f*screen.y,1);
        }
        public bool Cast(int button,Vector2 aim){
            if(Battle==null||Paused||Battle.Finished||button<1||button>4)return false;
            var direction=ToWorld(aim);
            return button==1?Battle.PlayerAttack(direction):Battle.CastPlayer((SkillSlot)(button-2),direction);
        }
        private void Update(){if(Battle==null||Paused)return;Battle.Advance(Time.deltaTime,ToWorld(input.Joystick));Sync(false);}
        private void LateUpdate(){if(Battle!=null)Follow(false);}
        private Vector3 Ground(Vector2 p){var at=new Vector3(p.x*worldScale,0,p.y*worldScale);return NavMesh.SamplePosition(at,out var hit,Mathf.Max(2,worldScale*2),NavMesh.AllAreas)?hit.position:at;}
        private Visual Rent(GameObject prefab){
            if(!pool.TryGetValue(prefab,out var stack)){stack=new Stack<GameObject>();pool[prefab]=stack;}
            GameObject go;
            if(stack.Count>0){go=stack.Pop();pooledCount--;}
            else go=Instantiate(prefab,transform);
            go.SetActive(true);
            var v=new Visual{instance=go,prefab=prefab,animator=go.GetComponentInChildren<Animator>(true)};
            v.lodGroups=go.GetComponentsInChildren<LODGroup>(true);
            v.renderers=go.GetComponentsInChildren<Renderer>(true);v.originalShadows=new ShadowCastingMode[v.renderers.Length];
            for(int i=0;i<v.renderers.Length;i++){
                var r=v.renderers[i];v.originalShadows[i]=r.shadowCastingMode;
                if(r is SkinnedMeshRenderer skin)skin.updateWhenOffscreen=false;
            }
            if(v.animator){v.animator.cullingMode=AnimatorCullingMode.CullUpdateTransforms;v.animator.Rebind();foreach(var p in v.animator.parameters)v.parameters.Add(p.name);}
            return v;
        }
        private void SetShadows(Visual v,bool enabled){
            if(v.shadowsOn==enabled)return;
            v.shadowsOn=enabled;
            for(int i=0;i<v.renderers.Length;i++)if(v.renderers[i])
                v.renderers[i].shadowCastingMode=enabled?v.originalShadows[i]:ShadowCastingMode.Off;
        }
        private void Return(Visual v){
            v.instance.SetActive(false);
            SetShadows(v,true); // preserve original prefab shadow modes across rentals
            var stack=pool[v.prefab];
            if(BattleRenderBudget.CanPool(pooledCount,stack.Count)){stack.Push(v.instance);pooledCount++;}
            else Destroy(v.instance);
        }
        private bool IsInView(BattleUnit u){
            // Conservative world-space envelope, including tall structures and pose margins.
            // Keep nearby actors even outside the camera (audio and camera movement).
            float radius=Mathf.Max(1,worldScale)*8;
            var center=new Vector3(u.Position.x*worldScale,3*worldScale,u.Position.y*worldScale);
            return GeometryUtility.TestPlanesAABB(frustum,new Bounds(center,Vector3.one*(2*radius)));
        }
        private void Sync(bool immediate){
            seen.Clear();
            GeometryUtility.CalculateFrustumPlanes(battleCamera,frustum);
            var playerPosition=Battle.Player.Position;
            foreach(var u in Battle.Units){
                if(!u.State.Alive||!Battle.IsVisibleTo(Battle.Player.Team,u))continue;
                bool player=u==Battle.Player,existing=active.TryGetValue(u.Id,out var v);
                float distanceSquared=(u.Position-playerPosition).sqrMagnitude;
                bool inView=IsInView(u);
                if(!BattleRenderBudget.RetainVisual(player,inView,existing,distanceSquared))continue;
                seen.Add(u.Id);
                if(!existing){
                    v=Rent(visuals.Resolve(u));v.unit=u;active.Add(u.Id,v);
                    var ground=Ground(u.Position);v.instance.transform.position=ground;
                    v.sampledAt=u.Position;v.groundY=ground.y;v.attack=u.LastAttack;v.castSequence=u.State.CastSequence;v.health=u.State.Health;v.villageActions=u.Villager?.Actions??0;
                }
                bool hero=u.Kind==BattleTargetKind.Hero;
                int requestedLod=premiumVisuals?0:-1;
                if(hero&&v.lodGroups!=null&&v.forcedLod!=requestedLod){
                    foreach(var lod in v.lodGroups)if(lod)lod.ForceLOD(requestedLod);
                    v.forcedLod=requestedLod;
                }
                SetShadows(v,(premiumVisuals&&hero&&inView)||BattleRenderBudget.KeepShadow(player,v.shadowsOn,distanceSquared));
                var t=v.instance.transform;
                if((v.sampledAt-u.Position).sqrMagnitude>=.15f*.15f){
                    v.sampledAt=u.Position;v.groundY=Ground(u.Position).y;
                }
                var goal=new Vector3(u.Position.x*worldScale,v.groundY,u.Position.y*worldScale);
                var delta=goal-t.position;var flat=new Vector3(delta.x,0,delta.z);
                if(immediate)t.position=goal;else t.position=Vector3.Lerp(t.position,goal,1-Mathf.Exp(-18*Time.deltaTime));
                if(flat.sqrMagnitude>.0001f)t.rotation=Quaternion.Slerp(t.rotation,Quaternion.LookRotation(flat),1-Mathf.Exp(-15*Time.deltaTime));
                if(v.animator&&v.parameters.Contains("Speed"))v.animator.SetFloat("Speed",immediate?0:flat.magnitude*(1-Mathf.Exp(-18*Time.deltaTime))/Mathf.Max(.0001f,Time.deltaTime));
                if(u.LastAttack>v.attack){v.attack=u.LastAttack;if(v.animator&&v.parameters.Contains("Attack"))v.animator.SetTrigger("Attack");if(effects&&u.Kind==BattleTargetKind.Hero)effects.Emit(t.position,BattleEffects.Accent(u.State.Kit.Id),0);}
                bool castThisFrame=false;
                int latest=u.State.CastSequence;
                if(latest>v.castSequence){
                    int first=Mathf.Max(v.castSequence+1,latest-SkillActor.CastHistoryCapacity+1);
                    for(int seq=first;seq<=latest;seq++){
                        if(!u.State.TryGetCast(seq,out var cast)||u.State.Kit==null||!SkillCueCatalog.TryGet(u.State.Kit.Skill(cast.Slot).Id,out var cue))continue;
                        var aim=cast.Aim;var forward=aim.sqrMagnitude>.0025f?new Vector3(aim.x,0,aim.y):t.forward;
                        if(effects)effects.EmitSkill(t.position,BattleEffects.Accent(u.State.Kit.Id),cue,forward);
                        if(skillAudio&&(u==Battle.Player||Vector2.Distance(u.Position,Battle.Player.Position)<=26))skillAudio.Play(cue,t.position,u==Battle.Player);
                        castThisFrame=true;
                    }
                    v.castSequence=latest;
                    // One skeleton cannot play multiple full-body skills concurrently. Present every
                    // retained cast cue, and prioritize the newest successful cast for the pose.
                    if(castThisFrame&&v.animator&&u.State.TryGetCast(latest,out var last)){
                        foreach(var trigger in new[]{"Primary","Secondary","Ultimate","Attack","Hit"})if(v.parameters.Contains(trigger))v.animator.ResetTrigger(trigger);
                        var name=last.Slot.ToString();if(v.parameters.Contains(name))v.animator.SetTrigger(name);
                    }
                }
                bool tookHit=v.health>u.State.Health+.01f;
                if(u.Villager!=null&&u.Villager.Actions>v.villageActions){
                    v.villageActions=u.Villager.Actions;
                    if(!tookHit){
                        if(v.animator&&v.parameters.Contains("Work"))v.animator.SetTrigger("Work");
                        if(worldEffects&&inView)worldEffects.Emit(t.position,WorldImpactKind.Work,unchecked(u.Id*397+v.villageActions),new Color(.68f,.54f,.28f));
                    }
                }
                if(!castThisFrame&&tookHit&&v.animator&&v.parameters.Contains("Hit"))v.animator.SetTrigger("Hit");
                v.health=u.State.Health;
            }
            removed.Clear();foreach(var pair in active)if(!seen.Contains(pair.Key)){
                var v=pair.Value;var u=v.unit;
                // Retain the unit reference even if the simulation removed a dead minion this tick.
                // Culling an alive unit or expiring a temporary structure never emits a death effect.
                if(!immediate&&worldEffects&&u!=null&&!u.State.Alive&&!u.Temporary&&IsInView(u)){
                    var kind=u.Core?WorldImpactKind.Core:u.Kind==BattleTargetKind.Structure?WorldImpactKind.Structure:WorldImpactKind.Unit;
                    var tint=u.Team==ArenaTeam.Lux?new Color(.55f,.69f,.82f):new Color(.48f,.25f,.28f);
                    worldEffects.Emit(Ground(u.Position),kind,unchecked(u.Id*397+(int)(Battle.Time*10)),tint);
                    if(effects)effects.Emit(Ground(u.Position),tint,u.Core?3:u.Kind==BattleTargetKind.Structure?2:1);
                }
                Return(v);removed.Add(pair.Key);
            }
            foreach(int id in removed)active.Remove(id);
        }
        private void Follow(bool immediate){
            var at=Ground(Battle.Player.Position);var desired=at+new Vector3(0,cameraHeight,-cameraHeight*.72f);
            var t=battleCamera.transform;t.position=immediate?desired:Vector3.Lerp(t.position,desired,1-Mathf.Exp(-10*Time.deltaTime));t.rotation=Quaternion.Euler(54,0,0);
        }
    }
}
