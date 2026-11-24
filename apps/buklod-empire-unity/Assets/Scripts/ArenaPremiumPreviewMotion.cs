using UnityEngine;
using UnityEngine.UI;
namespace Buklod.Empire {
    // Menu-only animated premium preview. No hitboxes, stats, inventory, or battle effect hooks.
    [RequireComponent(typeof(Image))]
    public sealed class ArenaPremiumPreviewMotion:MonoBehaviour {
        private Image image;
        private Color baseColor;
        private float strength,phase;
        private bool active;
        public static float TierStrength(string style){
            switch(style){
                case "legendary":case "legendary_all":return .55f;
                case "mythical":case "transformation":return .85f;
                case "exclusive":case "collector":case "royal":return .45f;
                case "original":case "access":return 0;
                default:return .25f;
            }
        }
        public void Configure(ArenaOffer offer){
            if(!image)image=GetComponent<Image>();
            baseColor=offer.Accent;strength=TierStrength(offer.Style);phase=0;active=true;
            transform.localScale=Vector3.one;transform.localRotation=Quaternion.identity;image.color=baseColor;
        }
        private void Update(){
            if(!active||strength<=0||!image)return;
            phase+=Mathf.Min(Time.unscaledDeltaTime,.05f);
            float wave=.5f+.5f*Mathf.Sin(phase*2.4f);
            image.color=Color.Lerp(baseColor,Color.white,wave*strength*.26f);
            transform.localScale=Vector3.one*(1+wave*strength*.055f);
            transform.localRotation=Quaternion.Euler(0,0,Mathf.Sin(phase*1.2f)*strength*5f);
        }
    }
}
