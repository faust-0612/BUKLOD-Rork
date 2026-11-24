using System.Collections.Generic;
using UnityEngine;
namespace Buklod.Empire {
    // Uses only catalog assets; no generated placeholder art and no simulation authority.
    public sealed class BattleWorldObjects:MonoBehaviour {
        private readonly Dictionary<(int,int),GameObject> objects=new Dictionary<(int,int),GameObject>();
        private readonly HashSet<(int,int)> seen=new HashSet<(int,int)>();
        private readonly List<(int,int)> removed=new List<(int,int)>();
        private float lastSync=-1;
        public void ResetObjects(){foreach(var instance in objects.Values)if(instance)Destroy(instance);objects.Clear();seen.Clear();lastSync=-1;}
        private void Put(BattleView view,int category,int id,GameObject prefab,Vector2 position){
            if(!prefab)return;var key=(category,id);seen.Add(key);
            if(!objects.TryGetValue(key,out var instance)||!instance){instance=Instantiate(prefab,view.Ground(position),Quaternion.identity,transform);objects[key]=instance;}
        }
        public void Sync(BattleView view,bool immediate){
            var b=view.Battle;if(b==null||!view.visuals)return;
            if(!immediate&&b.Time-lastSync<.1f)return;lastSync=b.Time;seen.Clear();
            var catalog=view.visuals;var team=b.Player.Team;
            foreach(var n in b.ResourceNodes)if(n.StructureId==0&&n.Stock>0&&(n.Team==team||b.CanSeePosition(team,n.Position)))Put(view,0,n.Id,catalog.ResolveResource(n.Kind),n.Position);
            foreach(var camp in b.Camps)if(camp.Alive&&b.CanSeePosition(team,camp.Position))Put(view,1,camp.Id,catalog.ResolveWilderness(camp.Kind),camp.Position);
            foreach(var drop in b.Drops)if(b.CanSeePosition(team,drop.Position))Put(view,2,drop.Id,catalog.fieldPickup,drop.Position);
            foreach(var drop in b.RelicDrops)if(b.CanSeePosition(team,drop.Position))Put(view,3,drop.Id,catalog.relicPickup,drop.Position);
            removed.Clear();foreach(var pair in objects)if(!seen.Contains(pair.Key)){if(pair.Value)Destroy(pair.Value);removed.Add(pair.Key);}
            foreach(var key in removed)objects.Remove(key);
        }
        private void OnDestroy(){ResetObjects();}
    }
}
