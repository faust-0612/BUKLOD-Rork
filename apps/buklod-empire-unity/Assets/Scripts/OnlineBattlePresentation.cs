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
        // Separate key namespace for each snapshot entity category; IDs can overlap.
        readonly Dictionary<long,Entry> world=new Dictionary<long,Entry>();
        readonly HashSet<long> worldSeen=new HashSet<long>();
        readonly List<long> worldRemoved=new List<long>();
        internal static long WorldKey(int category,int id){
            if(category<1||category>4||id<=0)throw new ArgumentOutOfRangeException();
            return ((long)category<<32)|(uint)id;
        }
        readonly Dictionary<int,Entry> active=new Dictionary<int,Entry>();
        readonly HashSet<int> seen=new HashSet<int>();readonly List<int> removed=new List<int>();
        readonly Dictionary<GameObject,Stack<Entry>> pool=new Dictionary<GameObject,Stack<Entry>>();
        int pooled;
        public void Bind(OnlineTimeline state){
            if(state==null||!visuals||!battleCamera||worldScale<=0||FindFirstObjectByType<BattleView>()!=null)throw new InvalidOperationException("Use a separate online scene and valid catalog.");
            visuals.Validate();Clear();timeline=state;
        }
        public void Unbind(){timeline=null;Clear();}
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
        void Return(int id){var e=active[id];active.Remove(id);ReturnEntry(e);}
        void ReturnEntry(Entry e){
            if(!e.Instance)return;e.Instance.SetActive(false);
            if(pooled>=96){Destroy(e.Instance);return;}
            if(!pool.TryGetValue(e.Prefab,out var stack)){stack=new Stack<Entry>();pool.Add(e.Prefab,stack);}
            stack.Push(e);pooled++;
        }
        void Clear(){
            removed.Clear();foreach(var id in active.Keys)removed.Add(id);foreach(var id in removed)Return(id);
            foreach(var entry in world.Values)ReturnEntry(entry);world.Clear();worldSeen.Clear();worldRemoved.Clear();last=null;
        }
        void ShowWorld(int category,int id,GameObject prefab,Vector2 p){
            if(!prefab)return;
            long key=WorldKey(category,id);var pos=new Vector3(p.x*worldScale,0,p.y*worldScale);
            if(world.TryGetValue(key,out var entry)&&entry.Prefab!=prefab){world.Remove(key);ReturnEntry(entry);entry=null;}
            if(entry==null){entry=Rent(prefab,pos);world.Add(key,entry);}
            entry.Instance.transform.position=pos;
            worldSeen.Add(key);
        }
        void UpdateWorld(OnlineSnapshot s){
            worldSeen.Clear();
            foreach(var camp in s.Camps)if(camp.Alive)ShowWorld(1,camp.Id,visuals.ResolveCamp(camp.Kind),camp.Position);
            foreach(var node in s.Resources)if(node.StructureId==0)ShowWorld(2,node.Id,visuals.ResolveResource(node.Kind),node.Position);
            foreach(var drop in s.Drops)ShowWorld(drop.Relic?4:3,drop.Id,drop.Relic?visuals.relicPickup:visuals.fieldPickup,drop.Position);
            worldRemoved.Clear();foreach(var id in world.Keys)if(!worldSeen.Contains(id))worldRemoved.Add(id);
            foreach(var id in worldRemoved){var e=world[id];world.Remove(id);ReturnEntry(e);}
        }
        void Update(){
            if(timeline==null||!timeline.Connected||timeline.Current==null){if(active.Count>0||world.Count>0)Clear();return;}
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
            UpdateWorld(s);
            if(timeline.TryPosition(s.OwnUnitId,fraction,out var own)){
                var desired=new Vector3(own.x*worldScale,cameraHeight,own.y*worldScale-cameraHeight*.73f);
                battleCamera.transform.position=Vector3.Lerp(battleCamera.transform.position,desired,1-Mathf.Exp(-10*Time.unscaledDeltaTime));
                battleCamera.transform.rotation=Quaternion.Euler(54,0,0);
            }
        }
        void OnDisable(){Unbind();}
        void OnDestroy(){foreach(var stack in pool.Values)foreach(var e in stack)if(e.Instance)Destroy(e.Instance);pool.Clear();}
    }
}
