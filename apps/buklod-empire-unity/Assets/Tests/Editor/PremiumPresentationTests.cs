using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class PremiumPresentationTests {
        [Test] public void SmoothMotionHasContinuousBoundedEnvelope(){
            float last=0;
            for(int i=0;i<=100;i++){float w=PremiumMotionEnvelope.Ease(i/100f);Assert.That(w,Is.InRange(last,1f));last=w;}
            Assert.AreEqual(0,PremiumMotionEnvelope.Reveal(0));Assert.AreEqual(0,PremiumMotionEnvelope.Reveal(1));
            Assert.Greater(PremiumMotionEnvelope.Reveal(.3f),.95f);
            Assert.Less(PremiumMotionEnvelope.BlendDuration("Attack"),PremiumMotionEnvelope.BlendDuration("Walk"));
        }
        [Test] public void All39SkillsHaveFiniteBoundedSurfaceGeometry(){
            Assert.AreEqual(39,CinematicSkillCatalog.All.Count);
            foreach(var p in CinematicSkillCatalog.All)for(int l=0;l<PremiumSkillSurface.Layers;l++)for(int j=0;j<=20;j++)for(int i=0;i<=40;i++){
                Vector3 v=PremiumSkillSurface.Sample(p,i/40f,j/20f,l);
                Assert.IsFalse(float.IsNaN(v.sqrMagnitude)||float.IsInfinity(v.sqrMagnitude),p.Id);
                Assert.Less(v.magnitude,4,p.Id);
                Assert.That(PremiumSkillSurface.Width(i/40f,j/20f,l),Is.InRange(0f,.11f));
            }
            Assert.AreEqual(246,PremiumSkillSurface.VertexCount);
        }
        [Test] public void DifferentMotifsHaveDifferentSpatialSilhouettes(){
            Assert.IsTrue(CinematicSkillCatalog.TryGet("groundbreaker",out var a));
            Assert.IsTrue(CinematicSkillCatalog.TryGet("foundation_wall",out var b));
            Assert.IsTrue(CinematicSkillCatalog.TryGet("bayanihan_bastion",out var c));
            var x=PremiumSkillSurface.Sample(a,.25f,.4f,2);var y=PremiumSkillSurface.Sample(b,.25f,.4f,2);var z=PremiumSkillSurface.Sample(c,.25f,.4f,2);
            Assert.Greater(Vector3.Distance(x,y),.1f);Assert.Greater(Vector3.Distance(y,z),.1f);
        }
    }
}
