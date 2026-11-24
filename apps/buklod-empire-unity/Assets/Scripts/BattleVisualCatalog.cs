using System;
using System.Collections.Generic;
using UnityEngine;
namespace Buklod.Empire {
    [CreateAssetMenu(menuName="BUKLOD Empire/Visual Catalog")]
    public sealed class BattleVisualCatalog:ScriptableObject {
        [Serializable] public sealed class HeroVisual {public string id;public GameObject prefab;}
        [Serializable] public sealed class VillagerVisual {public string id;public GameObject prefab;}
        [Serializable] public sealed class FactionVisual {public ArenaTeam team;public GameObject tower,core,depot,guardPost,farm,barracks,house;public GameObject[] minions=new GameObject[5];public VillagerVisual[] villagers=new VillagerVisual[6];}
        [Serializable] public sealed class ResourceVisual {public VillageResourceKind kind;public GameObject prefab;}
        [Serializable] public sealed class WildernessVisual {public WildernessKind kind;public GameObject prefab;}
        public ResourceVisual[] resources;
        public WildernessVisual[] wilderness;
        public GameObject fieldPickup,relicPickup;
        public GameObject genesisRift;
        public HeroVisual[] heroes;
        public FactionVisual[] factions;
        public TextAsset provenanceReceipt;
        [Serializable] private sealed class Provenance {public bool rightsVerified,originalArtReviewed;public string evidence;}
        public GameObject Resolve(BattleUnit unit){
            if(unit.Kind==BattleTargetKind.Hero){foreach(var h in heroes)if(h.id==unit.State.Kit.Id)return h.prefab;}
            else foreach(var f in factions)if(f.team==unit.Team){
                if(unit.Kind==BattleTargetKind.Structure){
                    if(unit.Core)return f.core;
                    if(unit.IsDepot&&f.depot)return f.depot;if(unit.IsGuardPost&&f.guardPost)return f.guardPost;
                    if(unit.IsFarm&&f.farm)return f.farm;if(unit.IsBarracks&&f.barracks)return f.barracks;if(unit.IsHouse&&f.house)return f.house;
                    return f.tower; // review-only compatibility; production validation requires every building.
                }
                if(unit.Kind==BattleTargetKind.Villager){foreach(var v in f.villagers)if(v.id==unit.Villager.VisualId)return v.prefab;break;}
                return f.minions[(int)unit.Role];
            }
            throw new InvalidOperationException("Missing visual for unit "+unit.Id);
        }
        public GameObject ResolveResource(VillageResourceKind kind){if(resources!=null)foreach(var item in resources)if(item!=null&&item.kind==kind)return item.prefab;return null;}
        public GameObject ResolveWilderness(WildernessKind kind){if(wilderness!=null)foreach(var item in wilderness)if(item!=null&&item.kind==kind)return item.prefab;return null;}
        private void ValidateHybridVisuals(){
            foreach(var f in factions){var set=new HashSet<GameObject>{f.core,f.tower,f.depot,f.guardPost,f.farm,f.barracks,f.house};if(set.Contains(null)||set.Count!=7)throw new InvalidOperationException("Seven distinct faction structure prefabs required: "+f.team);}
            var resourceKinds=new HashSet<VillageResourceKind>();var resourceModels=new HashSet<GameObject>();
            if(resources==null)throw new InvalidOperationException("Resource visuals are missing.");
            foreach(var item in resources)if(item==null||!item.prefab||!Enum.IsDefined(typeof(VillageResourceKind),item.kind)||!resourceKinds.Add(item.kind)||!resourceModels.Add(item.prefab))throw new InvalidOperationException("Invalid or duplicate resource prefab.");
            if(resourceKinds.Count!=Enum.GetValues(typeof(VillageResourceKind)).Length)throw new InvalidOperationException("All five resource types require visuals.");
            var campKinds=new HashSet<WildernessKind>();var campModels=new HashSet<GameObject>();
            if(wilderness==null)throw new InvalidOperationException("Wilderness visuals are missing.");
            foreach(var item in wilderness)if(item==null||!item.prefab||!Enum.IsDefined(typeof(WildernessKind),item.kind)||!campKinds.Add(item.kind)||!campModels.Add(item.prefab))throw new InvalidOperationException("Invalid or duplicate wilderness prefab.");
            if(campKinds.Count!=Enum.GetValues(typeof(WildernessKind)).Length)throw new InvalidOperationException("All nine wilderness creature types require visuals.");
            if(!fieldPickup||!relicPickup||fieldPickup==relicPickup)throw new InvalidOperationException("Distinct field and relic pickup prefabs are required.");
        }
        public void Validate(){
            if(!provenanceReceipt)throw new InvalidOperationException("Production provenance is mandatory.");
            var receipt=JsonUtility.FromJson<Provenance>(provenanceReceipt.text);
            if(receipt==null||!receipt.rightsVerified||!receipt.originalArtReviewed||string.IsNullOrWhiteSpace(receipt.evidence))throw new InvalidOperationException("Verified rights and original-art review evidence are required; do not mark pending assets as approved.");
            ValidateStructure();ValidateHybridVisuals();
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
