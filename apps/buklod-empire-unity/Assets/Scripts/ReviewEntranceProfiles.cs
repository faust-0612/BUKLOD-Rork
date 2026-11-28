using System;
namespace Buklod.Empire {
    public static class ReviewEntranceProfiles {
        // Original per-hero canonical motion selection; these are existing authored clips,
        // not separately captured or newly hand-animated performances.
        public static string Motion(string id){
            switch(id){
                case "phan":case "van":case "christian":case "ellusur":return "Victory";
                case "quin":case "jawo":case "niel":case "vhen":return "Primary";
                case "lhen":case "mitch":case "angel":return "Secondary";
                case "ace":case "trudice":return "Ultimate";
                default:throw new ArgumentException("Unknown hero");
            }
        }
    }
}
