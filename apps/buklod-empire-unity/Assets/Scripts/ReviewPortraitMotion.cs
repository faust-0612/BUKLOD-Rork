using System;
using UnityEngine;
namespace Buklod.Empire {
    public readonly struct PortraitChoreography {
        public readonly float Orbit,Zoom,Height,Duration,Blink;
        public PortraitChoreography(float orbit,float zoom,float height,float duration,float blink){Orbit=orbit;Zoom=zoom;Height=height;Duration=duration;Blink=blink;}
    }
    public static class ReviewPortraitMotion {
        public static PortraitChoreography Get(string hero){
            switch(hero){
                case "phan":return new PortraitChoreography(28,.18f,.05f,.78f,.62f);
                case "quin":return new PortraitChoreography(-32,.12f,.08f,.64f,.42f);
                case "van":return new PortraitChoreography(18,.22f,-.04f,.82f,.55f);
                case "christian":return new PortraitChoreography(35,.20f,.08f,.85f,.68f);
                case "lhen":return new PortraitChoreography(-24,.14f,.04f,.74f,.46f);
                case "ace":return new PortraitChoreography(21,.11f,.03f,.69f,.58f);
                case "ellusur":return new PortraitChoreography(-19,.16f,.07f,.83f,.66f);
                case "jawo":return new PortraitChoreography(38,.13f,-.02f,.62f,.39f);
                case "mitch":return new PortraitChoreography(-27,.19f,.02f,.77f,.53f);
                case "niel":return new PortraitChoreography(31,.17f,-.05f,.71f,.49f);
                case "angel":return new PortraitChoreography(-22,.10f,.06f,.76f,.61f);
                case "vhen":return new PortraitChoreography(17,.15f,.09f,.80f,.57f);
                case "trudice":return new PortraitChoreography(-36,.21f,.01f,.84f,.44f);
                default:throw new ArgumentException("Unknown portrait identity");
            }
        }
        public static float BlinkPhase(string hero)=>Get(hero).Blink;
        public static Vector3 HeadOffset(string hero,float phase){
            var p=Get(hero);float a=phase*2*Mathf.PI;
            return new Vector3(1.8f*Mathf.Sin(a),Mathf.Sign(p.Orbit)*2.5f*Mathf.Sin(a),.9f*Mathf.Sin(a*2));
        }
        public static Vector3 ChestOffset(float phase)=>new Vector3(1.4f*Mathf.Sin(phase*2*Mathf.PI),0,.45f*Mathf.Sin(phase*2*Mathf.PI));
    }
}
