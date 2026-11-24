using System;
using System.Collections.Generic;
using UnityEngine;
namespace Buklod.Empire {
    // Separate online presentation scene. Never advances OfflineBattle, even on disconnect.
    public sealed class OnlineBattlePresentation:MonoBehaviour {
        public BattleVisualCatalog visuals;
        public Camera battleCamera;
        public float worldScale=1,cameraHeight=23;
        OnlineTimeline timeline;OnlineSnapshot last;float arrived;
        sealed class Entry {public GameObject Instance;public Animator Animator;public bool Speed;public GameObject Prefab;}
        readonly Dictionary<int,Entry> active=new Dictionary<int,Entry>();
        readonly HashSet<int> seen=new HashSet<int>();readonly List<int> removed=new List<int>();
        readonly Dictionary<GameObject,Stack<Entry>> pool=new Dictionary<GameObject,Stack<Entry>>();
        int pooled;
        public void Bind(OnlineTimeline state){
            if(state==null||!visuals||!battleCamera||worldScale<=0||FindFirstObjectByType<BattleView>()!=null)throw new InvalidOperationException("Use a separate online scene and valid catalog.");
            visuals.Validate();Clear();timeline=state;
        }
        GameObject Resolve(OnlineUnit u){
            if(u.Kind==BattleTargetKind.Hero){foreach(var h in visuals.heroes)if(h.id==u.Hero)return h.prefab;}
            else foreach(var f in visuals.factions)if(f.team==u.Team){
                if(u.Kind==BattleTargetKind.Structure)return (u.Flags&2)!=0?f.core:(u.Flags&8)!=0?f.depot:(u.Flags&16)!=0?f.guardPost:(u.Flags&32)!=0?f.farm:(u.Flags&64)!=0?f.barracks:(u.Flags&128)!=0?f.market:(u.Flags&256)!=0?f.house:f.tower;
                if(u.Kind==BattleTargetKind.Villager){foreach(var v in f.villagers)if(v.id==u.VillagerVisual)return v.prefab;return null;}
                if(u.Kind==BattleTargetKind.Minion&&(int)u.Role>=0&&(int)u.Role<f.minions.Length)return f.minions[(int)u.Role];
            }
            return null;
        }
        Entry Rent(GameObject prefab,Vector3 position){
            Entry e=null;if(pool.TryGetValue(prefab,out var stack)&&stack.Count>0){e=stack.Pop();pooled--;}
            if(e==null){
                var go=Instantiate(prefab,position,prefab.transform.rotation,transform);
                foreach(var c in go.GetComponentsInChildren<Collider>(true))c.enabled=false;
                var anim=go.GetComponentInChildren<Animator>(true);bool speed=false;
                if(anim)foreach(var p in anim.parameters)if(p.name=="Speed"&&p.type==AnimatorControllerParameterType.Float)speed=true;
                e=new Entry{Instance=go,Animator=anim,Speed=speed,Prefab=prefab};
            }
            var t=e.Instance.transform;t.position=position;t.rotation=prefab.transform.rotation;t.localScale=prefab.transform.localScale;e.Instance.SetActive(true);
            if(e.Animator){e.Animator.Rebind();if(e.Speed)e.Animator.SetFloat("Speed",0);}
            return e;
        }
        void Return(int id){
            var e=active[id];active.Remove(id);if(!e.Instance)return;e.Instance.SetActive(false);
            if(pooled>=96){Destroy(e.Instance);return;}
            if(!pool.TryGetValue(e.Prefab,out var stack)){stack=new Stack<Entry>();pool.Add(e.Prefab,stack);}
            stack.Push(e);pooled++;
        }
        void Clear(){removed.Clear();foreach(var id in active.Keys)removed.Add(id);foreach(var id in removed)Return(id);last=null;}
        void Update(){
            if(timeline==null||!timeline.Connected||timeline.Current==null){if(active.Count>0)Clear();return;}
            var s=timeline.Current;if(last!=s){last=s;arrived=Time.unscaledTime;}
            float fraction=Mathf.Clamp01((Time.unscaledTime-arrived)/OfflineBattle.Step);seen.Clear();
            foreach(var u in s.Units){
                if(!timeline.TryPosition(u.Id,fraction,out var p))continue;
                var prefab=Resolve(u);if(!prefab)continue;
                var world=new Vector3(p.x*worldScale,0,p.y*worldScale);
                if(!active.TryGetValue(u.Id,out var e)){e=Rent(prefab,world);active.Add(u.Id,e);}
                var t=e.Instance.transform;var delta=world-t.position;t.position=world;
                if(delta.sqrMagnitude>.0001f)t.rotation=Quaternion.LookRotation(delta);
                if(e.Animator&&e.Speed)e.Animator.SetFloat("Speed",delta.magnitude/Mathf.Max(.001f,Time.unscaledDeltaTime));
                seen.Add(u.Id);
            }
            removed.Clear();foreach(var id in active.Keys)if(!seen.Contains(id))removed.Add(id);foreach(var id in removed)Return(id);
            if(timeline.TryPosition(s.OwnUnitId,fraction,out var own)){
                var desired=new Vector3(own.x*worldScale,cameraHeight,own.y*worldScale-cameraHeight*.73f);
                battleCamera.transform.position=Vector3.Lerp(battleCamera.transform.position,desired,1-Mathf.Exp(-10*Time.unscaledDeltaTime));
                battleCamera.transform.rotation=Quaternion.Euler(54,0,0);
            }
        }
        void OnDisable(){Clear();}
        void OnDestroy(){foreach(var stack in pool.Values)foreach(var e in stack)if(e.Instance)Destroy(e.Instance);pool.Clear();}
    }
}
