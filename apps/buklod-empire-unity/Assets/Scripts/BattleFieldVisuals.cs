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
        private MaterialPropertyBlock block;
        private readonly Dictionary<(int,int),Color> appliedTints=new Dictionary<(int,int),Color>();
        private bool review;
        private readonly Dictionary<(int,int),TextMesh> lootLabels=new Dictionary<(int,int),TextMesh>();
        private BattleEffects battleEffects;
        private ReviewPresentationAudio presentationAudio;
        private WorldInteractionEffects worldEffects;
        private readonly Dictionary<int,(int hit,int attack,int defeat)> campHistory=new Dictionary<int,(int,int,int)>();
        private readonly Dictionary<int,int> hazardAttackHistory=new Dictionary<int,int>();
        private readonly Dictionary<int,Animator> campAnimators=new Dictionary<int,Animator>();
        private readonly Dictionary<int,float> campDeathUntil=new Dictionary<int,float>();
        private int pooled;
        private const int PoolLimit=48;
        public int ActiveCount=>active.Count;
        public void Bind(BattleView owner){Clear();view=owner;bound=owner.Battle;review=owner.IsEditorReview;battleEffects=owner.GetComponent<BattleEffects>();presentationAudio=review?owner.GetComponent<ReviewPresentationAudio>():null;worldEffects=owner.GetComponent<WorldInteractionEffects>();}
        private GameObject Present(int type,int id,Vector2 position,GameObject prefab,out bool fresh){
            fresh=false;if(!prefab)return null;
            var key=(type,id);seen.Add(key);
            if(active.TryGetValue(key,out var go)&&(!go||prefabs[key]!=prefab)){
                Return(key,go);active.Remove(key);prefabs.Remove(key);appliedTints.Remove(key);go=null;
            }
            if(!go){
                if(pools.TryGetValue(prefab,out var pool)&&pool.Count>0){go=pool.Pop();pooled--;}
                else go=Instantiate(prefab,transform);
                if(review){
                    foreach(var collider in go.GetComponentsInChildren<Collider>(true))collider.enabled=false;
                    go.transform.localScale=prefab.transform.localScale;
                    go.transform.localRotation=prefab.transform.localRotation;
                    // Rental state is never inherited by the next review entity.
                    foreach(var renderer in go.GetComponentsInChildren<Renderer>(true)){
                        renderer.SetPropertyBlock(null);
                        for(int i=0;i<renderer.sharedMaterials.Length;i++)renderer.SetPropertyBlock(null,i);
                    }
                }
                go.transform.position=view.FieldPosition(position);go.SetActive(true);active.Add(key,go);prefabs.Add(key,prefab);fresh=true;
                if(review)foreach(var animator in go.GetComponentsInChildren<Animator>(true))animator.Rebind();
            }
            return go;
        }
        private bool Nearby(Vector2 position)=>Vector2.Distance(position,bound.Player.Position)<=42;
        private bool Visible(Vector2 position)=>Nearby(position)&&bound.IsPositionVisibleTo(bound.Player.Team,position);
        public static float StockScale(double stock,double capacity)=>capacity<=0?.15f:Mathf.Lerp(.15f,1,Mathf.Sqrt(Mathf.Clamp01((float)(stock/capacity))));
        public static Color TierColor(int tier)=>tier>=4?new Color(1,.68f,.16f):tier==3?new Color(.72f,.30f,1):tier==2?new Color(.20f,.70f,1):new Color(.76f,.88f,.79f);
        public static Color ResourceColor(VillageResourceKind kind){
            switch(kind){case VillageResourceKind.Wood:return new Color(.55f,.31f,.13f);case VillageResourceKind.Stone:return new Color(.55f,.59f,.64f);case VillageResourceKind.Crystal:return new Color(.24f,.73f,1);case VillageResourceKind.Gold:return new Color(1,.72f,.18f);default:return new Color(.38f,.79f,.24f);}
        }
        private void Tint((int,int) key,GameObject go,Color color){
            if(appliedTints.TryGetValue(key,out var old)&&old==color)return;
            appliedTints[key]=color;
            if(block==null)block=new MaterialPropertyBlock();
            foreach(var renderer in go.GetComponentsInChildren<Renderer>(true)){
                var materials=renderer.sharedMaterials;
                for(int i=0;i<materials.Length;i++){
                    var mat=materials[i];if(!mat||!mat.name.StartsWith("crystal",StringComparison.OrdinalIgnoreCase))continue;
                    renderer.GetPropertyBlock(block,i);
                    if(mat.HasProperty("_BaseColor"))block.SetColor("_BaseColor",color);
                    if(mat.HasProperty("_BaseColorFactor"))block.SetColor("_BaseColorFactor",color);
                    if(mat.HasProperty("_EmissionColor"))block.SetColor("_EmissionColor",color*.45f);
                    if(mat.HasProperty("_EmissiveFactor"))block.SetColor("_EmissiveFactor",color*.45f);
                    renderer.SetPropertyBlock(block,i);block.Clear();
                }
            }
        }
        private void Loot(int type,int id,Vector2 position,GameObject prefab,int tier,float spawnedAt,string itemName){
            var go=Present(type,id,position,prefab,out var fresh);if(!go)return;
            if(fresh&&battleEffects&&bound.Time-spawnedAt<.6f)battleEffects.Emit(view.FieldPosition(position),TierColor(tier),tier>=3?2:1);
            Tint((type,id),go,TierColor(tier));
            float t=Mathf.Max(0,bound.Time-spawnedAt);
            go.transform.localScale=prefab.transform.localScale*1.25f;
            go.transform.position=view.FieldPosition(position)+Vector3.up*(.35f+.16f*Mathf.Sin(t*3+id));
            go.transform.rotation=Quaternion.Euler(0,t*72,0)*prefab.transform.rotation;
            var key=(type,id);if(!lootLabels.TryGetValue(key,out var label)||!label){var marker=new GameObject("Loot label "+id);marker.transform.SetParent(transform,false);label=marker.AddComponent<TextMesh>();label.font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");label.GetComponent<MeshRenderer>().sharedMaterial=label.font.material;label.anchor=TextAnchor.MiddleCenter;label.alignment=TextAlignment.Center;label.fontSize=48;label.characterSize=.046f;label.text="T"+tier+" • "+itemName;label.color=TierColor(tier);lootLabels[key]=label;}
            label.gameObject.SetActive(Vector2.Distance(position,bound.Player.Position)<=22);label.transform.position=view.FieldPosition(position)+Vector3.up*1.7f;if(view.battleCamera)label.transform.rotation=view.battleCamera.transform.rotation;
        }
        private GameObject ConstructionPrefab(ArenaTeam team,VillageBuildOrder kind){
            foreach(var f in view.visuals.factions)if(f.team==team){
                switch(kind){case VillageBuildOrder.Depot:return f.depot;case VillageBuildOrder.GuardPost:return f.guardPost;case VillageBuildOrder.Farm:return f.farm;case VillageBuildOrder.Barracks:return f.barracks;case VillageBuildOrder.Market:return f.market;case VillageBuildOrder.House:return f.house;}
            }
            return null;
        }
        static Color CampTint(WildernessKind kind){
            switch(kind){
                case WildernessKind.AzureStag:return new Color(.24f,.65f,1);
                case WildernessKind.CrimsonWolf:return new Color(1,.21f,.24f);
                case WildernessKind.EmeraldSerpent:return new Color(.27f,.88f,.45f);
                case WildernessKind.GoldenScarab:return new Color(1,.72f,.18f);
                case WildernessKind.StoneGolem:return new Color(.63f,.68f,.74f);
                case WildernessKind.RiverSpirit:return new Color(.25f,.86f,.91f);
                case WildernessKind.WindFalcon:return new Color(.64f,.81f,1);
                case WildernessKind.AncientSentinel:return new Color(1,.79f,.37f);
                default:return new Color(.71f,.29f,1);
            }
        }
        private void Camp(WildernessCamp c){
            bool visible=Visible(c.Position),wasSeen=campHistory.TryGetValue(c.Id,out var prior);
            var key=(1,c.Id);
            if(c.Alive&&visible){
                var go=Present(1,c.Id,c.Position,view.visuals.ResolveCamp(c.Kind),out var fresh);
                if(!review||!go)return;
                if(fresh)campAnimators[c.Id]=go.GetComponentInChildren<Animator>(true);
                if(!fresh&&wasSeen&&c.AttackSequence>prior.attack){
                    if(presentationAudio)presentationAudio.Creature(c.Kind,false,go.transform.position);
                    Vector2 delta=c.LastAttackPosition-c.Position;
                    if(delta.sqrMagnitude>.001f)go.transform.rotation=Quaternion.LookRotation(new Vector3(delta.x,0,delta.y));
                    if(campAnimators.TryGetValue(c.Id,out var animator)&&animator)animator.SetTrigger("Attack");
                    if(battleEffects){
                        var forward=go.transform.forward;
                        var cue=new SkillCue("neutral_"+c.Kind, c.Boss?SkillCueShape.Impact:SkillCueShape.Surge,c.Boss?4.2f:1.8f,c.Boss?.65f:.35f,-1);
                        battleEffects.EmitSkill(go.transform.position,CampTint(c.Kind),cue,forward);
                    }
                }else if(!fresh&&wasSeen&&c.HitSequence>prior.hit){
                    if(campAnimators.TryGetValue(c.Id,out var animator)&&animator)animator.SetTrigger("Hit");
                }
            }else if(review&&visible&&wasSeen&&c.DefeatSequence>prior.defeat&&active.TryGetValue(key,out var defeatedVisual)&&defeatedVisual){
                // A real defeat, not a fog transition or the reinforcement cutoff.
                if(presentationAudio)presentationAudio.Creature(c.Kind,true,defeatedVisual.transform.position);
                campDeathUntil[c.Id]=bound.Time+1.2f;
                var corpse=Present(6,c.Id,c.Position,view.visuals.ResolveCamp(c.Kind),out var newCorpse);
                if(corpse&&newCorpse){
                    corpse.transform.rotation=defeatedVisual.transform.rotation;
                    var deathAnimator=corpse.GetComponentInChildren<Animator>(true);
                    if(deathAnimator)deathAnimator.SetTrigger("Death");
                }
                if(worldEffects)worldEffects.Emit(defeatedVisual.transform.position,c.Boss?WorldImpactKind.Core:WorldImpactKind.Unit,c.Id*397+c.DefeatSequence,CampTint(c.Kind));
                if(battleEffects)battleEffects.Emit(defeatedVisual.transform.position,CampTint(c.Kind),c.Boss?3:1);
            }
            if(review&&campDeathUntil.TryGetValue(c.Id,out var until)){
                if(!visible||c.Alive||bound.Time>=until)campDeathUntil.Remove(c.Id);
                else if(active.ContainsKey((6,c.Id)))seen.Add((6,c.Id));
            }
            // Snapshot even when hidden: entering visibility never replays past combat.
            if(review)campHistory[c.Id]=(c.HitSequence,c.AttackSequence,c.DefeatSequence);
        }
        public void Refresh(){
            if(!view||view.Battle==null)return;if(bound!=view.Battle){Clear();bound=view.Battle;}
            seen.Clear();
            if(!bound.Finished){
                foreach(var n in bound.ResourceNodes)if(Nearby(n.Position)&&(review?n.StructureId==0&&(n.Stock>0||n.Renewable)&&(n.Team==bound.Player.Team||Visible(n.Position)):n.Stock>0)){
                    var prefab=view.visuals.ResolveResource(n.Kind);var go=Present(0,n.Id,n.Position,prefab,out _);
                    if(go&&review){var scale=prefab.transform.localScale;scale.y*=StockScale(n.Stock,n.Capacity);go.transform.localScale=scale;}
                }
                foreach(var c in bound.Camps)Camp(c);
                if(review&&bound.JungleHazardsActive)foreach(var hazard in bound.JungleHazards){
                    if(!Visible(hazard.Position))continue;
                    var prefab=hazard.Demon?view.visuals.jungleDemon:view.visuals.jungleSnake;
                    var go=Present(7,hazard.Id,hazard.Position,prefab,out var fresh);
                    if(!go)continue;
                    var position=view.FieldPosition(hazard.Position)+Vector3.up*(hazard.Demon?1.6f:0f);
                    var delta=position-go.transform.position;
                    delta.y=0;if(delta.sqrMagnitude>.0001f)go.transform.rotation=Quaternion.LookRotation(delta);
                    go.transform.position=position;
                    var animator=go.GetComponentInChildren<Animator>(true);
                    bool attacked=!fresh&&hazardAttackHistory.TryGetValue(hazard.Id,out int previousAttack)&&hazard.AttackSequence>previousAttack;
                    hazardAttackHistory[hazard.Id]=hazard.AttackSequence;
                    if(animator){
                        animator.SetFloat("Speed",delta.sqrMagnitude>.0001f?1f:0f);
                        if(attacked)animator.SetTrigger("Attack");
                    }
                    if(attacked&&battleEffects)battleEffects.Emit(go.transform.position,hazard.Demon?new Color(1,.2f,.35f):new Color(.45f,1,.15f),1);
                }
                foreach(var d in bound.Drops)if(Visible(d.Position)){var art=view.visuals.ResolveItem(d.Item.Effect,d.Item.Tier);Loot(2,d.Id,d.Position,art!=null&&art.prefab?art.prefab:view.visuals.fieldPickup,d.Item.Tier,d.SpawnedAt,d.Item.Name);}
                foreach(var d in bound.RelicDrops)if(Visible(d.Position)){var art=view.visuals.ResolveItem(d.Item.Slot,d.Item.Tier);Loot(3,d.Id,d.Position,art!=null&&art.prefab?art.prefab:view.visuals.relicPickup,d.Item.Tier,d.SpawnedAt,d.Item.Name);}
                if(review)foreach(var u in bound.Units){
                    if(!u.State.Alive||!Nearby(u.Position)||(u.Team!=bound.Player.Team&&!bound.IsVisibleTo(bound.Player.Team,u)))continue;
                    if(u.Villager!=null&&u.Cargo>1e-6){
                        var kind=u.CargoWood>0?VillageResourceKind.Wood:u.CargoStone>0?VillageResourceKind.Stone:u.CargoCrystal>0?VillageResourceKind.Crystal:u.CargoGold>0?VillageResourceKind.Gold:VillageResourceKind.Food;
                        var prefab=view.visuals.fieldPickup;var go=Present(4,u.Id,u.Position,prefab,out _);
                        if(go){
                            Tint((4,u.Id),go,ResourceColor(kind));
                            go.transform.position=view.FieldPosition(u.Position)+Vector3.up*2.1f;
                            go.transform.localScale=prefab.transform.localScale*Mathf.Lerp(.35f,.65f,Mathf.Clamp01((float)(u.Cargo/OfflineBattle.CargoLimit)));
                        }
                    }
                    var order=u.Construction;
                    if(order!=null&&order.Kind!=VillageBuildOrder.Repair&&Nearby(order.Position)&&(u.Team==bound.Player.Team||Visible(order.Position))){
                        var prefab=ConstructionPrefab(u.Team,order.Kind);var go=Present(5,u.Id,order.Position,prefab,out _);
                        if(go){var scale=prefab.transform.localScale;scale.y*=Mathf.Lerp(.10f,1,order.Completion);go.transform.localScale=scale;go.transform.position=view.FieldPosition(order.Position);
                            var key=(5,u.Id);if(!lootLabels.TryGetValue(key,out var label)||!label){var marker=new GameObject("Construction status "+u.Id);marker.transform.SetParent(transform,false);label=marker.AddComponent<TextMesh>();label.font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");label.GetComponent<MeshRenderer>().sharedMaterial=label.font.material;label.anchor=TextAnchor.MiddleCenter;label.alignment=TextAlignment.Center;label.fontSize=48;label.characterSize=.046f;lootLabels[key]=label;}
                            label.text=order.Kind.ToString()+" • "+Mathf.RoundToInt(order.Completion*100)+"%";label.color=new Color(.94f,.78f,.42f);label.transform.position=view.FieldPosition(order.Position)+Vector3.up*2.8f;if(view.battleCamera)label.transform.rotation=view.battleCamera.transform.rotation;
                        }
                    }
                }
            }
            removed.Clear();foreach(var e in active)if(!seen.Contains(e.Key)){Return(e.Key,e.Value);removed.Add(e.Key);}
            foreach(var key in removed){active.Remove(key);prefabs.Remove(key);appliedTints.Remove(key);if(key.Item1==1)campAnimators.Remove(key.Item2);}
        }
        private void Return((int,int) key,GameObject go){
            if(lootLabels.TryGetValue(key,out var label)){if(label)Destroy(label.gameObject);lootLabels.Remove(key);}
            if(!go)return;go.SetActive(false);
            if(pooled>=PoolLimit||!prefabs.TryGetValue(key,out var prefab)||!prefab){Destroy(go);return;}
            if(!pools.TryGetValue(prefab,out var pool)){pool=new Stack<GameObject>();pools.Add(prefab,pool);}pool.Push(go);pooled++;
        }
        private void Clear(){
            foreach(var go in active.Values)if(go)Destroy(go);
            foreach(var pool in pools.Values)foreach(var go in pool)if(go)Destroy(go);
            foreach(var label in lootLabels.Values)if(label)Destroy(label.gameObject);lootLabels.Clear();
            active.Clear();prefabs.Clear();pools.Clear();seen.Clear();removed.Clear();appliedTints.Clear();campHistory.Clear();hazardAttackHistory.Clear();campAnimators.Clear();campDeathUntil.Clear();pooled=0;
        }
        private void OnDestroy(){Clear();}
    }
}
