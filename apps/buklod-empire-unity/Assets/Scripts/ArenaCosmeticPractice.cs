namespace Buklod.Empire {
    // Presentation whitelist only; never grants ownership, entitlement or match rewards.
    public static class ArenaCosmeticPractice {
        public static bool IsSkinStyle(string style)=>style=="original"||style=="radiant"||style=="nightwatch"||style=="legendary"||style=="mythical";
        public static bool IsSupported(ArenaOffer offer)=>offer!=null&&offer.Kind==ArenaOfferKind.HeroSkin&&IsSkinStyle(offer.Style)&&SacredStoneCatalog.TryGet(offer.Subject,out _);
    }
}
