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
        public static int Pulse(string id){
            switch(id){
                case "phan":case "christian":case "mitch":return 3;
                case "quin":case "jawo":case "niel":return 1;
                case "van":case "ace":case "angel":return 2;
                case "lhen":case "ellusur":case "vhen":case "trudice":return 4;
                default:throw new ArgumentException("Unknown hero");
            }
        }
    }
}
