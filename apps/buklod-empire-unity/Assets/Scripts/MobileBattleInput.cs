using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;
using Touch=UnityEngine.InputSystem.EnhancedTouch.Touch;
namespace Buklod.Empire {
    // Independent fingers for movement and aimed skill; release-to-cast, cancel on focus loss.
    public sealed class MobileBattleInput:MonoBehaviour {
        public static readonly Vector2[] Centers={new Vector2(.14f,.22f),new Vector2(.87f,.18f),new Vector2(.73f,.22f),new Vector2(.82f,.40f),new Vector2(.94f,.40f),new Vector2(.69f,.40f),new Vector2(.56f,.23f),new Vector2(.78f,.075f),new Vector2(.95f,.075f)};
        public static Rect SafeArea=>ArenaTouchLayout.Safe(Screen.safeArea,Screen.width,Screen.height);
        public static float Radius(int index)=>ArenaTouchLayout.Radius(SafeArea,index);
        public static Vector2 PixelCenter(int index)=>ArenaTouchLayout.Center(SafeArea,Centers[index]);
        public Vector2 MovementCenter=>movement==null?PixelCenter(0):origin;
        public Vector2 Joystick {get;private set;}
        public Vector2 Aim {get;private set;}
        public int ActiveSkill {get;private set;}=-1;
        private Finger movement,skill;
        private Vector2 origin;
        private Rect lastArea;
        private BattleView view;
        public void Bind(BattleView battle){view=battle;}
        private void OnEnable(){EnhancedTouchSupport.Enable();Touch.onFingerDown+=Down;Touch.onFingerMove+=Move;Touch.onFingerUp+=Up;}
        private void OnDisable(){Touch.onFingerDown-=Down;Touch.onFingerMove-=Move;Touch.onFingerUp-=Up;EnhancedTouchSupport.Disable();Reset();}
        private void OnApplicationFocus(bool focused){if(!focused)Reset();}
        private void OnApplicationPause(bool paused){if(paused)Reset();}
        private void Reset(){movement=null;skill=null;Joystick=Vector2.zero;Aim=Vector2.zero;ActiveSkill=-1;}
        private void Down(Finger finger){
            var at=finger.currentTouch.screenPosition;
            if(!SafeArea.Contains(at))return;
            if(movement==null&&ArenaTouchLayout.InMovementZone(SafeArea,at)){
                movement=finger;origin=ArenaTouchLayout.ClampCenter(SafeArea,at,Radius(0));UpdateMove(at);return;
            }
            if(skill!=null)return;
            int button=ArenaTouchLayout.Nearest(SafeArea,Centers,at);
            if(button>0){skill=finger;ActiveSkill=button;Aim=Vector2.zero;}
        }
        private void UpdateMove(Vector2 at){Joystick=ArenaTouchLayout.Stick(at-origin,Radius(0));}
        private void Move(Finger finger){
            var at=finger.currentTouch.screenPosition;
            if(finger==movement)UpdateMove(at);
            if(finger==skill){var d=at-PixelCenter(ActiveSkill);Aim=d.magnitude>Radius(ActiveSkill)*.25f?Vector2.ClampMagnitude(d/Mathf.Max(1,Radius(ActiveSkill)),1):Vector2.zero;}
        }
        private void Up(Finger finger){
            if(finger==movement){movement=null;Joystick=Vector2.zero;}
            if(finger!=skill)return;
            bool cancel=finger.currentTouch.phase==UnityEngine.InputSystem.TouchPhase.Canceled||!SafeArea.Contains(finger.currentTouch.screenPosition)||Vector2.Distance(finger.currentTouch.screenPosition,PixelCenter(ActiveSkill))>Radius(ActiveSkill)*3.2f;
            int button=ActiveSkill;Vector2 direction=Aim;
            skill=null;ActiveSkill=-1;Aim=Vector2.zero;
            if(!cancel&&view)view.Cast(button,direction);
        }
        private void Update(){
            if(lastArea!=SafeArea){lastArea=SafeArea;Reset();}
#if UNITY_EDITOR
            var k=Keyboard.current;if(k==null||movement!=null||skill!=null)return;
            Joystick=Vector2.ClampMagnitude(new Vector2((k.dKey.isPressed?1:0)-(k.aKey.isPressed?1:0),(k.wKey.isPressed?1:0)-(k.sKey.isPressed?1:0)),1);
            if(view){if(k.spaceKey.wasPressedThisFrame)view.Cast(1,Vector2.zero);if(k.digit1Key.wasPressedThisFrame)view.Cast(2,Vector2.zero);if(k.digit2Key.wasPressedThisFrame)view.Cast(3,Vector2.zero);if(k.digit3Key.wasPressedThisFrame)view.Cast(4,Vector2.zero);if(k.digit4Key.wasPressedThisFrame)view.Cast(5,Vector2.zero);if(k.rKey.wasPressedThisFrame)view.Cast(6,Vector2.zero);}
#endif
        }
    }
}
