using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
namespace Buklod.Empire {
    // Immutable client hints; authoritative wallet and match service decide transactions.
    public static class ArenaStoneRules {
        public const int RecipeCost=2,UniversalCost=3,MaxCountersPerPlayer=1;
        public const float CounterDuration=4f,CounterReduction=.2f,CounterRange=12f;
        public const string CounterBuff="sacred_counter";
        private static readonly string[] Heroes={"phan","quin","van","christian","lhen","ace","ellusur","jawo","mitch","niel","angel","vhen","trudice"};
        private static readonly string[] Effects={"barrier","mobility","shield","rally","heal","heal","support","mobility","construct","burst","shield","construct","control"};
        public static string[] Ingredients(string output){
            int i=Array.IndexOf(Heroes,output);
            if(i<0)return Array.Empty<string>();
            return new[]{Heroes[(i+12)%13],Heroes[(i+1)%13]};
        }
        public static string RecipeOutput(string first,string second){
            foreach(var h in Heroes){var r=Ingredients(h);if((r[0]==first&&r[1]==second)||(r[1]==first&&r[0]==second))return h;}
            return null;
        }
        public static bool CanConvert(string output,IReadOnlyList<string> input,IReadOnlyDictionary<string,long> balance,bool universal){
            if(Array.IndexOf(Heroes,output)<0||input==null||balance==null||input.Count!=(universal?3:2)||
               input.Any(h=>Array.IndexOf(Heroes,h)<0||h==output))return false;
            if(!universal&&RecipeOutput(input[0],input[1])!=output)return false;
            return input.GroupBy(h=>h).All(g=>balance.TryGetValue(g.Key,out long count)&&count>=g.Count());
        }
        public static long RecipeCapacity(string hero,IReadOnlyDictionary<string,long> balance){
            var r=Ingredients(hero);
            if(r.Length!=2||balance==null||!balance.TryGetValue(r[0],out long a)||!balance.TryGetValue(r[1],out long b))return 0;
            return Math.Max(0,Math.Min(a,b));
        }
        public static bool CanCounter(string stoneHero,string enemyHero,bool opposing,bool alive,bool active,bool ranked,int used,float distance,bool alreadyCountered){
            return Array.IndexOf(Heroes,stoneHero)>=0&&stoneHero==enemyHero&&opposing&&alive&&active&&!ranked&&
                used==0&&distance>=0&&distance<=CounterRange&&!alreadyCountered;
        }
        // Final draft swap is mutual consent, before wallet reservation only.
        public static bool CanDraftSwap(string firstHero,string secondHero,bool sameTeam,bool firstConsent,bool secondConsent,
            bool draftOpen,IReadOnlyDictionary<string,long> firstWallet,IReadOnlyDictionary<string,long> secondWallet,
            bool firstTargetBanned,bool secondTargetBanned){
            return sameTeam&&firstConsent&&secondConsent&&draftOpen&&firstHero!=secondHero&&
                StoneEconomy.CanSelect(secondHero,firstWallet,false,firstTargetBanned)&&
                StoneEconomy.CanSelect(firstHero,secondWallet,false,secondTargetBanned);
        }
        // Advice only; no stat or damage multiplier.
        public static IReadOnlyList<string> TeamSynergies(IEnumerable<string> lineup){
            var selected=new HashSet<string>(lineup??Array.Empty<string>(),StringComparer.Ordinal);
            var groups=new[]{new[]{"phan","van","christian"},new[]{"quin","mitch","niel"},
                new[]{"ace","lhen","vhen"},new[]{"jawo","ellusur","trudice"},new[]{"angel","phan","ace"}};
            var names=new[]{"Frontline control","Offensive pressure","Sustain and support","Battlefield control","Protection and survival"};
            return Array.AsReadOnly(groups.Select((g,i)=>new{g,i}).Where(x=>x.g.All(selected.Contains)).Select(x=>names[x.i]).ToArray());
        }
        public static string CounterEffect(string hero){int i=Array.IndexOf(Heroes,hero);return i<0?null:Effects[i];}
        public static float Scale(SkillActor actor,string category,float now){
            return actor!=null&&actor.Buff(CounterBuff,now)>0&&CounterEffect(actor.Kit?.Id)==category?1-CounterReduction:1f;
        }
    }
}
