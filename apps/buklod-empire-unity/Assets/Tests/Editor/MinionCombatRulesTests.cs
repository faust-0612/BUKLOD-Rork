using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public class MinionCombatRulesTests {
        private static BattleTarget Enemy(int id,BattleTargetKind kind,float distance,bool attackable=true)=>new BattleTarget(id,ArenaTeam.Tenebra,kind,distance,true,attackable);
        [Test] public void SiegePrefersAttackableStructuresAndTriplesBaseDamage() {
            var targets=new[]{Enemy(1,BattleTargetKind.Minion,20),Enemy(2,BattleTargetKind.Structure,30,false),Enemy(3,BattleTargetKind.Structure,40)};
            Assert.That(MinionCombatRules.Select(MinionRole.Siege,ArenaTeam.Lux,targets,170).Value.Id,Is.EqualTo(3));
            Assert.That(MinionCombatRules.HitDamage(MinionRole.Siege,1,BattleTargetKind.Structure,.2f),Is.EqualTo(72).Within(.001));
        }
        [Test] public void InfantryPrefersEnemyMinionsAndExcludesOutOfRange() {
            var targets=new[]{Enemy(1,BattleTargetKind.Hero,5),Enemy(2,BattleTargetKind.Minion,42),Enemy(3,BattleTargetKind.Minion,43),new BattleTarget(4,ArenaTeam.Lux,BattleTargetKind.Minion,1,true,true)};
            Assert.That(MinionCombatRules.Select(MinionRole.Infantry,ArenaTeam.Lux,targets,42).Value.Id,Is.EqualTo(2));
        }
        [Test] public void HealerSelectsOnlyInjuredLivingFriendlyMinions() {
            var targets=new[]{Enemy(1,BattleTargetKind.Minion,5),new BattleTarget(2,ArenaTeam.Lux,BattleTargetKind.Minion,5,true,true),new BattleTarget(3,ArenaTeam.Lux,BattleTargetKind.Minion,10,true,true,20),new BattleTarget(4,ArenaTeam.Lux,BattleTargetKind.Minion,2,false,true,100)};
            Assert.That(MinionCombatRules.Select(MinionRole.Healer,ArenaTeam.Lux,targets,170).Value.Id,Is.EqualTo(3));
            Assert.That(MinionCombatRules.Stats(MinionRole.Healer).HealAmount,Is.EqualTo(20));
        }
        [Test] public void EqualDistanceUsesStableIdAndEmptyCandidatesReturnNull() {
            var targets=new[]{Enemy(9,BattleTargetKind.Minion,10),Enemy(4,BattleTargetKind.Minion,10)};
            Assert.That(MinionCombatRules.Select(MinionRole.Gunner,ArenaTeam.Lux,targets,270).Value.Id,Is.EqualTo(4));
            Assert.That(MinionCombatRules.Select(MinionRole.Mage,ArenaTeam.Lux,new BattleTarget[0],230),Is.Null);
        }
    }
}
