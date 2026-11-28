using UnityEngine;
namespace Buklod.Empire {
    // Translate the existing mobile controls into intentions only; the server remains authoritative.
    internal static class OnlineControlRouting {
        internal static Vector2 ToWorld(Vector2 screen,Vector3 right,Vector3 forward){
            var r=new Vector2(right.x,right.z).normalized;var f=new Vector2(forward.x,forward.z).normalized;
            return Vector2.ClampMagnitude(r*screen.x+f*screen.y,1);
        }
        internal static bool TryRoute(OnlineSnapshot snapshot,int button,Vector2 aim,out MatchAction action,out int target){
            action=MatchAction.None;target=0;
            if(snapshot==null||snapshot.Finished||snapshot.Units==null)return false;
            OnlineUnit own=null;
            foreach(var u in snapshot.Units)if(u.Id==snapshot.OwnUnitId&&u.Team==snapshot.Team&&u.Kind==BattleTargetKind.Hero){own=u;break;}
            if(own==null||!own.Alive)return false;
            switch(button){
                case 1:action=MatchAction.Attack;return true;
                case 2:case 3:case 4:action=MatchAction.Cast;target=button-2;return true;
                case 5:action=MatchAction.Tactic;return true;
                case 6:action=MatchAction.Recall;return true;
                case 7:case 8:
                    var kind=button==7?BattleTargetKind.Minion:BattleTargetKind.Structure;
                    float best=float.PositiveInfinity;
                    foreach(var u in snapshot.Units){
                        if(u.Team==own.Team||!u.Alive||u.Kind!=kind)continue;
                        var delta=u.Position-own.Position;float distance=delta.sqrMagnitude;
                        if(aim.sqrMagnitude>.01f&&Vector2.Dot(delta.normalized,aim.normalized)<.35f)continue;
                        if(distance<best||(distance==best&&(target==0||u.Id<target))){best=distance;target=u.Id;}
                    }
                    if(target<=0)return false;
                    action=MatchAction.AttackUnit;return true;
                default:return false;
            }
        }
    }
}
