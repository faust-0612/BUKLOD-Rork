using System;
using System.Collections.Generic;
namespace Buklod.Empire {
    // Original equipment identity, visual-only. All angles are small local
    // pose corrections relative to the imported original basic-attack clip.
    public readonly struct ReviewWeaponProfile {
        public readonly string Equipment;
        public readonly float ChestYaw,ChestPitch,RightPitch,RightYaw,RightRoll,LeftPitch,LeftRoll,Forearm,Stance;
        public ReviewWeaponProfile(string equipment,float yaw,float pitch,float right,float aim,float roll,float left,float guard,float forearm,float stance){
            Equipment=equipment;ChestYaw=yaw;ChestPitch=pitch;RightPitch=right;RightYaw=aim;RightRoll=roll;LeftPitch=left;LeftRoll=guard;Forearm=forearm;Stance=stance;
        }
    }
    public static class ReviewWeaponProfiles {
        static readonly Dictionary<string,ReviewWeaponProfile> profiles=new Dictionary<string,ReviewWeaponProfile>(StringComparer.Ordinal){
            {"phan",new ReviewWeaponProfile("mallet",22,12,-23,0,-12,-9,8,-12,10)},
            {"quin",new ReviewWeaponProfile("compass",-12,-4,9,13,8,-16,-8,12,3)},
            {"van",new ReviewWeaponProfile("shield",-16,9,13,-8,18,-18,17,-18,8)},
            {"christian",new ReviewWeaponProfile("banner",28,3,-18,-15,-22,7,10,-9,7)},
            {"lhen",new ReviewWeaponProfile("tambourine",16,-3,10,-8,-12,-22,20,18,2)},
            {"ace",new ReviewWeaponProfile("cuff",-9,5,-8,10,5,-15,-8,-24,4)},
            {"ellusur",new ReviewWeaponProfile("crook",19,-4,8,-18,-17,-9,7,15,3)},
            {"jawo",new ReviewWeaponProfile("radio",-22,6,-6,14,10,-8,-12,-15,5)},
            {"mitch",new ReviewWeaponProfile("caddy",13,11,-12,-10,-19,-16,9,8,7)},
            {"niel",new ReviewWeaponProfile("loudhailer",8,16,-14,2,-7,-6,4,-20,12)},
            {"angel",new ReviewWeaponProfile("ledger",-17,6,7,-6,20,-24,12,13,8)},
            {"vhen",new ReviewWeaponProfile("trowel",24,17,-11,9,-24,5,8,18,9)},
            {"trudice",new ReviewWeaponProfile("puppet",-20,-8,15,-18,14,-17,-19,-8,2)}
        };
        public static ReviewWeaponProfile Get(string hero){
            if(hero==null||!profiles.TryGetValue(hero,out var p))throw new ArgumentException("Unknown review weapon identity.");
            return p;
        }
        public static float Duration(float original,float cooldown){
            if(float.IsNaN(original)||float.IsInfinity(original)||original<=0||float.IsNaN(cooldown)||float.IsInfinity(cooldown)||cooldown<=0)
                throw new ArgumentException("Invalid attack timing.");
            return Math.Min(original,cooldown*.9f);
        }
    }
}
