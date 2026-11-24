using System.Linq;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class CinematicSkillTests {
        [Test] public void AllCanonicalSkillsHaveUniqueVisualProfiles(){
            var ids=HeroKitCatalog.All.SelectMany(h=>new[]{h.Primary.Id,h.Secondary.Id,h.Ultimate.Id}).ToArray();
            Assert.AreEqual(39,ids.Length);
            CollectionAssert.AreEquivalent(ids,CinematicSkillCatalog.All.Select(p=>p.Id));
            Assert.AreEqual(39,CinematicSkillCatalog.All.Select(p=>(p.Motif,p.Lobes,p.Lift,p.Reach)).Distinct().Count());
        }
        [Test] public void AccentSamplesAreFiniteBoundedAndFade(){
            foreach(var p in CinematicSkillCatalog.All){
                Assert.IsTrue(SkillCueCatalog.TryGet(p.Id,out var cue));
                for(int i=0;i<CinematicSkillCatalog.AccentCount;i++)for(int frame=0;frame<=20;frame++){
                    float t=frame/20f;
                    var s=CinematicSkillCatalog.Evaluate(p,i,t,cue.Size);
                    Assert.IsFalse(float.IsNaN(s.Position.sqrMagnitude)||float.IsInfinity(s.Position.sqrMagnitude));
                    Assert.Less(s.Position.magnitude,cue.Size*3);
                    Assert.Greater(s.Size,0);Assert.That(s.Opacity,Is.InRange(-.0001f,1f));
                    Assert.That(s.Stretch,Is.InRange(1f,3f));
                    if(frame==0||frame==20)Assert.AreEqual(0,s.Opacity,.0001f);
                    Assert.AreEqual(s.Position,CinematicSkillCatalog.Evaluate(p,i,t,cue.Size).Position);
                }
            }
        }
        [Test] public void SharedPoolBudgetUnchanged(){
            Assert.Less(CinematicSkillCatalog.AccentCount,SkillParticleMotion.Count);
            Assert.AreEqual(48,SkillParticleMotion.Count);Assert.AreEqual(24,BattleEffects.Capacity);
        }
    }
}
