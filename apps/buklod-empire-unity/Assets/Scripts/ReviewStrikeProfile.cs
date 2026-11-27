using UnityEngine;
namespace Buklod.Empire {
    // Stylized directional strike, not measured weapon-tip trajectory or hitbox.
    public readonly struct ReviewStrikeProfile {
        public readonly float Arc,Reach,Lift,Width,Duration;
        public ReviewStrikeProfile(float arc,float reach,float lift,float width,float duration){Arc=arc;Reach=reach;Lift=lift;Width=width;Duration=duration;}
        public static ReviewStrikeProfile For(string hero){
            if(hero==null)return new ReviewStrikeProfile(1.3f,1.55f,.16f,.13f,.26f);
            switch(ReviewWeaponProfiles.Get(hero).Equipment){
                case "mallet":return new ReviewStrikeProfile(.9f,1.65f,.35f,.17f,.31f);
                case "compass":return new ReviewStrikeProfile(.8f,1.2f,.13f,.08f,.21f);
                case "shield":return new ReviewStrikeProfile(.7f,1.25f,.10f,.19f,.28f);
                case "banner":return new ReviewStrikeProfile(1.45f,1.85f,.28f,.12f,.30f);
                case "tambourine":return new ReviewStrikeProfile(1.2f,1.35f,.25f,.10f,.25f);
                case "cuff":return new ReviewStrikeProfile(.65f,1.1f,.17f,.09f,.22f);
                case "crook":return new ReviewStrikeProfile(1.55f,1.7f,.30f,.11f,.29f);
                case "radio":return new ReviewStrikeProfile(.75f,1.22f,.12f,.085f,.23f);
                case "caddy":return new ReviewStrikeProfile(1.1f,1.42f,.24f,.14f,.27f);
                case "loudhailer":return new ReviewStrikeProfile(.6f,1.45f,.15f,.15f,.24f);
                case "ledger":return new ReviewStrikeProfile(.95f,1.28f,.20f,.095f,.25f);
                case "trowel":return new ReviewStrikeProfile(1.0f,1.48f,.32f,.105f,.28f);
                case "puppet":return new ReviewStrikeProfile(1.35f,1.33f,.40f,.075f,.26f);
                default:throw new System.ArgumentException("Unknown strike identity");
            }
        }
        public Vector3 Point(float u,float time){u=Mathf.Clamp01(u);float t=Mathf.Clamp01(time);float a=Mathf.Lerp(-Arc,Arc,u)+.5f*t;float r=Reach*Mathf.Lerp(.65f,1.1f,t);return new Vector3(Mathf.Sin(a)*r,Lift*Mathf.Sin(u*Mathf.PI),Mathf.Cos(a)*r);}
    }
}
