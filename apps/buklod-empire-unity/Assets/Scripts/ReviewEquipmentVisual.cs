using System;
using UnityEngine;
namespace Buklod.Empire {
    // Match-local presentation only. No permanent evolution, BP, item creation or stat changes.
    public sealed class ReviewEquipmentVisual:MonoBehaviour {
        [Serializable] public sealed class Mount {
            public string slot;
            public GameObject basePlate,advancedTrim;
        }
        public Mount[] mounts;
        int[] last;
        public static int Tier(BattleUnit unit,string slot){
            if(unit==null||unit.Kind!=BattleTargetKind.Hero||unit.State.Kit==null)return 0;
            int tier=0;
            if(unit.Relics.TryGetValue(slot,out var relic)&&relic!=null&&!relic.Consumable&&relic.Hero==unit.State.Kit.Id&&relic.Slot==slot)tier=Mathf.Clamp(relic.Tier,1,4);
            bool owned=false;
            switch(slot){
                case "weapon":owned=unit.Gear.Contains("blade")||unit.Gear.Contains("sealbreaker")||unit.Gear.Contains("giantbane");break;
                case "shield":owned=unit.Gear.Contains("aegis");break;
                case "armor":owned=unit.Gear.Contains("armor")||unit.Gear.Contains("vitality");break;
                case "boots":owned=unit.Gear.Contains("boots");break;
                case "jewel":owned=unit.Gear.Contains("wisdom");break;
            }
            return Mathf.Max(tier,owned?1:0);
        }
        public void Apply(BattleUnit unit){
            if(mounts==null)return;
            if(last==null||last.Length!=mounts.Length){last=new int[mounts.Length];for(int i=0;i<last.Length;i++)last[i]=-1;}
            for(int i=0;i<mounts.Length;i++){
                var m=mounts[i];if(m==null)continue;
                int tier=Tier(unit,m.slot);if(last[i]==tier)continue;last[i]=tier;
                if(m.basePlate){m.basePlate.SetActive(tier>0);m.basePlate.transform.localScale=Vector3.one*(1+.045f*Mathf.Max(0,tier-1));}
                if(m.advancedTrim)m.advancedTrim.SetActive(tier>=3);
            }
        }
        public void ResetVisual()=>Apply(null);
    }
}
