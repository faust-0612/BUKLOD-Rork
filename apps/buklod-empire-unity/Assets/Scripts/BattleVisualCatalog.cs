using System;
using System.Collections.Generic;
using UnityEngine;
namespace Buklod.Empire {
    [CreateAssetMenu(menuName="BUKLOD Empire/Visual Catalog")]
    public sealed class BattleVisualCatalog:ScriptableObject {
        [Serializable] public sealed class HeroVisual {public string id;public GameObject prefab;}
        [Serializable] public sealed class FactionVisual {public ArenaTeam team;public GameObject tower,core;public GameObject[] minions=new GameObject[5];}
        public GameObject genesisRift;
        public HeroVisual[] heroes;
        public FactionVisual[] factions;
        public TextAsset provenanceReceipt;
        public GameObject Resolve(BattleUnit unit){
            if(unit.Kind==BattleTargetKind.Hero){foreach(var h in heroes)if(h.id==unit.State.Kit.Id)return h.prefab;}
            else foreach(var f in factions)if(f.team==unit.Team){
                if(unit.Kind==BattleTargetKind.Structure)return unit.Core?f.core:f.tower;
                return f.minions[(int)unit.Role];
            }
            throw new InvalidOperationException("Missing visual for unit "+unit.Id);
        }
        public void Validate(){
            if(!genesisRift||!provenanceReceipt||heroes==null||factions==null)throw new InvalidOperationException("Production map, hero/faction catalog and provenance are mandatory.");
            var ids=new HashSet<string>();var meshes=new HashSet<Mesh>();
            foreach(var h in heroes){
                if(h==null||!h.prefab||!ids.Add(h.id))throw new InvalidOperationException("Missing or duplicate hero prefab.");
                HeroKitCatalog.Get(h.id);
                var rig=h.prefab.GetComponentInChildren<Animator>(true);
                var skin=h.prefab.GetComponentInChildren<SkinnedMeshRenderer>(true);
                if(!rig||!rig.runtimeAnimatorController||!skin||!skin.sharedMesh||!meshes.Add(skin.sharedMesh))throw new InvalidOperationException("Unique rigged hero mesh and Animator required: "+h.id);
            }
            if(ids.Count!=HeroKitCatalog.All.Count)throw new InvalidOperationException("All 13 original heroes are required.");
            var teams=new HashSet<ArenaTeam>();
            foreach(var f in factions){
                if(f==null||!teams.Add(f.team)||!f.tower||!f.core||f.minions==null||f.minions.Length!=5)throw new InvalidOperationException("Incomplete faction visual catalog.");
                foreach(var minion in f.minions)if(!minion)throw new InvalidOperationException("Missing faction minion prefab.");
            }
            if(!teams.Contains(ArenaTeam.Lux)||!teams.Contains(ArenaTeam.Tenebra)||teams.Count!=2)throw new InvalidOperationException("Both factions are required.");
        }
    }
}
