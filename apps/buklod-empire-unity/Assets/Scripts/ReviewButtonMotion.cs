using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
namespace Buklod.Empire {
    // UI only: no extra action, no duplicate click, no blocked touches.
    public sealed class ReviewButtonMotion:MonoBehaviour,IPointerDownHandler,IPointerUpHandler,IPointerExitHandler {
        Button button;bool pressed;
        void Awake(){button=GetComponent<Button>();}
        public void OnPointerDown(PointerEventData data){pressed=button&&button.IsInteractable();}
        public void OnPointerUp(PointerEventData data){pressed=false;}
        public void OnPointerExit(PointerEventData data){pressed=false;}
        void Update(){float scale=pressed&&button&&button.IsInteractable()?.95f:1f;transform.localScale=Vector3.Lerp(transform.localScale,Vector3.one*scale,1-Mathf.Exp(-22*Time.unscaledDeltaTime));}
        void OnDisable(){pressed=false;transform.localScale=Vector3.one;}
    }
}
