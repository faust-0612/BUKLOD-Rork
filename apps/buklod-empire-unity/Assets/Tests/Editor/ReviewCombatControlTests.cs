using NUnit.Framework;
using UnityEngine;
using System.Linq;
namespace Buklod.Empire.Tests {
    public sealed class ReviewCombatControlTests {
        [Test] public void OnlyBasicButtonsRepeat(){for(int i=0;i<=9;i++)Assert.AreEqual(i==1||i==7||i==8,MobileBattleInput.BasicButton(i));}
        [Test] public void ContactRelativeAimAndRelease(){var contact=new Vector2(100,100);Assert.AreEqual(Vector2.zero,MobileBattleInput.ResolveAim(contact,contact,40));Assert.AreEqual(Vector2.right,MobileBattleInput.ResolveAim(contact+Vector2.right*70,contact,40));Assert.False(MobileBattleInput.WithinRelease(contact+Vector2.right*130,contact,40));}
        [Test] public void ReadinessRespectsManaLevelAndControl(){
            var a=new SkillActor("phan");a.Level=5;Assert.False(a.CanAttemptCast(SkillSlot.Ultimate,0));a.Level=6;a.Mana=54;Assert.False(a.CanAttemptCast(SkillSlot.Ultimate,0));a.Mana=55;Assert.True(a.CanAttemptCast(SkillSlot.Ultimate,0));a.Set("silence",1,4,0);Assert.False(a.CanAttemptCast(SkillSlot.Ultimate,0));
        }
        [Test] public void BlindedBasicAttackDoesNotConsumeCooldown(){
            var b=new OfflineBattle("quin");var p=b.Player;p.State.Set("blind",1,5,b.Time);Assert.False(b.PlayerAttack(Vector2.zero));Assert.AreEqual(0,b.BasicAttackRemaining(p));
            var camp=b.Camps.First();p.Position=camp.Position;var hp=camp.Health;Assert.False(b.AttackNeutralPlayer(camp.Id));Assert.AreEqual(hp,camp.Health);Assert.AreEqual(0,b.BasicAttackRemaining(p));
        }
        [Test] public void PreviewIsReadOnlyAndHiddenTargetsAreNotSelected(){
            var b=new OfflineBattle("phan");var p=b.Player;var enemy=b.Units.First(u=>u.Team!=p.Team&&u.Kind==BattleTargetKind.Hero);Assert.False(b.IsVisibleTo(p.Team,enemy));var gold=p.Gold;var xp=p.Xp;var sequence=p.State.CastSequence;
            Assert.AreEqual("",b.PreviewBasicTarget(Vector2.zero,BattleTargetKind.Hero));Assert.AreEqual(gold,p.Gold);Assert.AreEqual(xp,p.Xp);Assert.AreEqual(sequence,p.State.CastSequence);Assert.AreEqual(0,b.BasicAttackRemaining(p));
        }
    }
}
