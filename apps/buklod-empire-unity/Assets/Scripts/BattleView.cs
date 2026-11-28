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
        [SerializeField, HideInInspector] private bool stylizedBenchmark;
        private bool StylizedBenchmark => ReviewOnly && stylizedBenchmark;
        private ArenaReviewFoley reviewFoley;
        private ReviewHeroDialogue reviewDialogue;
        ReviewMotionLibrary reviewMotion;bool authoredWalk;
        internal ReviewMotionLibrary MotionPreview=>ReviewOnly?GetComponent<ReviewMotionLibrary>():null;
#if UNITY_EDITOR
        public void ConfigureStylizedBenchmark(){if(Application.isPlaying||!IsConfiguredReview)throw new System.InvalidOperationException("Benchmark is review-only.");stylizedBenchmark=true;}
#endif
        public OfflineBattle Battle {get;private set;}
        LocalPracticeStore practice;System.Guid practiceMatch;bool practiceAttempted;bool practiceUnavailable;
        internal string PracticeResultStatus {get;private set;}="";
        LocalPracticeStore PracticeStore(){
            if(!ReviewOnly||practiceUnavailable)return null;
            if(practice==null)try{practice=new LocalPracticeStore(System.IO.Path.Combine(Application.persistentDataPath,"offline-practice"));}
                catch(System.Exception e){practiceUnavailable=true;Debug.LogWarning("Local practice storage unavailable: "+e.GetType().Name);}
            return practice;
        }
        internal PracticeHeroStats PracticeStats(string hero)=>PracticeStore()?.Stats(hero);
        void SavePracticeResult(){
            if(!ReviewOnly||practiceAttempted||Battle==null||!Battle.Finished)return;
            practiceAttempted=true;
            if(Battle.AutonomousTraining){PracticeResultStatus="AI demonstration — not recorded";return;}
            var store=PracticeStore();if(store==null){PracticeResultStatus="Local practice save unavailable";return;}
            var p=Battle.Player;int outcome=!Battle.Winner.HasValue?0:Battle.Winner.Value==p.Team?1:-1;
            try{store.Record(practiceMatch,selectedHero,outcome,p.Kills,p.Deaths,p.Assists);PracticeResultStatus="Local mastery recorded";}
            catch(System.Exception e){PracticeResultStatus="Local practice save failed";Debug.LogWarning("Practice record save failed: "+e.GetType().Name);}
        }
        public bool Paused {get;private set;}
        public int ControlFeedbackButton {get;private set;}
        public bool ControlFeedbackAccepted {get;private set;}
        public float ControlFeedbackUntil {get;private set;}
        public void SetPaused(bool value){
            Paused=value;if(input)input.enabled=!value;if(value){ControlFeedbackUntil=0;Battle?.CancelPlayerAttack();}
            foreach(var visual in active.Values)if(visual.animator)visual.animator.speed=value?0f:1f;
            foreach(var row in dying)if(row.visual.animator)row.visual.animator.speed=value?0f:1f;
            if(value){if(skillAudio)skillAudio.Clear();if(reviewFoley)reviewFoley.SuspendBattleAudio();if(reviewDialogue)reviewDialogue.Stop();}
        }
        public const string OfflineTestApplicationId="org.mzbministry.buklod.empire.review";
        [SerializeField, HideInInspector] private bool editorReviewOnly;
#if UNITY_EDITOR
        public void ConfigureEditorReview(){if(Application.isPlaying)throw new System.InvalidOperationException("Configure review before play.");editorReviewOnly=true;}
        public bool IsConfiguredReview=>editorReviewOnly;
