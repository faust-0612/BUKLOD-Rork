using System;
using System.Collections.Generic;
using UnityEngine;
namespace Buklod.Empire {
    [CreateAssetMenu(menuName="BUKLOD Empire/Visual Catalog")]
    public sealed class BattleVisualCatalog:ScriptableObject {
        [Serializable] public sealed class HeroVisual {public string id;public GameObject prefab;}
        [Serializable] public sealed class VillagerVisual {public string id;public GameObject prefab;}
        [Serializable] public sealed class FactionVisual {public ArenaTeam team;public GameObject tower,core,caravan;public GameObject[] minions=new GameObject[5];public VillagerVisual[] villagers=new VillagerVisual[6];}
        public GameObject genesisRift;
        public HeroVisual[] heroes;
        public FactionVisual[] factions;
        public TextAsset provenanceReceipt;
        [Serializable] private sealed class Provenance {public bool rightsVerified,originalArtReviewed;public string evidence;}
        public GameObject Resolve(BattleUnit unit){
            if(unit.Kind==BattleTargetKind.Hero){foreach(var h in heroes)if(h.id==unit.State.Kit.Id)return h.prefab;}
            else foreach(var f in factions)if(f.team==unit.Team){
                if(unit.Kind==BattleTargetKind.Structure)return unit.Core?f.core:f.tower;
                if(unit.IsCaravan){if(f.caravan)return f.caravan;
#if UNITY_EDITOR
                    string template=f.team==ArenaTeam.Lux?"lira":"velin";foreach(var v in f.villagers)if(v.id==template)return v.prefab;
#endif
                    throw new InvalidOperationException("Missing approved caravan visual for "+f.team);}
                if(unit.Kind==BattleTargetKind.Villager){foreach(var v in f.villagers)if(v.id==unit.Villager.VisualId)return v.prefab;break;}
                return f.minions[(int)unit.Role];
            }
            throw new InvalidOperationException("Missing visual for unit "+unit.Id);
        }
        public void Validate(){
            if(!provenanceReceipt)throw new InvalidOperationException("Production provenance is mandatory.");
            var receipt=JsonUtility.FromJson<Provenance>(provenanceReceipt.text);
            if(receipt==null||!receipt.rightsVerified||!receipt.originalArtReviewed||string.IsNullOrWhiteSpace(receipt.evidence))throw new InvalidOperationException("Verified rights and original-art review evidence are required; do not mark pending assets as approved.");
            ValidateStructure();
            foreach(var f in factions)if(!f.caravan||f.caravan==f.tower||f.caravan==f.core||Array.Exists(f.villagers,v=>v.prefab==f.caravan)||Array.Exists(f.minions,p=>p==f.caravan))throw new InvalidOperationException("Distinct approved caravan prefab required: "+f.team);
        }
#if UNITY_EDITOR
        // No provenance exemption exists in a player build.
        public void ValidateEditorReview(){ValidateStructure();}
#endif
        private void ValidateStructure(){
            if(!genesisRift||heroes==null||factions==null)throw new InvalidOperationException("Incomplete battle visuals.");
            var ids=new HashSet<string>();var meshes=new HashSet<Mesh>();
            foreach(var h in heroes){
                if(h==null||!h.prefab||!ids.Add(h.id))throw new InvalidOperationException("Missing or duplicate hero prefab.");
                HeroKitCatalog.Get(h.id);
                var rig=h.prefab.GetComponentInChildren<Animator>(true);
                var skin=h.prefab.GetComponentInChildren<SkinnedMeshRenderer>(true);
                if(!rig||!rig.runtimeAnimatorController||!skin||!skin.sharedMesh||!meshes.Add(skin.sharedMesh))throw new InvalidOperationException("Unique rigged hero mesh and Animator required: "+h.id);
                var motions=new HashSet<AnimationClip>();
                foreach(var clip in rig.runtimeAnimatorController.animationClips)if(clip&&clip.length>0)motions.Add(clip);
                if(motions.Count<9)throw new InvalidOperationException("Nine distinct motion clips required: "+h.id);
                foreach(var slot in new[]{"Primary","Secondary","Ultimate"}){
                    int count=0;foreach(var motion in motions)if(motion.name==slot)count++;
                    if(count!=1)throw new InvalidOperationException("Distinct named skill clip required: "+h.id+"/"+slot);
                }
                var parameters=new Dictionary<string,AnimatorControllerParameterType>();
                foreach(var parameter in rig.parameters)parameters[parameter.name]=parameter.type;
                if(!parameters.TryGetValue("Speed",out var speed)||speed!=AnimatorControllerParameterType.Float)throw new InvalidOperationException("Missing Speed float: "+h.id);
                foreach(var action in new[]{"Attack","Primary","Secondary","Ultimate"})if(!parameters.TryGetValue(action,out var type)||type!=AnimatorControllerParameterType.Trigger)throw new InvalidOperationException("Missing animation trigger "+action+": "+h.id);
            }
            if(ids.Count!=HeroKitCatalog.All.Count)throw new InvalidOperationException("All 13 original heroes are required.");
            var teams=new HashSet<ArenaTeam>();
            foreach(var f in factions){
                if(f==null||!teams.Add(f.team)||!f.tower||!f.core||f.minions==null||f.minions.Length!=5)throw new InvalidOperationException("Incomplete faction visual catalog.");
                foreach(var minion in f.minions)if(!minion)throw new InvalidOperationException("Missing faction minion prefab.");
                if(f.villagers==null||f.villagers.Length!=6)throw new InvalidOperationException("Six villagers per faction are required.");
                var expected=new HashSet<string>(f.team==ArenaTeam.Lux?new[]{"aron","lira","daren","serah","kiel","miko"}:new[]{"rogar","velin","kael","mora","zed","taro"});
                foreach(var v in f.villagers)if(v==null||!v.prefab||!expected.Remove(v.id))throw new InvalidOperationException("Missing or duplicate villager visual.");
                if(expected.Count!=0)throw new InvalidOperationException("Villager roster incomplete.");
            }
            if(!teams.Contains(ArenaTeam.Lux)||!teams.Contains(ArenaTeam.Tenebra)||teams.Count!=2)throw new InvalidOperationException("Both factions are required.");
        }
    }
}
