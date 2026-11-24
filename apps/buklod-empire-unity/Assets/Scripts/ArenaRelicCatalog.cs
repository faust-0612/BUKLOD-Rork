using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
namespace Buklod.Empire {
    public struct ArenaRelicStats {
        public float Attack,ShieldMax,Block,Hp,Mitigation,Speed,Mana,Regen,Cooldown;
        public void Add(ArenaRelicStats x){Attack+=x.Attack;ShieldMax+=x.ShieldMax;Block+=x.Block;Hp+=x.Hp;Mitigation+=x.Mitigation;Speed+=x.Speed;Mana+=x.Mana;Regen+=x.Regen;Cooldown+=x.Cooldown;}
    }
    public sealed class ArenaRelicDefinition {
        public readonly string Id,Hero,Slot,Name,SourceKey;
        public readonly int Tier,SourceLevel;public readonly float Amount;public readonly bool Consumable;
        public readonly ArenaRelicStats Stats;
        internal ArenaRelicDefinition(string id,string hero,string slot,string name,string source,int level,int tier,bool consumable,ArenaRelicStats stats,float amount=0){
            Id=id;Hero=hero;Slot=slot;Name=name;SourceKey=source;SourceLevel=level;Tier=tier;Consumable=consumable;Stats=stats;Amount=amount;
        }
    }
    public sealed class ArenaRelicDrop {
        public readonly int Id;public readonly ArenaRelicDefinition Item;public readonly Vector2 Position;public readonly float SpawnedAt;
        internal ArenaRelicDrop(int id,ArenaRelicDefinition item,Vector2 position,float now){Id=id;Item=item;Position=position;SpawnedAt=now;}
    }
    // Exact canonical names/IDs/levels and base stats from arena-v2-armory.mjs at 700eb3961de0927fecb15eaf264b9a9247bb9cdd.
    // Match-only adaptation: 13 x 5 slots x 4 tiers + 13 x 2 consumables x 4 tiers.
    public static class ArenaRelicCatalog {
        public const int GroundLimit=12;public const float Lifetime=55,Radius=3;
        private static readonly string[] slots={"weapon","shield","armor","boots","jewel"};
        private static readonly string[] types={"health","mana"};
        private static readonly int[] levels={1,3,7,10,20};
        private static readonly Dictionary<string,string[]> names=new Dictionary<string,string[]>(StringComparer.Ordinal){
            {"phan",new[]{"Hand-Forged Farm Hoe","Student Study Lamp","Intern Badge Scanner","Team Lead Whiteboard Marker Set","CEO Boardroom Gavel"}},
            {"quin",new[]{"First Camera Toy Viewfinder","Student Compact Camera","Explorer Hiking Compass","Travel Planner Route Stylus","Tourism Empire Command Desk"}},
            {"van",new[]{"Joy Tambourine","Student Pocket Bible","Church Worker Service Clipboard","Ministry Worker Counseling Pen Set","Global Mission Command Briefcase"}},
            {"christian",new[]{"Student Debate Timer","Youth Leader Facilitation Cards","Intern Document Scanner","Team Leader Radio Set","Popular Politician Legacy Podium Seal"}},
            {"lhen",new[]{"Fuel Pump Key Ring","Cashier Receipt Printer Roll Set","Church Youth Activity Bag","College Study Lamp","Global Educator Command Desk Seal"}},
            {"ace",new[]{"Pocket First-Aid Pouch","Travel Chess Clock","Chess Competitor Magnetic Board","Junior Nurse BP Cuff","Legacy Care Champion Desk Seal"}},
            {"ellusur",new[]{"Little Learner Colored Pencil Set","Student Helper Eraser Set","Farm Helper Hand Hoe","Teacher-in-Service Lesson Pointer","Legacy Shepherd Crook Staff"}},
            {"jawo",new[]{"First Practice Guitar Pick","Student Musician Tuner","Guitar Learner Practice Amp Cable","Music Team Member In-Ear Pack","Purposeful Leader Command Briefcase"}},
            {"mitch",new[]{"Little Dreamer Watercolor Set","Art Helper Brush Roll","Creative Mentor Critique Pointer","Tribal Educator Bead Loom","Legacy Art Mentor Master Brush Chest Tools"}},
            {"niel",new[]{"Young Singer Karaoke Mic","Youth Helper Activity Bag","Student Mentor Facilitation Cards","Youth Pastor Visit Care Bag","Legacy Disciple-Maker Desk Seal"}},
            {"angel",new[]{"Little Helper Coin Counter","Student Organizer Color Tabs","Budget Assistant USB Ledger Drive","Finance Coordinator Tablet","Legacy Steward Desk Seal"}},
            {"vhen",new[]{"Seed Kit Hand Trowel","Student Worker Tool Belt","Community Helper Clipboard","Harvest Organizer Crate Dolly","Legacy Builder Command Desk Seal"}},
            {"trudice",new[]{"Classroom Craft Kit","Sunday School Helper Activity Bag","Student Mentor Facilitation Cards","Classroom Teacher Lesson Tablet","Legacy Teacher Desk Seal"}},
        };
        private static readonly Dictionary<string,string[]> consumables=new Dictionary<string,string[]>(StringComparer.Ordinal){
            {"phan",new[]{"First Harvest Rice Basket","Passing Grade Certificate Frame"}},
            {"quin",new[]{"First Village Fair Ribbon","Student Field Trip Pass"}},
            {"van",new[]{"First Joy Service Ribbon","Student Chapel Award"}},
            {"christian",new[]{"Student Honor Roll Frame","Youth Leader Camp Leadership Medal"}},
            {"lhen",new[]{"First Perfect Shift Star","Cashier Accuracy Award"}},
            {"ace",new[]{"School Helper Armband","Chess Beginner First Win Ribbon"}},
            {"ellusur",new[]{"Little Learner First Verse Seal","Student Helper Appreciation Star"}},
            {"jawo",new[]{"Seedling Starter Kit","Student Musician Recital Ribbon"}},
            {"mitch",new[]{"Little Dreamer First Drawing Frame","Art Helper Appreciation Star"}},
            {"niel",new[]{"Young Singer First Solo Frame","Youth Helper Appreciation Medal"}},
            {"angel",new[]{"Little Helper First Errand Star","Student Organizer Class Award"}},
            {"vhen",new[]{"Harvest Basket First Yield","Student Worker Perfect Shift Star"}},
            {"trudice",new[]{"Children Helper Ribbon","Sunday School Helper Appreciation Star"}},
        };
        private static float Scale(float value,int tier)=>(float)Math.Round((double)value*(1+(tier-1)*.24),4,MidpointRounding.AwayFromZero);
        private static ArenaRelicStats Stats(string slot,int tier){
            var x=new ArenaRelicStats();
            switch(slot){
                case "weapon":x.Attack=Scale(5,tier);break;
                case "shield":x.ShieldMax=Scale(18,tier);x.Block=Scale(.035f,tier);break;
                case "armor":x.Hp=Scale(20,tier);x.Mitigation=Scale(.035f,tier);break;
                case "boots":x.Speed=Scale(.07f,tier);break;
                case "jewel":x.Mana=Scale(24,tier);x.Regen=Scale(.7f,tier);x.Cooldown=Scale(.04f,tier);break;
            }return x;
        }
        private static ArenaRelicDefinition[] Create(){
            var list=new List<ArenaRelicDefinition>();
            foreach(var hero in HeroKitCatalog.All.Select(h=>h.Id)){
                for(int i=0;i<slots.Length;i++)for(int t=1;t<=4;t++){
                    int lv=levels[i];string slot=slots[i];
                    list.Add(new ArenaRelicDefinition(hero+"-"+slot+"-t"+t,hero,slot,names[hero][i],hero+":L"+lv.ToString("00")+":I03",lv,t,false,Stats(slot,t)));
                }
                for(int i=0;i<types.Length;i++)for(int t=1;t<=4;t++){
                    int lv=i==0?1:3;string type=types[i];
                    list.Add(new ArenaRelicDefinition(hero+"-consumable-"+type+"-t"+t,hero,type,consumables[hero][i],hero+":L"+lv.ToString("00")+":I04",lv,t,true,default,(i==0?36:39)+12*(t-1)));
                }
            }return list.ToArray();
        }
        private static readonly ArenaRelicDefinition[] items=Create();
        private static readonly Dictionary<string,ArenaRelicDefinition> index=items.ToDictionary(x=>x.Id,StringComparer.Ordinal);
        public static IReadOnlyList<ArenaRelicDefinition> All {get;}=Array.AsReadOnly(items);
        public static bool TryGet(string id,out ArenaRelicDefinition item){item=null;return id!=null&&index.TryGetValue(id,out item);}
        public static int DropTier(int level,float quality,bool hunt,bool behind){
            float score=Mathf.Clamp01(quality)+(behind?.11f:0);return hunt&&level>=12&&score>.72f?4:level>=9&&score>.61f?3:level>=5&&score>.34f?2:1;
        }
        internal static ArenaRelicDefinition Roll(string hero,int level,float quality,string source,bool hunt,bool behind,Func<double> random){
            if(!names.ContainsKey(hero))return null;
            double chance=Math.Max(.1,Math.Min(.81,(source=="boss"?.65:source=="buff"?.17:.1)+quality*(source=="boss"?.16:.08)+(behind?.03:0)));
            if(random()>chance)return null;
            int tier=DropTier(level,quality,hunt,behind);bool consume=random()<.27;
            int max=level>=12?4:level>=9?3:level>=6?2:level>=3?1:0;
            string id=consume?hero+"-consumable-"+types[Math.Min(1,(int)(random()*2))]+"-t"+tier:hero+"-"+slots[Math.Min(max,(int)(random()*(max+1))) ]+"-t"+tier;
            return index[id];
        }
    }
}
