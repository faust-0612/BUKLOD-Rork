using System;
using System.Collections.Generic;
using UnityEngine;
namespace Buklod.Empire {
    // Presentation only. All harvesting, damage and collection are owned by OfflineBattle.
    public sealed class BattleFieldVisuals:MonoBehaviour {
        private BattleView view;
        private OfflineBattle bound;
        private readonly Dictionary<(int,int),GameObject> active=new Dictionary<(int,int),GameObject>();
        private readonly Dictionary<(int,int),GameObject> prefabs=new Dictionary<(int,int),GameObject>();
        private readonly Dictionary<GameObject,Stack<GameObject>> pools=new Dictionary<GameObject,Stack<GameObject>>();
        private readonly HashSet<(int,int)> seen=new HashSet<(int,int)>();
        private readonly List<(int,int)> removed=new List<(int,int)>();
        private int pooled;
        private const int PoolLimit=48;
        public int ActiveCount=>active.Count;
        public void Bind(BattleView owner){Clear();view=owner;bound=owner.Battle;}
        private void Present(int type,int id,Vector2 position,GameObject prefab){
            // Review-only catalogs can omit an object; production validation rejects them.
            if(!prefab)return;
            var key=(type,id);seen.Add(key);
            if(!active.TryGetValue(key,out var go)){
                if(pools.TryGetValue(prefab,out var pool)&&pool.Count>0){go=pool.Pop();pooled--;}
                else go=Instantiate(prefab,transform);
                go.transform.position=view.FieldPosition(position);go.SetActive(true);active.Add(key,go);prefabs.Add(key,prefab);
            }
        }
        private bool Nearby(Vector2 position)=>Vector2.Distance(position,bound.Player.Position)<=42;
        private bool Visible(Vector2 position)=>Nearby(position)&&bound.IsPositionVisibleTo(bound.Player.Team,position);
        public void Refresh(){
            if(!view||view.Battle==null)return;if(bound!=view.Battle){Clear();bound=view.Battle;}
            seen.Clear();
            if(!bound.Finished){
                foreach(var n in bound.ResourceNodes)if(n.Stock>0&&Nearby(n.Position))Present(0,n.Id,n.Position,view.visuals.ResolveResource(n.Kind));
                foreach(var c in bound.Camps)if(c.Alive&&Visible(c.Position))Present(1,c.Id,c.Position,view.visuals.ResolveCamp(c.Kind));
                foreach(var d in bound.Drops)if(Visible(d.Position))Present(2,d.Id,d.Position,view.visuals.fieldPickup);
                foreach(var d in bound.RelicDrops)if(Visible(d.Position))Present(3,d.Id,d.Position,view.visuals.relicPickup);
            }
            removed.Clear();foreach(var e in active)if(!seen.Contains(e.Key)){Return(e.Key,e.Value);removed.Add(e.Key);}
            foreach(var key in removed){active.Remove(key);prefabs.Remove(key);}
        }
        private void Return((int,int) key,GameObject go){
            if(!go)return;go.SetActive(false);
            if(pooled>=PoolLimit||!prefabs.TryGetValue(key,out var prefab)||!prefab){Destroy(go);return;}
            if(!pools.TryGetValue(prefab,out var pool)){pool=new Stack<GameObject>();pools.Add(prefab,pool);}pool.Push(go);pooled++;
        }
        private void Clear(){
            foreach(var go in active.Values)if(go)Destroy(go);
            foreach(var pool in pools.Values)foreach(var go in pool)if(go)Destroy(go);
            active.Clear();prefabs.Clear();pools.Clear();seen.Clear();removed.Clear();pooled=0;
        }
        private void OnDestroy(){Clear();}
    }
}