#endif
        internal bool IsEditorReview=>ReviewOnly;
        private bool ReviewOnly {
            get {
#if UNITY_EDITOR
                return editorReviewOnly;
#elif BUKLOD_OFFLINE_REVIEW
                return editorReviewOnly&&Application.identifier==OfflineTestApplicationId;
#else
                return false;
#endif
            }
        }
        private MobileBattleInput input;
        private BattleFieldVisuals fieldVisuals;
        private WorldInteractionEffects worldEffects;
        private BattleEffects effects;
        private ReviewContactShadows reviewShadows;
        private SkillAudio skillAudio;
        private readonly Dictionary<int,Visual> active=new Dictionary<int,Visual>();
        private readonly Dictionary<GameObject,Stack<GameObject>> pool=new Dictionary<GameObject,Stack<GameObject>>();
        private readonly HashSet<int> seen=new HashSet<int>();
        private readonly Dictionary<int,VillageResourceNode> reviewFarmNodes=new Dictionary<int,VillageResourceNode>();
        private readonly List<int> removed=new List<int>();
        private readonly List<(Visual visual,float remaining)> dying=new List<(Visual,float)>();
        private readonly Plane[] frustum=new Plane[6];
        private int pooledCount;
        public int ActiveVisualCount=>active.Count;
        public int PooledVisualCount=>pooledCount;
        private sealed class Visual {public BattleUnit unit;public ReviewFarmGrowth farmGrowth;public ReviewEquipmentVisual equipment;public GameObject instance,prefab;public Animator animator;public ReviewClipPlayback fallback;public float attack=float.NegativeInfinity,damageTaken;public int castSequence,villageActions,repairSequence,constructionWork;public LODGroup[] lodGroups;public int forcedLod=int.MinValue;public Renderer[] renderers;public ShadowCastingMode[] originalShadows;public bool shadowsOn=true;public Vector2 sampledAt;public float groundY;public readonly HashSet<string> parameters=new HashSet<string>();}
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
        public void StartMatch(string hero,ArenaDifficulty difficulty=ArenaDifficulty.Normal,ArenaTactic tactic=ArenaTactic.Renew,CovenantLoadout? covenant=null,bool autonomous=false,int seed=1){
            if(!visuals||!battleCamera||worldScale<=0)throw new System.InvalidOperationException("Battle scene is incomplete.");
            var updater=ReviewOnly?GetComponent<EmpireContentUpdater>():null;
            var nextCatalog=updater?updater.CatalogForNextMatch(visuals):visuals;
#if UNITY_EDITOR || BUKLOD_OFFLINE_REVIEW
            if(ReviewOnly)nextCatalog.ValidateOfflineReview();else
#endif
            nextCatalog.Validate();
            // Validate the requested simulation and loadout before retiring any existing match visuals.
            var candidate=new OfflineBattle(hero,new Navigation(worldScale),seed,difficulty,autonomous);
            if(!autonomous)candidate.ConfigureBotLearning(OfflineBotLearningStore.Load(hero,difficulty));
            if(!candidate.SelectPlayerTactic(tactic)||covenant.HasValue&&!candidate.SelectPlayerCovenant(covenant.Value))throw new System.InvalidOperationException("Invalid offline loadout.");
            var nextMotion=MotionPreview;if(nextMotion)nextMotion.Validate();
            // Commit the candidate before any destructive visual operation. A later exception must not advertise the retired match as resumable.
            SetPaused(true);visuals=nextCatalog;Battle=candidate;
            foreach(var v in active.Values)Return(v);active.Clear();
            foreach(var row in dying)Return(row.visual);dying.Clear();
            effects=GetComponent<BattleEffects>();if(effects)effects.Clear();
            reviewShadows=ReviewOnly?GetComponent<ReviewContactShadows>():null;if(reviewShadows)reviewShadows.Clear();
            reviewFoley=ReviewOnly?GetComponent<ArenaReviewFoley>():null;
            reviewDialogue=ReviewOnly?GetComponent<ReviewHeroDialogue>():null;if(reviewDialogue)reviewDialogue.Stop();
            reviewMotion=nextMotion;authoredWalk=reviewMotion&&reviewMotion.Requested;
            worldEffects=GetComponent<WorldInteractionEffects>();if(worldEffects)worldEffects.Clear();
            skillAudio=GetComponent<SkillAudio>();if(!skillAudio)skillAudio=gameObject.AddComponent<SkillAudio>();skillAudio.Clear();
            selectedHero=hero;Paused=false;ControlFeedbackUntil=0;practiceMatch=System.Guid.NewGuid();practiceAttempted=false;PracticeResultStatus="";
            input=GetComponent<MobileBattleInput>();if(!input)input=gameObject.AddComponent<MobileBattleInput>();input.Bind(this);input.enabled=true;
            if(!GetComponent<BattleHud>())gameObject.AddComponent<BattleHud>();
            fieldVisuals=GetComponent<BattleFieldVisuals>();if(!fieldVisuals)fieldVisuals=gameObject.AddComponent<BattleFieldVisuals>();fieldVisuals.Bind(this);
            Follow(true);Sync(true);fieldVisuals.Refresh();
        }
        private void Start(){
            if(Battle==null){if(ReviewOnly)SetPaused(true);else StartMatch(selectedHero);}
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
            if(Battle==null||Paused||Battle.Finished||Battle.AutonomousTraining||button<1||button>8)return false;
            var direction=ToWorld(aim);
            bool ok;
            if(button!=1&&button!=7&&button!=8)Battle.CancelPlayerAttack();
            switch(button){case 1:ok=Battle.RequestPlayerBasic(direction);break;case 5:ok=Battle.UsePlayerTactic(direction);break;case 6:ok=Battle.RecallPlayer();break;case 7:ok=Battle.RequestPlayerBasic(direction,BattleTargetKind.Minion);break;case 8:ok=Battle.RequestPlayerBasic(direction,BattleTargetKind.Structure);break;default:ok=Battle.CastPlayer((SkillSlot)(button-2),direction);break;}
            ControlFeedbackButton=button;ControlFeedbackAccepted=ok&&!Battle.HasPendingPlayerAttack;ControlFeedbackUntil=Battle.HasPendingPlayerAttack?0:Time.unscaledTime+.28f;
            return ok;
        }
        private void Update(){if(Battle==null||Paused)return;Battle.Advance(Time.deltaTime,ToWorld(input.Joystick));SavePracticeResult();SaveBotLearning();Sync(false);if(fieldVisuals)fieldVisuals.Refresh();}
        void SaveBotLearning(){
            if(Battle==null||!Battle.TryCollectBotLearning(out var profile))return;
            try{OfflineBotLearningStore.Save(selectedHero,Battle.Difficulty,profile);}
            catch(System.Exception e){Debug.LogWarning("Offline AI learning save failed: "+e.GetType().Name);}
        }
        private void LateUpdate(){if(Battle!=null)Follow(false);}
        public Vector3 FieldPosition(Vector2 p)=>Ground(p);
        private Vector3 Ground(Vector2 p){var at=new Vector3(p.x*worldScale,0,p.y*worldScale);return NavMesh.SamplePosition(at,out var hit,Mathf.Max(2,worldScale*2),NavMesh.AllAreas)?hit.position:at;}
        private Visual Rent(GameObject prefab,BattleUnit unit){
            if(!pool.TryGetValue(prefab,out var stack)){stack=new Stack<GameObject>();pool[prefab]=stack;}
            GameObject go;
            if(stack.Count>0){go=stack.Pop();pooledCount--;}
            else go=Instantiate(prefab,transform);
            go.SetActive(true);
            var v=new Visual{instance=go,prefab=prefab,animator=go.GetComponentInChildren<Animator>(true)};
            if(ReviewOnly){v.farmGrowth=go.GetComponent<ReviewFarmGrowth>();v.equipment=go.GetComponent<ReviewEquipmentVisual>();if(v.equipment)v.equipment.ResetVisual();}
            v.lodGroups=go.GetComponentsInChildren<LODGroup>(true);
            v.renderers=go.GetComponentsInChildren<Renderer>(true);v.originalShadows=new ShadowCastingMode[v.renderers.Length];
            for(int i=0;i<v.renderers.Length;i++){
                var r=v.renderers[i];v.originalShadows[i]=r.shadowCastingMode;
                if(r is SkinnedMeshRenderer skin)skin.updateWhenOffscreen=false;
            }
            try{
                if(v.animator){
                    v.animator.speed=Paused?0f:1f;if(reviewMotion)reviewMotion.Apply(prefab,v.animator,authoredWalk);
                    if(ReviewOnly&&unit.Kind==BattleTargetKind.Hero){
                        // A live, active Animator must initialize its graph before reading parameters.
                        v.animator.cullingMode=AnimatorCullingMode.AlwaysAnimate;v.animator.Rebind();v.animator.Update(0f);
                        if(!BattleVisualCatalog.HasHeroParameters(v.animator.parameters))
                            v.fallback=ReviewClipPlayback.TryCreate(v.animator,unit.State.Kit.Id);
                    }else v.animator.Rebind();
                    if(v.fallback==null){
                        v.animator.cullingMode=AnimatorCullingMode.CullUpdateTransforms;
                        foreach(var p in v.animator.parameters)
                            if((p.name=="Speed"&&p.type==AnimatorControllerParameterType.Float)||p.type==AnimatorControllerParameterType.Trigger)v.parameters.Add(p.name);
                    }
                }else if(ReviewOnly&&unit.Kind==BattleTargetKind.Hero)throw new System.InvalidOperationException("Missing live hero animator: "+unit.State.Kit.Id);
            }catch{v.fallback?.Dispose();go.SetActive(false);Destroy(go);throw;}
            return v;
        }
        private void SetShadows(Visual v,bool enabled){
            if(v.shadowsOn==enabled)return;
            v.shadowsOn=enabled;
            for(int i=0;i<v.renderers.Length;i++)if(v.renderers[i])
                v.renderers[i].shadowCastingMode=enabled?v.originalShadows[i]:ShadowCastingMode.Off;
        }
        private void Return(Visual v){
            v.fallback?.Dispose();v.fallback=null;
            v.instance.SetActive(false);
            SetShadows(v,true); // preserve original prefab shadow modes across rentals
            var stack=pool[v.prefab];
            if(BattleRenderBudget.CanPool(pooledCount,stack.Count)){stack.Push(v.instance);pooledCount++;}
            else Destroy(v.instance);
        }
        private static bool CanTrigger(Visual v,string name)=>v.fallback!=null||v.animator&&v.parameters.Contains(name);
        private static void Trigger(Visual v,string name){
            if(v.fallback!=null)v.fallback.Trigger(name);
            else if(v.animator&&v.parameters.Contains(name))v.animator.SetTrigger(name);
        }
        private void OnDestroy(){
            foreach(var v in active.Values)v.fallback?.Dispose();
            foreach(var row in dying)row.visual.fallback?.Dispose();
        }
        private bool IsInView(BattleUnit u){
            // Conservative world-space envelope, including tall structures and pose margins.
            // Keep nearby actors even outside the camera (audio and camera movement).
            float radius=Mathf.Max(1,worldScale)*8;
            var center=new Vector3(u.Position.x*worldScale,3*worldScale,u.Position.y*worldScale);
            return GeometryUtility.TestPlanesAABB(frustum,new Bounds(center,Vector3.one*(2*radius)));
        }
        private void Sync(bool immediate){
            // Sync is suspended while paused: only visible, unpaused animation time retires a death pose.
            for(int i=dying.Count-1;i>=0;i--){
                var row=dying[i];row.remaining-=Mathf.Max(0,Time.deltaTime);
                if(immediate||row.remaining<=0){Return(row.visual);dying.RemoveAt(i);}else{row.visual.fallback?.Tick(Time.deltaTime);dying[i]=row;}
            }
            seen.Clear();
            if(reviewShadows)reviewShadows.Begin();
            reviewFarmNodes.Clear();
            if(ReviewOnly)foreach(var node in Battle.ResourceNodes)if(node.StructureId!=0&&node.Kind==VillageResourceKind.Food)reviewFarmNodes[node.StructureId]=node;
            GeometryUtility.CalculateFrustumPlanes(battleCamera,frustum);
            var playerPosition=Battle.Player.Position;
            foreach(var u in Battle.Units){
                if(!u.State.Alive||u.Team!=Battle.Player.Team&&!Battle.IsVisibleTo(Battle.Player.Team,u))continue;
                bool player=u==Battle.Player,existing=active.TryGetValue(u.Id,out var v);
                float distanceSquared=(u.Position-playerPosition).sqrMagnitude;
                bool inView=IsInView(u);
                if(!BattleRenderBudget.RetainVisual(player,inView,existing,distanceSquared))continue;
                seen.Add(u.Id);
                if(!existing){
                    v=Rent(visuals.Resolve(u,ReviewOnly),u);v.unit=u;active.Add(u.Id,v);
                    var ground=Ground(u.Position);v.instance.transform.position=ground;
                    // A reused visual must not inherit the previous unit's rotation.
                    if(u.Kind!=BattleTargetKind.Structure)v.instance.transform.rotation=Quaternion.LookRotation(u.Team==ArenaTeam.Lux?Vector3.right:Vector3.left);
                    v.sampledAt=u.Position;v.groundY=ground.y;v.attack=u.LastAttack;v.castSequence=u.State.CastSequence;v.damageTaken=u.DamageTaken;v.villageActions=u.Villager?.Actions??0;v.repairSequence=u.RepairSequence;v.constructionWork=u.ConstructionWorkSequence;
                }
                if(ReviewOnly&&u.IsFarm&&v.farmGrowth&&reviewFarmNodes.TryGetValue(u.Id,out var farmNode))
                    v.farmGrowth.Apply(farmNode.Stock,farmNode.Capacity,immediate||!existing,Time.deltaTime);
                bool hero=u.Kind==BattleTargetKind.Hero;
                if(hero&&v.equipment)v.equipment.Apply(u);
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
                var previousPosition=t.position;
                var delta=goal-t.position;var flat=new Vector3(delta.x,0,delta.z);
                if(immediate)t.position=goal;else t.position=Vector3.Lerp(t.position,goal,1-Mathf.Exp(-18*Time.deltaTime));
                if(reviewShadows&&inView)reviewShadows.Add(t.position,u.Kind,u.Core,worldScale);
                if(flat.sqrMagnitude>.0001f)t.rotation=Quaternion.Slerp(t.rotation,Quaternion.LookRotation(flat),1-Mathf.Exp(-15*Time.deltaTime));
                if(v.fallback!=null)v.fallback.SetSpeed(immediate?0:StylizedArenaPresentation.Speed(previousPosition,t.position,Time.deltaTime));
                else if(v.animator&&v.parameters.Contains("Speed")){
                    if(StylizedBenchmark){
                        float speed=immediate?0:StylizedArenaPresentation.Speed(previousPosition,t.position,Time.deltaTime);
                        if(immediate||speed==0&&flat.sqrMagnitude<.0001f)v.animator.SetFloat("Speed",0);
                        else v.animator.SetFloat("Speed",speed,.10f,Time.deltaTime);
                    }else v.animator.SetFloat("Speed",immediate?0:flat.magnitude*(1-Mathf.Exp(-18*Time.deltaTime))/Mathf.Max(.0001f,Time.deltaTime));
                }
                bool attackedThisFrame=u.LastAttack>v.attack;
                if(attackedThisFrame){
                    v.attack=u.LastAttack;
                    if(u.Kind!=BattleTargetKind.Structure&&u.AttackFacing.sqrMagnitude>.001f)t.rotation=Quaternion.LookRotation(new Vector3(u.AttackFacing.x,0,u.AttackFacing.y));
                    Trigger(v,"Attack");
                    if(u.Kind==BattleTargetKind.Hero){
                        if(effects)effects.EmitBasic(t.position,BattleEffects.Accent(u.State.Kit.Id),t.forward,u.State.Kit.BasicRange>=8f);
                        if(reviewFoley&&inView&&!immediate)reviewFoley.WeaponAttack(u.State.Kit.Id,t.position,player);
                    }else if(u.IsCombatStructure&&effects&&inView&&!immediate&&Battle.IsPositionVisibleTo(Battle.Player.Team,u.LastAttackTargetPosition)){
                        // Reuse the existing bolt effect for confirmed tower fire; no new art assets.
                        var at=Ground(u.LastAttackTargetPosition);var direction=at-t.position;direction.y=0;
                        var color=u.Team==ArenaTeam.Lux?new Color(.35f,.8f,1):new Color(1,.28f,.35f);
                        if(direction.sqrMagnitude>.001f)effects.EmitSkill(t.position+Vector3.up*.65f,color,new SkillCue("structure_attack_feedback",SkillCueShape.Bolt,direction.magnitude/1.5f,.24f,-1),direction);
                        effects.Emit(at,color,0);
                    }
                }
                bool castThisFrame=false;
                int latest=u.State.CastSequence;
                if(latest>v.castSequence){
                    int first=Mathf.Max(v.castSequence+1,latest-SkillActor.CastHistoryCapacity+1);
                    for(int seq=first;seq<=latest;seq++){
                        if(!u.State.TryGetCast(seq,out var cast)||u.State.Kit==null||!SkillCueCatalog.TryGet(u.State.Kit.Skill(cast.Slot).Id,out var cue))continue;
                        var aim=cast.Aim;var forward=aim.sqrMagnitude>.0025f?new Vector3(aim.x,0,aim.y):t.forward;
                        if(aim.sqrMagnitude>.0025f)t.rotation=Quaternion.LookRotation(forward);
                        if(effects)effects.EmitSkill(t.position,BattleEffects.Accent(u.State.Kit.Id),cue,forward);
                        if(skillAudio&&(u==Battle.Player||Vector2.Distance(u.Position,Battle.Player.Position)<=26))skillAudio.Play(cue,t.position,u==Battle.Player);
                        if(reviewDialogue&&u==Battle.Player&&cast.Slot==SkillSlot.Ultimate)reviewDialogue.Ultimate(u.State.Kit.Id);
                        castThisFrame=true;
                    }
                    v.castSequence=latest;
                    // One skeleton cannot play multiple full-body skills concurrently. Present every
                    // retained cast cue, and prioritize the newest successful cast for the pose.
                    if(castThisFrame&&v.animator&&u.State.TryGetCast(latest,out var last)){
                        foreach(var trigger in new[]{"Primary","Secondary","Ultimate","Attack","Hit"})if(v.parameters.Contains(trigger))v.animator.ResetTrigger(trigger);
                        var name=last.Slot.ToString();Trigger(v,name);
                    }
                }
                if(u.RepairSequence>v.repairSequence){
                    v.repairSequence=u.RepairSequence;
                    if(ReviewOnly&&inView){
                        var repairTint=new Color(.32f,.9f,.52f);
                        if(worldEffects)worldEffects.Emit(t.position,WorldImpactKind.Work,unchecked(u.Id*397+u.RepairSequence),repairTint);
                        if(effects)effects.EmitSkill(t.position,repairTint,new SkillCue("repair_review",SkillCueShape.Heal,1.8f,.55f,-1),t.forward);
                    }
                }
                bool tookHit=u.DamageTaken>v.damageTaken+.001f;
                bool built=u.ConstructionWorkSequence>v.constructionWork;v.constructionWork=u.ConstructionWorkSequence;
                if(built&&!tookHit&&!attackedThisFrame){
                    Trigger(v,"Work");
                    if(inView&&worldEffects)worldEffects.Emit(t.position,WorldImpactKind.Work,unchecked(u.Id*397+v.constructionWork),new Color(.68f,.54f,.28f));
                    if(inView&&reviewFoley)reviewFoley.Work(t.position);
                }
                if(u.Villager!=null&&u.Villager.Actions>v.villageActions){
                    v.villageActions=u.Villager.Actions;
                    if(!built&&!tookHit&&!attackedThisFrame){
                        Trigger(v,"Work");
                        if(worldEffects&&inView)worldEffects.Emit(t.position,WorldImpactKind.Work,unchecked(u.Id*397+v.villageActions),new Color(.68f,.54f,.28f));
                        if(inView&&reviewFoley)reviewFoley.Work(t.position);
                    }
                }
                if(!castThisFrame&&!attackedThisFrame&&tookHit)Trigger(v,"Hit");
                if(tookHit&&!immediate&&inView&&reviewFoley)reviewFoley.Impact(u.Kind==BattleTargetKind.Structure,t.position);
                v.damageTaken=u.DamageTaken;v.fallback?.Tick(immediate?0:Time.deltaTime);
            }
            removed.Clear();foreach(var pair in active)if(!seen.Contains(pair.Key)){
                var v=pair.Value;var u=v.unit;
                // Retain the unit reference even if the simulation removed a dead minion this tick.
                // Culling an alive unit or expiring a temporary structure never emits a death effect.
                bool visibleDeath=!immediate&&u!=null&&!u.State.Alive&&!u.Temporary&&GeometryUtility.TestPlanesAABB(frustum,new Bounds(v.instance.transform.position,Vector3.one*Mathf.Max(2,worldScale*8)));
                if(visibleDeath){
                    var kind=u.Core?WorldImpactKind.Core:u.Kind==BattleTargetKind.Structure?WorldImpactKind.Structure:WorldImpactKind.Unit;
                    var tint=u.Team==ArenaTeam.Lux?new Color(.55f,.69f,.82f):new Color(.48f,.25f,.28f);
                    if(worldEffects)worldEffects.Emit(v.instance.transform.position,kind,unchecked(u.Id*397+(int)(Battle.Time*10)),tint);
                    if(reviewFoley&&u.DamageTaken>v.damageTaken+.001f)reviewFoley.Impact(u.Kind==BattleTargetKind.Structure,v.instance.transform.position);
                    if(effects)effects.Emit(v.instance.transform.position,tint,u.Core?3:u.Kind==BattleTargetKind.Structure?2:1);
                }
                if(visibleDeath&&BattleRenderBudget.CanRetire(dying.Count)&&v.animator&&v.animator.runtimeAnimatorController&&CanTrigger(v,"Death")){
                    foreach(var trigger in new[]{"Attack","Primary","Secondary","Ultimate","Hit","Work","Skill"})if(v.parameters.Contains(trigger))v.animator.ResetTrigger(trigger);
                    if(v.parameters.Contains("Speed"))v.animator.SetFloat("Speed",0);
                    Trigger(v,"Death");
                    var duration=1.2f;
                    foreach(var clip in v.animator.runtimeAnimatorController.animationClips)if(clip&&clip.name=="Death")duration=Mathf.Clamp(clip.length+.1f,.4f,2.5f);
                    dying.Add((v,duration));
                }else Return(v);
                removed.Add(pair.Key);
            }
            foreach(int id in removed)active.Remove(id);
            if(reviewShadows)reviewShadows.End();
        }
        private void Follow(bool immediate){
            var at=Ground(Battle.Player.Position);
            if(StylizedBenchmark){
                var cameraTransform=battleCamera.transform;
                battleCamera.orthographicSize=StylizedArenaPresentation.OrthographicSize*ArenaControlSettings.Zoom;
                var desiredPosition=at+StylizedArenaPresentation.CameraOffset;
                cameraTransform.position=immediate?desiredPosition:Vector3.Lerp(cameraTransform.position,desiredPosition,StylizedArenaPresentation.FollowWeight(Time.deltaTime));
                cameraTransform.rotation=StylizedArenaPresentation.CameraRotation;
                return;
            }
            // Restrained spectator-only dolly. Keep the camera heading and human input projection unchanged.
            float height=cameraHeight*ArenaControlSettings.Zoom;
            if(ReviewOnly&&Battle.AutonomousTraining&&!Battle.Finished)
                height+=Mathf.Min(1.1f,cameraHeight*.045f)*Mathf.Sin(Battle.Time*.24f);
            var desired=at+new Vector3(0,height,-height*.72f);
            var t=battleCamera.transform;t.position=immediate?desired:Vector3.Lerp(t.position,desired,1-Mathf.Exp(-10*Time.deltaTime));t.rotation=Quaternion.Euler(54,0,0);
        }
    }
}
