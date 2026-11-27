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
        ReviewCombatOverlay combatOverlay;ReviewProjectileEffects projectileEffects;float collapseUntil;bool finishSynced;ReviewPalette matchPalette;bool revealActive;Vector3 revealEnd,revealStart;Quaternion revealEndRotation,revealStartRotation;float revealEndSize;
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
        internal bool ReadyForReviewResult=>Battle!=null&&Battle.Finished&&finishSynced&&Application.isFocused&&(Paused||Time.unscaledTime>=collapseUntil);
        internal bool ShowingCoreCollapse=>ReviewOnly&&Battle!=null&&Battle.Finished&&!ReadyForReviewResult;
        public int ControlFeedbackButton {get;private set;}
        public bool ControlFeedbackAccepted {get;private set;}
        public float ControlFeedbackUntil {get;private set;}
        public void SetPaused(bool value){
            Paused=value;if(input)input.enabled=!value&&Battle!=null&&!Battle.Finished;if(value)ControlFeedbackUntil=0;
            if(fieldVisuals)fieldVisuals.SetPaused(value);
            foreach(var visual in active.Values){if(visual.animator)visual.animator.speed=value?0f:1f;if(value&&visual.weaponTrail)visual.weaponTrail.Cancel();}
            foreach(var row in dying)if(row.visual.animator)row.visual.animator.speed=value||row.visual.collapsing?0f:1f;
            if(value){collapseUntil=0;if(projectileEffects)projectileEffects.Clear();if(effects)effects.Clear();if(skillAudio)skillAudio.Clear();if(reviewFoley)reviewFoley.SuspendBattleAudio();if(reviewDialogue)reviewDialogue.Stop();}
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
        private sealed class Visual {public BattleUnit unit;public ReviewFarmGrowth farmGrowth;public ReviewEquipmentVisual equipment;public ReviewWeaponTrail weaponTrail;public float facingHold;public bool collapsing;public ReviewStructureFragments fragments;public float fragmentHeight;public float collapseDuration,collapseHeight;public Vector3 collapseOrigin,collapseScale;public Quaternion collapseRotation;public GameObject instance,prefab;public Animator animator;public float attack=float.NegativeInfinity,damageTaken;public int castSequence,villageActions,repairSequence,constructionWork,level;public LODGroup[] lodGroups;public int forcedLod=int.MinValue;public Renderer[] renderers;public ShadowCastingMode[] originalShadows;public bool shadowsOn=true;public Vector2 sampledAt;public float groundY;public readonly HashSet<string> parameters=new HashSet<string>();}
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
        public void StartMatch(string hero,ArenaDifficulty difficulty=ArenaDifficulty.Normal,ArenaTactic tactic=ArenaTactic.Renew,CovenantLoadout? covenant=null,bool autonomous=false,int seed=1,bool startPaused=false,ReviewPalette palette=ReviewPalette.Original){
            if(!visuals||!battleCamera||worldScale<=0)throw new System.InvalidOperationException("Battle scene is incomplete.");
#if UNITY_EDITOR || BUKLOD_OFFLINE_REVIEW
            if(ReviewOnly)visuals.ValidateOfflineReview();else
#endif
            visuals.Validate();
            var nextBattle=new OfflineBattle(hero,new Navigation(worldScale),seed,difficulty,autonomous);
            if(!nextBattle.SelectPlayerTactic(tactic)||covenant.HasValue&&!nextBattle.SelectPlayerCovenant(covenant.Value))throw new System.InvalidOperationException("Invalid offline loadout.");
            var nextMotion=MotionPreview;if(nextMotion)nextMotion.Validate();
            // Commit only after candidate simulation and loadout validation. Any later presentation failure is aborted by review menu.
            SetPaused(true);Battle=nextBattle;collapseUntil=0;finishSynced=false;
            foreach(var v in active.Values)Return(v);active.Clear();
            foreach(var row in dying)Return(row.visual);dying.Clear();
            effects=GetComponent<BattleEffects>();if(effects)effects.Clear();
            reviewShadows=ReviewOnly?GetComponent<ReviewContactShadows>():null;if(reviewShadows)reviewShadows.Clear();
            reviewFoley=ReviewOnly?GetComponent<ArenaReviewFoley>():null;
            reviewDialogue=ReviewOnly?GetComponent<ReviewHeroDialogue>():null;if(reviewDialogue)reviewDialogue.Stop();
            reviewMotion=nextMotion;authoredWalk=reviewMotion&&reviewMotion.Requested;
            worldEffects=GetComponent<WorldInteractionEffects>();if(worldEffects)worldEffects.Clear();
            skillAudio=GetComponent<SkillAudio>();if(!skillAudio)skillAudio=gameObject.AddComponent<SkillAudio>();skillAudio.Clear();
            selectedHero=hero;matchPalette=ReviewOnly?palette:ReviewPalette.Original;Paused=startPaused;ControlFeedbackUntil=0;practiceMatch=System.Guid.NewGuid();practiceAttempted=false;PracticeResultStatus="";
            input=GetComponent<MobileBattleInput>();if(!input)input=gameObject.AddComponent<MobileBattleInput>();input.Bind(this);input.enabled=!startPaused;
            if(!GetComponent<BattleHud>())gameObject.AddComponent<BattleHud>();
            fieldVisuals=GetComponent<BattleFieldVisuals>();if(!fieldVisuals)fieldVisuals=gameObject.AddComponent<BattleFieldVisuals>();fieldVisuals.Bind(this);
            if(ReviewOnly){combatOverlay=GetComponent<ReviewCombatOverlay>();if(!combatOverlay)combatOverlay=gameObject.AddComponent<ReviewCombatOverlay>();combatOverlay.Bind(this);projectileEffects=GetComponent<ReviewProjectileEffects>();if(!projectileEffects)projectileEffects=gameObject.AddComponent<ReviewProjectileEffects>();projectileEffects.Bind(this,effects?effects.pulseMaterial:null);}
            Follow(true);Sync(true);fieldVisuals.Refresh();
        }
        internal void AbortReviewMatch(){
            if(!ReviewOnly)return;EndReviewReveal();SetPaused(true);if(combatOverlay)combatOverlay.ResetOverlay();Battle=null;practiceAttempted=true;PracticeResultStatus="";
            foreach(var v in active.Values)Return(v);active.Clear();foreach(var row in dying)Return(row.visual);dying.Clear();
            if(effects)effects.Clear();if(reviewShadows)reviewShadows.Clear();if(worldEffects)worldEffects.Clear();if(fieldVisuals)fieldVisuals.Bind(this);
        }
        private void Start(){
            if(Battle==null&&!ReviewOnly)StartMatch(selectedHero);
            else if(Battle==null){
                SetPaused(true);input=GetComponent<MobileBattleInput>();if(!input)input=gameObject.AddComponent<MobileBattleInput>();input.Bind(this);input.enabled=false;
                if(!GetComponent<BattleHud>())gameObject.AddComponent<BattleHud>();
                skillAudio=GetComponent<SkillAudio>();if(!skillAudio)skillAudio=gameObject.AddComponent<SkillAudio>();
            }
            if(!GetComponent<OfflineSessionMenu>())gameObject.AddComponent<OfflineSessionMenu>();
        }
        private void OnApplicationPause(bool paused){if(paused&&Battle!=null&&(!Battle.Finished||collapseUntil>Time.unscaledTime))SetPaused(true);}
        private void OnApplicationFocus(bool focused){if(!focused&&Battle!=null&&(!Battle.Finished||collapseUntil>Time.unscaledTime))SetPaused(true);}
        private Vector2 ToWorld(Vector2 screen){
            Vector3 right=battleCamera.transform.right,forward=battleCamera.transform.forward;
            var r=new Vector2(right.x,right.z).normalized;var f=new Vector2(forward.x,forward.z).normalized;
            return Vector2.ClampMagnitude(r*screen.x+f*screen.y,1);
        }
        internal string PreviewAttack(int button,Vector2 aim){if(!ReviewOnly||Battle==null||Paused||!Application.isFocused)return "";return Battle.PreviewBasicTarget(ToWorld(aim),button==7?BattleTargetKind.Minion:button==8?BattleTargetKind.Structure:(BattleTargetKind?)null);}
        public bool Cast(int button,Vector2 aim){
            if(Battle==null||Paused||Battle.Finished||Battle.AutonomousTraining||!Application.isFocused||button<1||button>8)return false;
            var direction=ToWorld(aim);
            bool ok;
            switch(button){case 1:ok=Battle.PlayerAttack(direction);break;case 5:ok=Battle.UsePlayerTactic(direction);break;case 6:ok=Battle.RecallPlayer();break;case 7:ok=Battle.PlayerAttackTarget(BattleTargetKind.Minion,direction);break;case 8:ok=Battle.PlayerAttackTarget(BattleTargetKind.Structure,direction);break;default:ok=Battle.CastPlayer((SkillSlot)(button-2),direction);break;}
            ControlFeedbackButton=button;ControlFeedbackAccepted=ok;ControlFeedbackUntil=Time.unscaledTime+.28f;
            return ok;
        }
        private void Update(){if(Battle==null)return;if(Paused){if(ReviewOnly&&Battle.Finished&&!finishSynced){Sync(true);SavePracticeResult();}return;}Battle.Advance(Time.deltaTime,ToWorld(input.Joystick));if(ReviewOnly&&Battle.Finished&&input)input.enabled=false;SavePracticeResult();Sync(false);if(fieldVisuals)fieldVisuals.Refresh();}
        private void LateUpdate(){if(Battle!=null&&!revealActive&&!Paused&&!Battle.Finished)Follow(false);}
        internal void BeginReviewReveal(){
            if(!ReviewOnly||Battle==null||!Paused||!battleCamera)return;
            Follow(true);var t=battleCamera.transform;revealEnd=t.position;revealEndRotation=t.rotation;revealEndSize=battleCamera.orthographicSize;
            var at=Ground(Battle.Player.Position);revealStart=at+(revealEnd-at)*1.22f+Vector3.up*2f;revealStartRotation=Quaternion.LookRotation(at-revealStart,Vector3.up);revealActive=true;SetReviewReveal(0);
        }
        internal void SetReviewReveal(float value){if(!revealActive)return;float t=Mathf.SmoothStep(0,1,Mathf.Clamp01(value));battleCamera.transform.SetPositionAndRotation(Vector3.Lerp(revealStart,revealEnd,t),Quaternion.Slerp(revealStartRotation,revealEndRotation,t));if(battleCamera.orthographic)battleCamera.orthographicSize=revealEndSize*Mathf.Lerp(1.24f,1,t);}
        internal void EndReviewReveal(){if(!revealActive)return;SetReviewReveal(1);revealActive=false;}
        public Vector3 FieldPosition(Vector2 p)=>Ground(p);
        private Vector3 Ground(Vector2 p){var at=new Vector3(p.x*worldScale,0,p.y*worldScale);return NavMesh.SamplePosition(at,out var hit,Mathf.Max(2,worldScale*2),NavMesh.AllAreas)?hit.position:at;}
        private Visual Rent(GameObject prefab){
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
            if(v.animator){v.animator.speed=Paused?0f:1f;if(reviewMotion)reviewMotion.Apply(prefab,v.animator,authoredWalk);v.animator.cullingMode=AnimatorCullingMode.CullUpdateTransforms;v.animator.Rebind();foreach(var p in v.animator.parameters)v.parameters.Add(p.name);}
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
            if(v.fragments)v.fragments.ResetVisual();
            if(v.collapsing){var t=v.instance.transform;t.position=v.collapseOrigin;t.rotation=v.collapseRotation;t.localScale=v.collapseScale;v.collapsing=false;}
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
            for(int i=dying.Count-1;i>=0;i--){var row=dying[i];row.remaining-=Mathf.Max(0,Time.deltaTime);if(immediate||row.remaining<=0){Return(row.visual);dying.RemoveAt(i);}else{if(row.visual.collapsing){var v=row.visual;var u=v.unit;
                    if(u.Team!=Battle.Player.Team&&!Battle.IsPositionVisibleTo(Battle.Player.Team,u.Position)){Return(v);dying.RemoveAt(i);continue;}
                    float progress=1-row.remaining/v.collapseDuration;
                    if(v.fragments&&v.fragments.Ready)v.fragments.Apply(progress,v.fragmentHeight,u.Id);
                    else{var pose=ReviewFortressCollapse.Evaluate(progress,v.collapseHeight,u.Id,u.Core);var t=v.instance.transform;t.position=v.collapseOrigin+pose.Offset;t.rotation=v.collapseRotation*Quaternion.Euler(pose.Tilt);t.localScale=Vector3.Scale(v.collapseScale,pose.Scale);}
                }dying[i]=row;}}
            seen.Clear();if(combatOverlay)combatOverlay.BeginFrame();
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
                    v=Rent(visuals.Resolve(u,ReviewOnly));v.unit=u;active.Add(u.Id,v);
                    if(ReviewOnly&&u.Kind==BattleTargetKind.Hero){ReviewHeroPalette.Apply(v.instance,player?matchPalette:ReviewPalette.Original);v.weaponTrail=v.instance.GetComponent<ReviewWeaponTrail>();if(v.weaponTrail)v.weaponTrail.Bind(v.animator,effects?effects.pulseMaterial:null,BattleEffects.Accent(u.State.Kit.Id));}
                    var ground=Ground(u.Position);v.instance.transform.position=ground;
                    // A reused visual must not inherit the previous unit's rotation.
                    if(u.Kind!=BattleTargetKind.Structure)v.instance.transform.rotation=Quaternion.LookRotation(u.Team==ArenaTeam.Lux?Vector3.right:Vector3.left);
                    v.sampledAt=u.Position;v.groundY=ground.y;v.attack=u.LastAttack;v.castSequence=u.State.CastSequence;v.damageTaken=u.DamageTaken;v.level=u.State.Level;v.villageActions=u.Villager?.Actions??0;v.repairSequence=u.RepairSequence;v.constructionWork=u.ConstructionWorkSequence;
                }
                if(ReviewOnly&&u.IsFarm&&v.farmGrowth&&reviewFarmNodes.TryGetValue(u.Id,out var farmNode))
                    v.farmGrowth.Apply(farmNode.Stock,farmNode.Capacity,immediate||!existing,Time.deltaTime);
                bool hero=u.Kind==BattleTargetKind.Hero;
                if(v.weaponTrail)v.weaponTrail.SetVisible(inView&&!Paused&&!Battle.Finished);
                bool upgraded=hero&&v.equipment&&v.equipment.Apply(u);
                if(ReviewOnly&&player&&existing&&!immediate&&inView&&effects&&u.State.Alive&&!Battle.Finished){
                    if(u.State.Level>v.level)effects.Emit(v.instance.transform.position,new Color(1,.82f,.32f),3);
                    else if(upgraded)effects.Emit(v.instance.transform.position,BattleEffects.Accent(u.State.Kit.Id),1);
                }
                v.level=u.State.Level;
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
                v.facingHold=Mathf.Max(0,v.facingHold-Time.deltaTime);
                if(flat.sqrMagnitude>.0001f&&(!ReviewOnly||!hero||v.facingHold<=0))t.rotation=Quaternion.Slerp(t.rotation,Quaternion.LookRotation(flat),1-Mathf.Exp(-15*Time.deltaTime));
                if(v.animator&&v.parameters.Contains("Speed")){
                    if(StylizedBenchmark){
                        float speed=immediate?0:StylizedArenaPresentation.Speed(previousPosition,t.position,Time.deltaTime);
                        if(immediate||speed==0&&flat.sqrMagnitude<.0001f)v.animator.SetFloat("Speed",0);
                        else v.animator.SetFloat("Speed",speed,.10f,Time.deltaTime);
                    }else if(ReviewOnly&&hero){float speed=immediate?0:Vector3.Distance(previousPosition,t.position)/Mathf.Max(.0001f,Time.deltaTime);if(immediate)v.animator.SetFloat("Speed",0);else v.animator.SetFloat("Speed",Mathf.Min(speed,8),.09f,Time.deltaTime);}
                    else v.animator.SetFloat("Speed",immediate?0:flat.magnitude*(1-Mathf.Exp(-18*Time.deltaTime))/Mathf.Max(.0001f,Time.deltaTime));
                }
                bool attackedThisFrame=u.LastAttack>v.attack;
                if(attackedThisFrame){
                    v.attack=u.LastAttack;
                    if(u.Kind!=BattleTargetKind.Structure&&u.AttackFacing.sqrMagnitude>.001f)t.rotation=Quaternion.LookRotation(new Vector3(u.AttackFacing.x,0,u.AttackFacing.y));
                    if(v.animator&&v.parameters.Contains("Attack"))v.animator.SetTrigger("Attack");
                    if(u.Kind==BattleTargetKind.Hero){
                        if(ReviewOnly){v.facingHold=.12f;if(v.weaponTrail&&inView&&!immediate&&!Battle.Finished)v.weaponTrail.Begin();}
                        if(effects&&(!ReviewOnly||inView))effects.EmitBasic(t.position,BattleEffects.Accent(u.State.Kit.Id),t.forward,u.State.Kit.BasicRange>=8f,ReviewOnly?u.State.Kit.Id:null);
                        if(reviewFoley&&inView&&!immediate)reviewFoley.WeaponAttack(u.State.Kit.Id,t.position,player);
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
                        if(effects&&(!ReviewOnly||inView))effects.EmitSkill(t.position,BattleEffects.Accent(u.State.Kit.Id),cue,forward,ReviewOnly&&cast.Slot==SkillSlot.Ultimate);
                        if(skillAudio&&(!ReviewOnly||inView)&&(u==Battle.Player||Vector2.Distance(u.Position,Battle.Player.Position)<=26))skillAudio.Play(cue,t.position,u==Battle.Player);
                        if(reviewDialogue&&u==Battle.Player&&cast.Slot==SkillSlot.Ultimate)reviewDialogue.Ultimate(u.State.Kit.Id);
                        castThisFrame=true;if(ReviewOnly&&hero){v.facingHold=.14f;if(v.weaponTrail)v.weaponTrail.Cancel();}
                    }
                    v.castSequence=latest;
                    // One skeleton cannot play multiple full-body skills concurrently. Present every
                    // retained cast cue, and prioritize the newest successful cast for the pose.
                    if(castThisFrame&&v.animator&&u.State.TryGetCast(latest,out var last)){
                        foreach(var trigger in new[]{"Primary","Secondary","Ultimate","Attack","Hit"})if(v.parameters.Contains(trigger))v.animator.ResetTrigger(trigger);
                        var name=last.Slot.ToString();if(v.parameters.Contains(name))v.animator.SetTrigger(name);
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
                    if(v.animator&&v.parameters.Contains("Work"))v.animator.SetTrigger("Work");
                    if(inView&&worldEffects)worldEffects.Emit(t.position,WorldImpactKind.Work,unchecked(u.Id*397+v.constructionWork),new Color(.68f,.54f,.28f));
                    if(inView&&reviewFoley)reviewFoley.Work(t.position);
                }
                if(u.Villager!=null&&u.Villager.Actions>v.villageActions){
                    v.villageActions=u.Villager.Actions;
                    if(!built&&!tookHit&&!attackedThisFrame){
                        if(v.animator&&v.parameters.Contains("Work"))v.animator.SetTrigger("Work");
                        if(worldEffects&&inView)worldEffects.Emit(t.position,WorldImpactKind.Work,unchecked(u.Id*397+v.villageActions),new Color(.68f,.54f,.28f));
                        if(inView&&reviewFoley)reviewFoley.Work(t.position);
                    }
                }
                if(!castThisFrame&&!attackedThisFrame&&tookHit&&v.animator&&v.parameters.Contains("Hit"))v.animator.SetTrigger("Hit");
                if(tookHit&&!immediate&&inView&&reviewFoley)reviewFoley.Impact(u.Kind==BattleTargetKind.Structure,t.position);
                if(ReviewOnly&&tookHit&&!immediate&&inView&&hero&&effects)effects.EmitImpact(t.position+Vector3.up*.7f,u.Team==Battle.Player.Team?new Color(1,.65f,.36f):new Color(1,.88f,.58f));
                if(combatOverlay&&inView&&hero){
                    float damage=existing&&!immediate?Mathf.Max(0,u.DamageTaken-v.damageTaken):0;
                    combatOverlay.Observe(u.Id,t.position+Vector3.up*Mathf.Max(1.6f,worldScale*2.25f),u.State.Health,u.State.MaxHealth,u.State.Shield,u.State.Level,u.Team==Battle.Player.Team,player,damage);
                }
                v.damageTaken=u.DamageTaken;
            }
            removed.Clear();foreach(var pair in active)if(!seen.Contains(pair.Key)){
                var v=pair.Value;var u=v.unit;
                // Retain the unit reference even if the simulation removed a dead minion this tick.
                // Culling an alive unit or expiring a temporary structure never emits a death effect.
                bool visibleDeath=!immediate&&u!=null&&!u.State.Alive&&!u.Temporary&&(!ReviewOnly||u.Team==Battle.Player.Team||Battle.IsPositionVisibleTo(Battle.Player.Team,u.Position))&&GeometryUtility.TestPlanesAABB(frustum,new Bounds(v.instance.transform.position,Vector3.one*Mathf.Max(2,worldScale*8)));
                if(visibleDeath){
                    var kind=u.Core?WorldImpactKind.Core:u.Kind==BattleTargetKind.Structure?WorldImpactKind.Structure:WorldImpactKind.Unit;
                    var tint=u.Team==ArenaTeam.Lux?new Color(.55f,.69f,.82f):new Color(.48f,.25f,.28f);
                    if(worldEffects)worldEffects.Emit(v.instance.transform.position,kind,unchecked(u.Id*397+(int)(Battle.Time*10)),tint);
                    if(reviewFoley&&u.DamageTaken>v.damageTaken+.001f)reviewFoley.Impact(u.Kind==BattleTargetKind.Structure,v.instance.transform.position);
                    if(effects){if(ReviewOnly&&u.Core){effects.EmitCoreCollapse(v.instance.transform.position,tint);collapseUntil=Time.unscaledTime+1.25f;}else effects.Emit(v.instance.transform.position,tint,u.Core?3:u.Kind==BattleTargetKind.Structure?2:1);}
                }
                if(v.weaponTrail)v.weaponTrail.Cancel();
                if(ReviewOnly&&visibleDeath&&u.Kind==BattleTargetKind.Structure&&BattleRenderBudget.CanRetire(dying.Count)){
                    var t=v.instance.transform;v.collapsing=true;v.collapseOrigin=t.position;v.collapseRotation=t.rotation;v.collapseScale=t.localScale;v.collapseDuration=u.Core?1.25f:1.05f;
                    Bounds bounds=default;bool found=false;foreach(var renderer in v.renderers)if(renderer&&renderer.enabled&&renderer.gameObject.activeInHierarchy){if(!found){bounds=renderer.bounds;found=true;}else bounds.Encapsulate(renderer.bounds);}
                    v.collapseHeight=found?Mathf.Clamp(bounds.size.y,.5f,25f):2f;v.fragmentHeight=v.collapseHeight/Mathf.Max(.01f,Mathf.Abs(t.lossyScale.y));v.fragments=v.instance.GetComponent<ReviewStructureFragments>();if(v.fragments&&!v.fragments.Begin())v.fragments=null;if(v.animator)v.animator.speed=0;dying.Add((v,v.collapseDuration));
                }else if(visibleDeath&&BattleRenderBudget.CanRetire(dying.Count)&&v.animator&&v.animator.runtimeAnimatorController&&v.parameters.Contains("Death")){
                    foreach(var trigger in new[]{"Attack","Primary","Secondary","Ultimate","Hit","Work","Skill"})if(v.parameters.Contains(trigger))v.animator.ResetTrigger(trigger);
                    if(v.parameters.Contains("Speed"))v.animator.SetFloat("Speed",0);
                    v.animator.SetTrigger("Death");
                    var duration=1.2f;
                    foreach(var clip in v.animator.runtimeAnimatorController.animationClips)if(clip&&clip.name=="Death")duration=Mathf.Clamp(clip.length+.1f,.4f,2.5f);
                    dying.Add((v,duration));
                }else Return(v);
                removed.Add(pair.Key);
            }
            foreach(int id in removed)active.Remove(id);
            if(reviewShadows)reviewShadows.End();if(combatOverlay)combatOverlay.EndFrame();if(projectileEffects)projectileEffects.Consume(immediate);if(Battle.Finished)finishSynced=true;
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
