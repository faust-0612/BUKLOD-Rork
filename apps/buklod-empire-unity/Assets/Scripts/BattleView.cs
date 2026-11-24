using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;
namespace Buklod.Empire {
    public sealed class BattleView:MonoBehaviour {
        public BattleVisualCatalog visuals;
        public Camera battleCamera;
        public string selectedHero="phan";
        public float worldScale=1, cameraHeight=23;
        public OfflineBattle Battle {get;private set;}
#if UNITY_EDITOR
        [SerializeField, HideInInspector] private bool editorReviewOnly;
        public void ConfigureEditorReview(){if(Application.isPlaying)throw new System.InvalidOperationException("Configure review before play.");editorReviewOnly=true;}
#endif
        private MobileBattleInput input;
        private BattleEffects effects;
        private readonly Dictionary<int,Visual> active=new Dictionary<int,Visual>();
        private readonly Dictionary<GameObject,Stack<GameObject>> pool=new Dictionary<GameObject,Stack<GameObject>>();
        private readonly HashSet<int> seen=new HashSet<int>();
        private readonly List<int> removed=new List<int>();
        private sealed class Visual {public GameObject instance,prefab;public Animator animator;public float attack=float.NegativeInfinity,cast=float.NegativeInfinity,health;public readonly HashSet<string> parameters=new HashSet<string>();}
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
        public void StartMatch(string hero){
            if(!visuals||!battleCamera||worldScale<=0)throw new System.InvalidOperationException("Battle scene is incomplete.");
#if UNITY_EDITOR
            if(editorReviewOnly)visuals.ValidateEditorReview();else
#endif
            visuals.Validate();
            foreach(var v in active.Values)Return(v);active.Clear();
            effects=GetComponent<BattleEffects>();if(effects)effects.Clear();
            Battle=new OfflineBattle(hero,new Navigation(worldScale));
            input=GetComponent<MobileBattleInput>();if(!input)input=gameObject.AddComponent<MobileBattleInput>();input.Bind(this);
            if(!GetComponent<BattleHud>())gameObject.AddComponent<BattleHud>();
            Sync(true);Follow(true);
        }
        private void Start(){if(Battle==null)StartMatch(selectedHero);}
        private Vector2 ToWorld(Vector2 screen){
            Vector3 right=battleCamera.transform.right,forward=battleCamera.transform.forward;
            var r=new Vector2(right.x,right.z).normalized;var f=new Vector2(forward.x,forward.z).normalized;
            return Vector2.ClampMagnitude(r*screen.x+f*screen.y,1);
        }
        public bool Cast(int button,Vector2 aim){
            if(Battle==null||Battle.Finished||button<1||button>4)return false;
            var direction=ToWorld(aim);
            return button==1?Battle.PlayerAttack(direction):Battle.CastPlayer((SkillSlot)(button-2),direction);
        }
        private void Update(){if(Battle==null)return;Battle.Advance(Time.deltaTime,ToWorld(input.Joystick));Sync(false);}
        private void LateUpdate(){if(Battle!=null)Follow(false);}
        private Vector3 Ground(Vector2 p){var at=new Vector3(p.x*worldScale,0,p.y*worldScale);return NavMesh.SamplePosition(at,out var hit,Mathf.Max(2,worldScale*2),NavMesh.AllAreas)?hit.position:at;}
        private Visual Rent(GameObject prefab){
            if(!pool.TryGetValue(prefab,out var stack)){stack=new Stack<GameObject>();pool[prefab]=stack;}
            var go=stack.Count>0?stack.Pop():Instantiate(prefab,transform);
            go.SetActive(true);
            var v=new Visual{instance=go,prefab=prefab,animator=go.GetComponentInChildren<Animator>(true)};
            if(v.animator){v.animator.Rebind();foreach(var p in v.animator.parameters)v.parameters.Add(p.name);}
            return v;
        }
        private void Return(Visual v){v.instance.SetActive(false);pool[v.prefab].Push(v.instance);}
        private void Sync(bool immediate){
            seen.Clear();
            foreach(var u in Battle.Units){
                if(!u.State.Alive)continue;
                seen.Add(u.Id);
                if(!active.TryGetValue(u.Id,out var v)){v=Rent(visuals.Resolve(u));active.Add(u.Id,v);v.instance.transform.position=Ground(u.Position);v.attack=u.LastAttack;v.cast=u.State.LastCastAt;v.health=u.State.Health;}
                var t=v.instance.transform;var goal=new Vector3(u.Position.x*worldScale,t.position.y,u.Position.y*worldScale);
                if((goal-t.position).sqrMagnitude>.0001f)goal=Ground(u.Position);
                var delta=goal-t.position;var flat=new Vector3(delta.x,0,delta.z);
                if(immediate)t.position=goal;else t.position=Vector3.Lerp(t.position,goal,1-Mathf.Exp(-18*Time.deltaTime));
                if(flat.sqrMagnitude>.0001f)t.rotation=Quaternion.Slerp(t.rotation,Quaternion.LookRotation(flat),1-Mathf.Exp(-15*Time.deltaTime));
                if(v.animator&&v.parameters.Contains("Speed"))v.animator.SetFloat("Speed",immediate?0:flat.magnitude*(1-Mathf.Exp(-18*Time.deltaTime))/Mathf.Max(.0001f,Time.deltaTime));
                if(u.LastAttack>v.attack){v.attack=u.LastAttack;if(v.animator&&v.parameters.Contains("Attack"))v.animator.SetTrigger("Attack");if(effects&&u.Kind==BattleTargetKind.Hero)effects.Emit(t.position,BattleEffects.Accent(u.State.Kit.Id),0);}
                if(u.State.LastCastAt>v.cast){v.cast=u.State.LastCastAt;var name=u.State.LastCastSlot.ToString();if(v.animator&&v.parameters.Contains(name))v.animator.SetTrigger(name);if(effects&&u.State.Kit!=null)effects.Emit(t.position,BattleEffects.Accent(u.State.Kit.Id),1+(int)u.State.LastCastSlot);}
                if(v.health>u.State.Health+.01f&&v.animator&&v.parameters.Contains("Hit"))v.animator.SetTrigger("Hit");v.health=u.State.Health;
            }
            removed.Clear();foreach(var pair in active)if(!seen.Contains(pair.Key)){Return(pair.Value);removed.Add(pair.Key);}
            foreach(int id in removed)active.Remove(id);
        }
        private void Follow(bool immediate){
            var at=Ground(Battle.Player.Position);var desired=at+new Vector3(0,cameraHeight,-cameraHeight*.72f);
            var t=battleCamera.transform;t.position=immediate?desired:Vector3.Lerp(t.position,desired,1-Mathf.Exp(-10*Time.deltaTime));t.rotation=Quaternion.Euler(54,0,0);
        }
    }
}
