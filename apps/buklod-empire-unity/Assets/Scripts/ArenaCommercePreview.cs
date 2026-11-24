using System;
using System.Collections.Generic;
using UnityEngine;
namespace Buklod.Empire {
    public enum ArenaOfferKind { Stone, HeroSkin, Weapon, Effect, Entrance, Victory, Emote, Recall, Frame, Villager, Building, Minion, Battlefield, Voice, Pass, Membership, Replay, Tournament, Bundle, Sponsorship, Marketplace }
    public sealed class ArenaOffer {
        public readonly string Id, Name, Subject, Style;
        public readonly ArenaOfferKind Kind;
        public readonly int IndicativePhp;
        public readonly Color Accent;
        public ArenaOffer(string id,string name,ArenaOfferKind kind,string subject,string style,int php,Color accent){
            Id=id;Name=name;Kind=kind;Subject=subject;Style=style;IndicativePhp=php;Accent=accent;
        }
        public bool IsBusinessInquiry=>Kind==ArenaOfferKind.Sponsorship||Style=="institutional_package";
        public bool PurchaseEnabled=>false; // Preview must never grant currency, ownership or paid access.
        public int BpCost=>Kind==ArenaOfferKind.Stone?StoneEconomy.BPPerStone:0;
    }
    public static class ArenaCommercePreview {
        public static IReadOnlyList<ArenaOffer> Build(){
            var result=new List<ArenaOffer>();
            void Add(ArenaOfferKind kind,string subject,string name,string style,int php,Color accent){
                result.Add(new ArenaOffer(kind.ToString().ToLowerInvariant()+"."+subject+"."+style,name,kind,subject,style,php,accent));
            }
            foreach(var hero in HeroKitCatalog.All){
                if(!SacredStoneCatalog.TryGet(hero.Id,out var stone))throw new InvalidOperationException("Missing stone identity");
                Add(ArenaOfferKind.Stone,hero.Id,stone.Name+" / "+hero.Name,"access",5,stone.Accent);
                Add(ArenaOfferKind.HeroSkin,hero.Id,hero.Name+" Original","original",0,stone.Accent);
                Add(ArenaOfferKind.HeroSkin,hero.Id,hero.Name+" Radiant","radiant",149,Color.Lerp(stone.Accent,Color.white,.38f));
                Add(ArenaOfferKind.HeroSkin,hero.Id,hero.Name+" Nightwatch","nightwatch",249,Color.Lerp(stone.Accent,new Color(.15f,.18f,.38f),.55f));
                Add(ArenaOfferKind.HeroSkin,hero.Id,hero.Name+" Legendary","legendary",499,stone.Accent);
                Add(ArenaOfferKind.HeroSkin,hero.Id,hero.Name+" Mythical","mythical",999,stone.Accent);
                Add(ArenaOfferKind.Bundle,hero.Id,hero.Name+" Complete Transformation","transformation",1499,stone.Accent);
                Add(ArenaOfferKind.Weapon,hero.Id,hero.Name+" Relic Finish","relic",149,stone.Accent);
                Add(ArenaOfferKind.Effect,hero.Id,hero.Name+" Signature FX","signature",199,stone.Accent);
                Add(ArenaOfferKind.Entrance,hero.Id,hero.Name+" Arrival","arrival",199,stone.Accent);
                Add(ArenaOfferKind.Victory,hero.Id,hero.Name+" Triumph","triumph",149,stone.Accent);
                Add(ArenaOfferKind.Voice,hero.Id,hero.Name+" Voice Pack","voice",149,stone.Accent);
                Add(ArenaOfferKind.Bundle,hero.Id,hero.Name+" Collector Set","collector",799,stone.Accent);
            }
            foreach(var faction in new[]{"lux","tenebra"}){
                var tint=faction=="lux"?new Color(.9f,.75f,.42f):new Color(.55f,.37f,.76f);
                Add(ArenaOfferKind.Bundle,faction,faction.ToUpperInvariant()+" Exclusive Faction Collection","exclusive",1999,tint);
                foreach(var kind in new[]{ArenaOfferKind.Villager,ArenaOfferKind.Minion,ArenaOfferKind.Building,ArenaOfferKind.Battlefield})
                    Add(kind,faction,faction.ToUpperInvariant()+" "+kind+" Collection","royal",kind==ArenaOfferKind.Battlefield?399:249,tint);
            }
            var gold=new Color(.86f,.69f,.34f);
            Add(ArenaOfferKind.Emote,"arena","Emote Collection","premium",99,gold);
            Add(ArenaOfferKind.Recall,"arena","Cinematic Recall","premium",199,gold);
            Add(ArenaOfferKind.Frame,"arena","Animated Nameplate","premium",149,gold);
            Add(ArenaOfferKind.Pass,"arena","Season Pass","seasonal",299,gold);
            Add(ArenaOfferKind.Membership,"arena","Premium Membership / month","monthly",199,gold);
            Add(ArenaOfferKind.Replay,"arena","Cinematic Replay Export","premium",99,gold);
            Add(ArenaOfferKind.Tournament,"arena","Private Event Room","institutional",499,gold);
            Add(ArenaOfferKind.Bundle,"arena","All 13 Heroes Legendary Collection","legendary_all",4999,gold);
            Add(ArenaOfferKind.Tournament,"arena","Institutional Tournament Package","institutional_package",4999,gold);
            Add(ArenaOfferKind.Sponsorship,"arena","Corporate Tournament Sponsorship","business_inquiry",10000,gold);
            Add(ArenaOfferKind.Marketplace,"arena","Stone Exchange and Trading","bp_only",0,gold);
            return result.AsReadOnly();
        }
        // Only non-transferable cosmetics may be considered for rewarded ads, never stones or BP.
        public static bool EligibleRewardedTrial(ArenaOfferKind kind)=>kind==ArenaOfferKind.HeroSkin||kind==ArenaOfferKind.Effect||kind==ArenaOfferKind.Frame||kind==ArenaOfferKind.Emote;
        public static bool CanShowAd(bool matchActive,bool transition,bool consentReady,bool cooldownReady)=>!matchActive&&transition&&consentReady&&cooldownReady;
    }
}
