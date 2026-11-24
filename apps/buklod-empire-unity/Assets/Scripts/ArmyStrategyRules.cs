using System;
using UnityEngine;
namespace Buklod.Empire {
    public enum ArmyOrder { Automatic, Rally, PushLane, Defend, Capture, Escort }
    public enum ArmyFormation { Line, Wedge, Screen, Spread }
    public readonly struct ArmyCommand {
        public readonly ArmyOrder Order;
        public readonly ArmyFormation Formation;
        public readonly ArenaLane Lane;
        public readonly int TerritoryId;
        public readonly Vector2 Anchor;
        public readonly float ExpiresAt;
        public ArmyCommand(ArmyOrder order,ArmyFormation formation,ArenaLane lane,int territoryId,Vector2 anchor,float expiresAt){Order=order;Formation=formation;Lane=lane;TerritoryId=territoryId;Anchor=anchor;ExpiresAt=expiresAt;}
        public bool Active(float now)=>Order!=ArmyOrder.Automatic&&now<ExpiresAt;
    }
    public static class ArmyStrategyRules {
        public const float Duration=35,OrderCooldown=3;
        public static bool Valid(ArmyOrder order,ArmyFormation formation,ArenaLane lane)=>Enum.IsDefined(typeof(ArmyOrder),order)&&Enum.IsDefined(typeof(ArmyFormation),formation)&&Enum.IsDefined(typeof(ArenaLane),lane);
        // Local-space offsets: forward points toward enemy, ranged/support stays behind.
        public static Vector2 Offset(ArmyFormation formation,int slot,bool rear,bool lux){
            int i=Math.Max(0,Math.Min(7,slot));float side=i==0?0:((i%2==1?1:-1)*((i+1)/2));
            float depth=rear?-4:2,spacing=2.5f;
            switch(formation){
                case ArmyFormation.Wedge:depth-=Math.Abs(side)*1.5f;break;
                case ArmyFormation.Screen:depth=rear?-5:4;spacing=3;break;
                case ArmyFormation.Spread:spacing=4;depth-=Math.Abs(side);break;
            }
            return new Vector2((lux?1:-1)*depth,side*spacing);
        }
    }
}
