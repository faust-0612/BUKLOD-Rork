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
        private Finger movement,skill;
        private Vector2 origin,contactOrigin,skillOrigin;
        private Rect lastArea;private int lastRevision;private float nextRepeat;private bool repeated,dragged;
        public static bool BasicButton(int button)=>button==1||button==7||button==8;
        public static bool WithinRelease(Vector2 at,Vector2 center,float radius)=>radius>0&&Vector2.Distance(at,center)<=radius*3.2f;
        private BattleView view;
        public void Bind(BattleView battle){view=battle;}
        private void OnEnable(){Reset();lastArea=SafeArea;lastRevision=ArenaControlSettings.Revision;EnhancedTouchSupport.Enable();Touch.onFingerDown+=Down;Touch.onFingerMove+=Move;Touch.onFingerUp+=Up;}
        private void OnDisable(){Touch.onFingerDown-=Down;Touch.onFingerMove-=Move;Touch.onFingerUp-=Up;EnhancedTouchSupport.Disable();Reset();}
        private void OnApplicationFocus(bool focused){if(!focused)Reset();}
        private void OnApplicationPause(bool paused){if(paused)Reset();}
        private void Reset(){movement=null;skill=null;Joystick=Vector2.zero;Aim=Vector2.zero;ActiveSkill=-1;repeated=dragged=false;nextRepeat=0;}
        private bool CanAcceptInput=>view&&view.Battle!=null&&!view.Paused&&!view.Battle.Finished&&!view.Battle.AutonomousTraining&&Application.isFocused;
        private void Down(Finger finger){
            if(!CanAcceptInput)return;
            var at=finger.currentTouch.screenPosition;
            if(!SafeArea.Contains(at))return;
            int button=ArenaControlSettings.Nearest(SafeArea,at);
            if(button>0){if(skill==null){skill=finger;ActiveSkill=button;skillOrigin=at;Aim=Vector2.zero;nextRepeat=Time.unscaledTime+.25f;repeated=dragged=false;}return;}
            if(movement==null&&ArenaControlSettings.InMovementZone(SafeArea,at)){
                movement=finger;contactOrigin=at;origin=ArenaTouchLayout.ClampCenter(SafeArea,at,Radius(0));Joystick=Vector2.zero;
            }
        }
        private void UpdateMove(Vector2 at){Joystick=ArenaTouchLayout.Stick(at-contactOrigin,Radius(0));}
        private void Move(Finger finger){
            if(!CanAcceptInput){Reset();return;}
            var at=finger.currentTouch.screenPosition;
            if(finger==movement)UpdateMove(at);
            if(finger==skill){Aim=ResolveAim(at,skillOrigin,Radius(ActiveSkill));if(Aim.sqrMagnitude>.01f)dragged=true;}
        }
        public static Vector2 ResolveAim(Vector2 at,Vector2 center,float radius){
            var d=at-center;return d.magnitude>radius*.25f?Vector2.ClampMagnitude(d/Mathf.Max(1,radius),1):Vector2.zero;
        }
        private void Up(Finger finger){
            if(finger==movement){movement=null;Joystick=Vector2.zero;}
            if(finger!=skill)return;
            var at=finger.currentTouch.screenPosition;int button=ActiveSkill;
            bool cancel=finger.currentTouch.phase==UnityEngine.InputSystem.TouchPhase.Canceled||!SafeArea.Contains(at)||!WithinRelease(at,skillOrigin,Radius(button))||lastArea!=SafeArea||lastRevision!=ArenaControlSettings.Revision;
            Vector2 direction=cancel?Vector2.zero:ResolveAim(at,skillOrigin,Radius(button));bool consumed=repeated;
            skill=null;ActiveSkill=-1;Aim=Vector2.zero;repeated=dragged=false;
            if(!cancel&&!consumed&&CanAcceptInput)view.Cast(button,direction);
        }
        private void Update(){
            if(lastArea!=SafeArea||lastRevision!=ArenaControlSettings.Revision){lastArea=SafeArea;lastRevision=ArenaControlSettings.Revision;Reset();}
            if(!CanAcceptInput){Reset();return;}
            // Hold repeats basic attacks only; actual simulation cooldown and eligibility still govern every attempt.
            if(skill!=null&&BasicButton(ActiveSkill)&&!dragged&&Time.unscaledTime>=nextRepeat){
                var at=skill.currentTouch.screenPosition;if(!SafeArea.Contains(at)||!WithinRelease(at,skillOrigin,Radius(ActiveSkill))||ResolveAim(at,skillOrigin,Radius(ActiveSkill)).sqrMagnitude>.01f)dragged=true;
                else if(view.Battle.BasicAttackRemaining(view.Battle.Player)<=0){nextRepeat=Time.unscaledTime+.15f;if(view.Cast(ActiveSkill,Vector2.zero))repeated=true;}
            }
#if UNITY_EDITOR
            var k=Keyboard.current;if(k==null||movement!=null||skill!=null)return;
            Joystick=Vector2.ClampMagnitude(new Vector2((k.dKey.isPressed?1:0)-(k.aKey.isPressed?1:0),(k.wKey.isPressed?1:0)-(k.sKey.isPressed?1:0)),1);
            if(view){if(k.spaceKey.wasPressedThisFrame)view.Cast(1,Vector2.zero);if(k.digit1Key.wasPressedThisFrame)view.Cast(2,Vector2.zero);if(k.digit2Key.wasPressedThisFrame)view.Cast(3,Vector2.zero);if(k.digit3Key.wasPressedThisFrame)view.Cast(4,Vector2.zero);if(k.digit4Key.wasPressedThisFrame)view.Cast(5,Vector2.zero);if(k.rKey.wasPressedThisFrame)view.Cast(6,Vector2.zero);}
#endif
        }
    }
}
