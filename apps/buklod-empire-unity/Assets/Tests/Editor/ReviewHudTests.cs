using System.Linq;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class ReviewHudTests {
        [Test] public void MinimapUsesCanonicalBounds(){
            Assert.AreEqual(Vector2.zero,ReviewMinimap.Normalize(Vector2.zero));
            Assert.AreEqual(Vector2.one,ReviewMinimap.Normalize(new Vector2(OfflineBattle.Width,OfflineBattle.Height)));
            Assert.AreEqual(Vector2.one*.5f,ReviewMinimap.Normalize(new Vector2(OfflineBattle.Width*.5f,OfflineBattle.Height*.5f)));
            Assert.AreEqual(new Vector2(0,1),ReviewMinimap.Normalize(new Vector2(-10,OfflineBattle.Height+10)));
        }
        [Test] public void MinimapDoesNotRevealHiddenOrDeadUnits(){
            var battle=new OfflineBattle("phan");
            var enemy=battle.Units.First(u=>u.Team!=battle.Player.Team&&u.Kind==BattleTargetKind.Hero);
            Assert.True(ReviewMinimap.ShowUnit(battle,battle.Player));
            Assert.False(ReviewMinimap.ShowUnit(battle,enemy));
            battle.Player.State.Health=0;
            Assert.False(ReviewMinimap.ShowUnit(battle,battle.Player));
        }
        [Test] public void ExperienceThresholdRetainsOriginalCurve(){
            for(int level=1;level<=15;level++)Assert.AreEqual(65*level+18*level*level,OfflineBattle.ExperienceThreshold(level));
        }
        [Test] public void EveryHeroSkillHasACanonicalGlyphCue(){
            foreach(var hero in HeroKitCatalog.All)
                foreach(var slot in new[]{SkillSlot.Primary,SkillSlot.Secondary,SkillSlot.Ultimate})
                    Assert.True(SkillCueCatalog.TryGet(hero.Skill(slot).Id,out _));
        }
    }
}
