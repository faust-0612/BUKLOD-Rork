using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;
using Touch=UnityEngine.InputSystem.EnhancedTouch.Touch;
namespace Buklod.Empire {
    // Independent fingers for movement and aimed skill; release-to-cast, cancel on focus loss.
    public sealed class MobileBattleInput:MonoBehaviour {
        public static Vector2[] Centers=>ArenaControlSettings.Centers;
        public static Rect SafeArea=>ArenaTouchLayout.Safe(Screen.safeArea,Screen.width,Screen.height);
        public static float Radius(int index)=>ArenaControlSettings.Radius(SafeArea,index);
        public static Vector2 PixelCenter(int index)=>ArenaControlSettings.Center(SafeArea,index);
        public Vector2 MovementCenter=>movement==null?PixelCenter(0):origin;
        public Vector2 Joystick {get;private set;}
        public Vector2 Aim {get;private set;}
        public int ActiveSkill {get;private set;}=-1;
        private Finger movement,skill,orderFinger;private Vector2 orderOrigin;private OfflineSessionMenu orderMenu;
        private Vector2 origin,contactOrigin,actionOrigin;
        private Rect lastArea;
        private BattleView view;
        private OnlineSessionController online;
        private Camera onlineCamera;
        private bool onlinePlaying;
        public void Bind(BattleView battle){if(online)throw new System.InvalidOperationException("Unbind online before offline input.");view=battle;}
        public void BindOnline(OnlineSessionController session,Camera camera){
            if(view||!session||!camera)throw new System.InvalidOperationException("Online input requires its own camera and session.");
            Reset();online=session;onlineCamera=camera;onlinePlaying=false;
        }
        public void UnbindOnline(OnlineSessionController session){if(online!=session)return;Reset();online=null;onlineCamera=null;onlinePlaying=false;}
        private void Dispatch(int button,Vector2 direction){
            if(view){view.Cast(button,direction);return;}
            if(!online||!onlineCamera||online.State!=OnlineConnectionState.Playing)return;
            var aim=OnlineControlRouting.ToWorld(direction,onlineCamera.transform.right,onlineCamera.transform.forward);
            if(OnlineControlRouting.TryRoute(online.Snapshot,button,aim,out var action,out int target))online.Command(action,aim,target);
        }
        private void OnEnable(){lastArea=SafeArea;EnhancedTouchSupport.Enable();Touch.onFingerDown+=Down;Touch.onFingerMove+=Move;Touch.onFingerUp+=Up;}
        private void OnDisable(){Touch.onFingerDown-=Down;Touch.onFingerMove-=Move;Touch.onFingerUp-=Up;EnhancedTouchSupport.Disable();Reset();}
        private void OnApplicationFocus(bool focused){if(!focused)Reset();}
        private void OnApplicationPause(bool paused){if(paused)Reset();}
        private void Reset(){movement=null;skill=null;orderFinger=null;Joystick=Vector2.zero;Aim=Vector2.zero;ActiveSkill=-1;if(online)online.Move(Vector2.zero);}
        private void Down(Finger finger){
            var at=finger.currentTouch.screenPosition;
            if(online&&online.State!=OnlineConnectionState.Playing)return;
            if(!SafeArea.Contains(at))return;
            int button=ArenaControlSettings.Nearest(SafeArea,at);
            if(button>0){if(skill==null){skill=finger;ActiveSkill=button;actionOrigin=at;Aim=Vector2.zero;}return;}
            if(movement==null&&ArenaControlSettings.InMovementZone(SafeArea,at)){
                movement=finger;contactOrigin=at;origin=ArenaTouchLayout.ClampCenter(SafeArea,at,Radius(0));Joystick=Vector2.zero;return;
            }
            if(view&&orderFinger==null){if(!orderMenu)orderMenu=view.GetComponent<OfflineSessionMenu>();if(orderMenu&&orderMenu.ReserveFieldOrderTouch(at)){orderFinger=finger;orderOrigin=at;}}
        }
        private void UpdateMove(Vector2 at){Joystick=ArenaTouchLayout.Stick(at-contactOrigin,Radius(0));}
        private void Move(Finger finger){
            var at=finger.currentTouch.screenPosition;
            if(finger==movement)UpdateMove(at);
            if(finger==skill)Aim=ResolveAim(at,actionOrigin,Radius(ActiveSkill));
        }
        public static Vector2 ResolveAim(Vector2 at,Vector2 center,float radius){
            var d=at-center;return d.magnitude>radius*.25f?Vector2.ClampMagnitude(d/Mathf.Max(1,radius),1):Vector2.zero;
        }
        private void Up(Finger finger){
            if(finger==orderFinger){orderFinger=null;var touch=finger.currentTouch;if(touch.phase!=UnityEngine.InputSystem.TouchPhase.Canceled&&Vector2.Distance(orderOrigin,touch.screenPosition)<=Mathf.Max(12,SafeArea.height*.035f)&&orderMenu)orderMenu.CompleteFieldOrderTouch(touch.screenPosition);return;}
            if(finger==movement){movement=null;Joystick=Vector2.zero;}
            if(finger!=skill)return;
            bool cancel=finger.currentTouch.phase==UnityEngine.InputSystem.TouchPhase.Canceled||!SafeArea.Contains(finger.currentTouch.screenPosition)||Vector2.Distance(finger.currentTouch.screenPosition,PixelCenter(ActiveSkill))>Radius(ActiveSkill)*3.2f;
            int button=ActiveSkill;Vector2 direction=cancel?Vector2.zero:ResolveAim(finger.currentTouch.screenPosition,actionOrigin,Radius(button));
            skill=null;ActiveSkill=-1;Aim=Vector2.zero;
            if(!cancel)Dispatch(button,direction);
        }
        private void Update(){
            if(lastArea!=SafeArea){lastArea=SafeArea;Reset();}
            if(online){
                bool playing=online.State==OnlineConnectionState.Playing&&onlineCamera;
                if(playing!=onlinePlaying){Reset();onlinePlaying=playing;}
                if(!playing)return;
            }
#if UNITY_EDITOR
            var k=Keyboard.current;if(k!=null&&movement==null&&skill==null){
                Joystick=Vector2.ClampMagnitude(new Vector2((k.dKey.isPressed?1:0)-(k.aKey.isPressed?1:0),(k.wKey.isPressed?1:0)-(k.sKey.isPressed?1:0)),1);
                if(k.spaceKey.wasPressedThisFrame)Dispatch(1,Vector2.zero);if(k.digit1Key.wasPressedThisFrame)Dispatch(2,Vector2.zero);if(k.digit2Key.wasPressedThisFrame)Dispatch(3,Vector2.zero);if(k.digit3Key.wasPressedThisFrame)Dispatch(4,Vector2.zero);if(k.digit4Key.wasPressedThisFrame)Dispatch(5,Vector2.zero);if(k.rKey.wasPressedThisFrame)Dispatch(6,Vector2.zero);
            }
#endif
            if(onlinePlaying&&online&&onlineCamera)online.Move(OnlineControlRouting.ToWorld(Joystick,onlineCamera.transform.right,onlineCamera.transform.forward));
        }
    }
}
