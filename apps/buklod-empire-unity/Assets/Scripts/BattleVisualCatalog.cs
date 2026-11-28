using System;
using System.Collections.Generic;
using UnityEngine;
namespace Buklod.Empire {
    [CreateAssetMenu(menuName="BUKLOD Empire/Visual Catalog")]
    public sealed class BattleVisualCatalog:ScriptableObject {
        [Serializable] public sealed class HeroVisual {public string id;public GameObject prefab;}
        [Serializable] public sealed class VillagerVisual {public string id;public GameObject prefab;}
        [Serializable] public sealed class FactionVisual {public ArenaTeam team;public GameObject tower,core,depot,guardPost,farm,barracks,market,house;public GameObject[] minions=new GameObject[5];public VillagerVisual[] villagers=new VillagerVisual[6];}
        [Serializable] public sealed class WildernessVisual {public WildernessKind kind;public GameObject prefab;}
        [Serializable] public sealed class ResourceVisual {public VillageResourceKind kind;public GameObject prefab;}
        public WildernessVisual[] wilderness;
        public ResourceVisual[] resources;
        public GameObject fieldPickup,relicPickup;
        public GameObject jungleDemon,jungleSnake;
        public GameObject genesisRift;
        public HeroVisual[] heroes;
        public FactionVisual[] factions;
        [Serializable] public sealed class StructureCollapseVisual {public GameObject source,collapse;}
        public StructureCollapseVisual[] structureCollapses;
        internal GameObject ResolveStructureCollapse(GameObject source){
            if(!source||structureCollapses==null)return null;
            foreach(var row in structureCollapses)if(row!=null&&row.source==source)return row.collapse;
            return null;
        }
        public TextAsset provenanceReceipt;
        [Serializable] private sealed class Provenance {public bool rightsVerified,originalArtReviewed;public string evidence;}
        public GameObject Resolve(BattleUnit unit,bool reviewOnly=false){
            if(unit.Kind==BattleTargetKind.Hero){foreach(var h in heroes)if(h.id==unit.State.Kit.Id)return h.prefab;}
            else foreach(var f in factions)if(f.team==unit.Team){
                if(unit.Kind==BattleTargetKind.Structure){
                    if(unit.Core)return f.core;
                    GameObject prefab=unit.IsDepot?f.depot:unit.IsGuardPost?f.guardPost:unit.IsFarm?f.farm:unit.IsBarracks?f.barracks:unit.IsMarket?f.market:unit.IsHouse?f.house:f.tower;
                    if(prefab)return prefab;
#if UNITY_EDITOR
                    if(reviewOnly)return f.tower;
#endif
                    throw new InvalidOperationException("Missing approved structure prefab for unit "+unit.Id);
                }
                if(unit.Kind==BattleTargetKind.Villager){foreach(var v in f.villagers)if(v.id==unit.Villager.VisualId)return v.prefab;break;}
                if(unit.PaidMinion&&unit.RecruitedCreature.HasValue){var creature=ResolveCamp(unit.RecruitedCreature.Value);if(creature)return creature;throw new InvalidOperationException("Missing recruited creature prefab: "+unit.RecruitedCreature.Value);}
                return f.minions[(int)unit.Role];
            }
            throw new InvalidOperationException("Missing visual for unit "+unit.Id);
        }
        public GameObject ResolveCamp(WildernessKind kind){if(wilderness!=null)foreach(var e in wilderness)if(e!=null&&e.kind==kind)return e.prefab;return null;}
        public GameObject ResolveResource(VillageResourceKind kind){if(resources!=null)foreach(var e in resources)if(e!=null&&e.kind==kind)return e.prefab;return null;}
        public void Validate(){
            if(!provenanceReceipt)throw new InvalidOperationException("Production provenance is mandatory.");
            var receipt=JsonUtility.FromJson<Provenance>(provenanceReceipt.text);
            if(receipt==null||!receipt.rightsVerified||!receipt.originalArtReviewed||string.IsNullOrWhiteSpace(receipt.evidence))throw new InvalidOperationException("Verified rights and original-art review evidence are required; do not mark pending assets as approved.");
            ValidateStructure();ValidateHybridAssets();
        }
        private void ValidateHybridAssets(){
            foreach(var faction in factions){
                var models=new[]{faction.tower,faction.core,faction.depot,faction.guardPost,faction.farm,faction.barracks,faction.market,faction.house};
                var unique=new HashSet<GameObject>();foreach(var model in models)if(!model||!unique.Add(model))throw new InvalidOperationException("Eight distinct approved building prefabs required for "+faction.team);
            }
            var camps=new HashSet<WildernessKind>();var campModels=new HashSet<GameObject>();
            if(wilderness!=null)foreach(var e in wilderness)if(e==null||!Enum.IsDefined(typeof(WildernessKind),e.kind)||!e.prefab||!camps.Add(e.kind)||!campModels.Add(e.prefab))throw new InvalidOperationException("Invalid or duplicate wilderness model.");
            if(camps.Count!=Enum.GetValues(typeof(WildernessKind)).Length)throw new InvalidOperationException("All nine approved wilderness creature models are required.");
            var nodes=new HashSet<VillageResourceKind>();var nodeModels=new HashSet<GameObject>();
            if(resources!=null)foreach(var e in resources)if(e==null||!Enum.IsDefined(typeof(VillageResourceKind),e.kind)||!e.prefab||!nodes.Add(e.kind)||!nodeModels.Add(e.prefab))throw new InvalidOperationException("Invalid or duplicate resource model.");
            if(nodes.Count!=Enum.GetValues(typeof(VillageResourceKind)).Length)throw new InvalidOperationException("All five approved resource node models are required.");
            if(!fieldPickup||!relicPickup||fieldPickup==relicPickup)throw new InvalidOperationException("Distinct approved field and relic pickup models required.");
        }
#if UNITY_EDITOR
        public void ValidateEditorReview(){ValidateStructure();}
#endif
#if UNITY_EDITOR || BUKLOD_OFFLINE_REVIEW
        // Explicitly unapproved test assets; only the isolated package can use this path.
        public void ValidateOfflineReview(){
            if(provenanceReceipt)throw new InvalidOperationException("Offline test catalog must not assert production provenance.");
            ValidateStructure(true);ValidateHybridAssets();
        }
#endif
        internal static bool HasHeroParameters(AnimatorControllerParameter[] source){
            if(source==null)return false;
            var parameters=new Dictionary<string,AnimatorControllerParameterType>();
            foreach(var parameter in source)parameters[parameter.name]=parameter.type;
            if(!parameters.TryGetValue("Speed",out var speed)||speed!=AnimatorControllerParameterType.Float)return false;
            foreach(var action in new[]{"Attack","Primary","Secondary","Ultimate"})
                if(!parameters.TryGetValue(action,out var type)||type!=AnimatorControllerParameterType.Trigger)return false;
            return true;
        }
        internal static void ValidateHeroParameters(AnimatorControllerParameter[] source,string id){
            var parameters=new Dictionary<string,AnimatorControllerParameterType>();
            foreach(var parameter in source)parameters[parameter.name]=parameter.type;
            if(!parameters.TryGetValue("Speed",out var speed)||speed!=AnimatorControllerParameterType.Float)throw new InvalidOperationException("Missing Speed float: "+id);
            foreach(var action in new[]{"Attack","Primary","Secondary","Ultimate"})if(!parameters.TryGetValue(action,out var type)||type!=AnimatorControllerParameterType.Trigger)throw new InvalidOperationException("Missing animation trigger "+action+": "+id);
        }
        private void ValidateStructure(bool offlineReview=false){
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
                // Android prefab assets have no initialized Animator playable graph.
                // Authoring validates the controller asset, while isolated player builds
                // validate each instantiated hero in BattleView before using its parameters.
#if UNITY_EDITOR
                RuntimeAnimatorController controller=rig.runtimeAnimatorController;
                while(controller is AnimatorOverrideController over)controller=over.runtimeAnimatorController;
                if(controller is UnityEditor.Animations.AnimatorController authored)
                    ValidateHeroParameters(authored.parameters,h.id);
                else ValidateHeroParameters(rig.parameters,h.id);
#else
                // Runtime prefab Animator graphs are not initialized until an instance exists.
                // The editor/build guard validates the authored controller asset for every hero.
#endif
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
